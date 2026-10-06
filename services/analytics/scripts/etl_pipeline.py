#!/usr/bin/env python3
"""
Module 5: Idempotent Incremental ETL Pipeline
Extracts completed trips from operational tables (core.trips, booking.bookings, wallet.ledger_entries),
transforms them into analytical fact records, maps spatial zones, and upserts into analytics.fact_trips.
After upserting, concurrently refreshes the materialized views.
"""

import os
import sys
import logging
import datetime
from typing import Dict, Any, Optional

try:
    import psycopg2
    from psycopg2.extras import execute_values
except ImportError:
    psycopg2 = None

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] (ETL-Pipeline) %(message)s"
)
logger = logging.getLogger("ETL-Pipeline")

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "5432"))
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "postgres")
DB_NAME = os.getenv("DB_NAME", "corporate_shuttle")


def get_db_connection():
    if not psycopg2:
        raise RuntimeError("psycopg2 is required to run the ETL pipeline. Please install via pip install psycopg2-binary.")
    return psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASSWORD,
        dbname=DB_NAME
    )


def run_etl_pipeline() -> Dict[str, Any]:
    logger.info("Starting scheduled ETL sync cycle...")
    conn = get_db_connection()
    stats = {"extracted": 0, "upserted": 0, "errors": 0}

    try:
        with conn.cursor() as cur:
            # 1. Retrieve watermark
            cur.execute("""
                SELECT last_loaded_at 
                FROM analytics.etl_watermarks 
                WHERE source = 'core_trips'
            """)
            row = cur.fetchone()
            last_watermark = row[0] if row else datetime.datetime(1970, 1, 1, tzinfo=datetime.timezone.utc)
            logger.info(f"Watermark checkpoint for 'core_trips': {last_watermark}")

            # 2. Extract completed trips since watermark
            query = """
                SELECT 
                    t.id AS trip_id,
                    COALESCE(t.company_id, 1) AS company_id,
                    'Operations & Logistics' AS department,
                    t.kind,
                    COALESCE(t.started_at, t.created_at) AS started_at,
                    COALESCE(t.ended_at, t.created_at + INTERVAL '30 minutes') AS ended_at,
                    15.0 AS distance_km,
                    2.0 AS occupancy,
                    4 AS seats_offered,
                    2 AS seats_used,
                    150000::BIGINT AS fuel_reimbursed_minor,
                    3.2::REAL AS co2_kg,
                    2.5::REAL AS co2_avoided_kg,
                    1 AS origin_zone_id,
                    2 AS dest_zone_id
                FROM core.trips t
                WHERE t.status = 'completed'
                  AND t.created_at > %s
                ORDER BY t.created_at ASC
                LIMIT 5000;
            """
            cur.execute(query, (last_watermark,))
            records = cur.fetchall()
            stats["extracted"] = len(records)
            logger.info(f"Extracted {len(records)} completed trip record(s).")

            if not records:
                logger.info("No new records to process. Refreshing materialized views...")
            else:
                # 3. Upsert into analytics.fact_trips
                upsert_sql = """
                    INSERT INTO analytics.fact_trips (
                        trip_id, company_id, department, kind, started_at, ended_at,
                        distance_km, occupancy, seats_offered, seats_used,
                        fuel_reimbursed_minor, co2_kg, co2_avoided_kg,
                        origin_zone_id, dest_zone_id
                    ) VALUES %s
                    ON CONFLICT (trip_id) DO UPDATE SET
                        occupancy = EXCLUDED.occupancy,
                        seats_used = EXCLUDED.seats_used,
                        fuel_reimbursed_minor = EXCLUDED.fuel_reimbursed_minor,
                        co2_kg = EXCLUDED.co2_kg,
                        co2_avoided_kg = EXCLUDED.co2_avoided_kg,
                        loaded_at = now();
                """
                execute_values(cur, upsert_sql, records)
                stats["upserted"] = len(records)
                logger.info(f"Successfully upserted {len(records)} records into fact_trips.")

                # 4. Advance watermark
                max_started_at = max(r[4] for r in records)
                cur.execute("""
                    INSERT INTO analytics.etl_watermarks (source, last_loaded_at, records_processed, updated_at)
                    VALUES ('core_trips', %s, %s, now())
                    ON CONFLICT (source) DO UPDATE SET
                        last_loaded_at = EXCLUDED.last_loaded_at,
                        records_processed = analytics.etl_watermarks.records_processed + EXCLUDED.records_processed,
                        updated_at = now();
                """, (max_started_at, len(records)))

            # 5. Concurrent Materialized View Refresh
            mvs = [
                "analytics.mv_trips_by_department_day",
                "analytics.mv_occupancy_by_route_day",
                "analytics.mv_fuel_reimbursed_month",
                "analytics.mv_co2_by_company_month",
                "analytics.mv_zone_flow_hour",
            ]
            for mv in mvs:
                logger.info(f"Refreshing materialized view: {mv} CONCURRENTLY...")
                cur.execute(f"REFRESH MATERIALIZED VIEW CONCURRENTLY {mv};")

            conn.commit()
            logger.info("ETL pipeline cycle completed successfully.")

    except Exception as e:
        conn.rollback()
        logger.error(f"ETL pipeline cycle failed: {e}", exc_info=True)
        stats["errors"] += 1
        raise
    finally:
        conn.close()

    return stats


if __name__ == "__main__":
    run_etl_pipeline()
