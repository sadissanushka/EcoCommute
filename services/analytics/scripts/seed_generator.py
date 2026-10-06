#!/usr/bin/env python3
"""
Module 5: Deterministic Commute Data Seed Generator
Generates realistic corporate commute trips for analytics, ETL validation, and database benchmarking.

Features:
- Deterministic random generation using numpy.random.default_rng(seed=42)
- 5 Companies, 6 Corporate Departments, ~1,250 total employees
- 3 Months of historical commute trips (July 1, 2026 to September 30, 2026)
- Accurate Sri Lankan peak-hour commute distributions (07:30–09:30, 16:30–19:00)
- Realistic modal split: 55% carpool, 35% corporate shuttle, 10% solo baseline
- Precise CO2 calculations (DEFRA 2024 derived) and fuel reimbursement in LKR cents
- Optional large benchmark flag (--benchmark) generating 200,000+ trips
"""

import argparse
import datetime
import json
import math
import sys
from typing import List, Dict, Any
import numpy as np

COMPANIES = [
    {"id": 1, "name": "Dialog Axiata PLC", "headcount": 450, "city": "Colombo 02"},
    {"id": 2, "name": "MAS Holdings", "headcount": 380, "city": "Colombo 03"},
    {"id": 3, "name": "John Keells Holdings", "headcount": 320, "city": "Colombo 02"},
    {"id": 4, "name": "Commercial Bank of Ceylon", "headcount": 280, "city": "Colombo 01"},
    {"id": 5, "name": "WSO2 Lanka", "headcount": 220, "city": "Colombo 07"},
]

DEPARTMENTS = [
    "Engineering & IT",
    "Operations & Logistics",
    "Finance & Accounting",
    "Human Resources",
    "Sales & Marketing",
    "Customer Support",
]

ZONES = [
    {"id": 1, "code": "CMB-01", "name": "Colombo Fort"},
    {"id": 2, "code": "CMB-02", "name": "Slave Island / Union Place"},
    {"id": 3, "code": "CMB-03", "name": "Kollupitiya / Bambalapitiya"},
    {"id": 4, "code": "CMB-07", "name": "Cinnamon Gardens"},
    {"id": 5, "code": "KJW-01", "name": "Rajagiriya / Battaramulla"},
    {"id": 6, "code": "DEH-01", "name": "Dehiwala / Mount Lavinia"},
]

# Emission factor (kg CO2e / litre) for Petrol 92
KG_CO2E_PER_LITRE = 2.31495
KM_PER_LITRE_AVG = 12.0
PETROL_PRICE_CENTS_PER_LITRE = 33200  # 332.00 LKR = 33,200 cents


def generate_departure_minute_of_day(rng: np.random.Generator) -> int:
    """
    Generates a departure minute of the day (0-1439) following a bimodal commute distribution.
    - Morning Peak (07:30 - 09:30): ~50%
    - Evening Peak (16:30 - 19:00): ~40%
    - Midday / Off-peak: ~10%
    """
    roll = rng.random()
    if roll < 0.50:
        # Morning peak: mean 08:15 (495 mins), std 25 mins
        minute = int(rng.normal(loc=495, scale=25))
        return max(450, min(570, minute))
    elif roll < 0.90:
        # Evening peak: mean 17:45 (1065 mins), std 35 mins
        minute = int(rng.normal(loc=1065, scale=35))
        return max(990, min(1140, minute))
    else:
        # Off-peak midday: uniform between 10:00 (600) and 15:00 (900)
        return int(rng.uniform(600, 900))


def generate_trip_dataset(total_trips: int = 15000, seed: int = 42) -> List[Dict[str, Any]]:
    rng = np.random.default_rng(seed)
    trips: List[Dict[str, Any]] = []

    # 92 days from July 1, 2026 to September 30, 2026
    start_date = datetime.date(2026, 7, 1)
    end_date = datetime.date(2026, 9, 30)
    day_span = (end_date - start_date).days

    print(f"Generating {total_trips} deterministic trips over {day_span} days (seed={seed})...")

    for trip_id in range(1, total_trips + 1):
        company = rng.choice(COMPANIES)
        dept = rng.choice(DEPARTMENTS)

        # Distribute day (skipping Sundays with 85% probability)
        day_offset = int(rng.integers(0, day_span))
        current_date = start_date + datetime.timedelta(days=day_offset)
        if current_date.weekday() == 6 and rng.random() < 0.85:
            # Shift to Monday
            current_date += datetime.timedelta(days=1)

        departure_min = generate_departure_minute_of_day(rng)
        hour = departure_min // 60
        minute = departure_min % 60
        second = int(rng.integers(0, 60))

        started_at = datetime.datetime(
            current_date.year, current_date.month, current_date.day,
            hour, minute, second,
            tzinfo=datetime.timezone(datetime.timedelta(hours=5, minutes=30))
        )

        # Mode split
        mode_roll = rng.random()
        if mode_roll < 0.55:
            kind = "carpool"
            distance_km = round(float(rng.uniform(8.0, 28.0)), 2)
            seats_offered = int(rng.choice([3, 4]))
            occupancy = round(float(rng.uniform(2.0, seats_offered)), 1)
            seats_used = int(occupancy)
            # Reimbursed fuel in minor cents
            litres = distance_km / KM_PER_LITRE_AVG
            fuel_reimbursed_minor = int(round(litres * PETROL_PRICE_CENTS_PER_LITRE))
            co2_kg = round(float(litres * KG_CO2E_PER_LITRE), 3)
            # CO2 avoided = (occupancy * solo_co2) - actual_co2
            solo_baseline = (occupancy * (distance_km / 12.0)) * KG_CO2E_PER_LITRE
            co2_avoided_kg = round(float(max(0.0, solo_baseline - co2_kg)), 3)
        elif mode_roll < 0.90:
            kind = "shuttle"
            distance_km = round(float(rng.uniform(15.0, 45.0)), 2)
            seats_offered = int(rng.choice([14, 20, 32]))
            occupancy = round(float(rng.uniform(8.0, seats_offered)), 1)
            seats_used = int(occupancy)
            litres = distance_km / 7.5  # Diesel shuttle efficiency
            fuel_reimbursed_minor = int(round(litres * 30700))  # 307 LKR diesel
            co2_kg = round(float(litres * 2.68779), 3)
            solo_baseline = (occupancy * (distance_km / 12.0)) * KG_CO2E_PER_LITRE
            co2_avoided_kg = round(float(max(0.0, solo_baseline - co2_kg)), 3)
        else:
            kind = "solo"
            distance_km = round(float(rng.uniform(5.0, 20.0)), 2)
            seats_offered = 1
            seats_used = 1
            occupancy = 1.0
            fuel_reimbursed_minor = 0
            litres = distance_km / KM_PER_LITRE_AVG
            co2_kg = round(float(litres * KG_CO2E_PER_LITRE), 3)
            co2_avoided_kg = 0.0

        # Duration: ~2.5 mins per km
        duration_minutes = int(distance_km * rng.uniform(2.0, 3.2))
        ended_at = started_at + datetime.timedelta(minutes=duration_minutes)

        # Origin / Destination Zones
        origin_zone = rng.choice(ZONES)["id"]
        dest_zone = rng.choice(ZONES)["id"]
        while dest_zone == origin_zone:
            dest_zone = rng.choice(ZONES)["id"]

        trips.append({
            "trip_id": trip_id,
            "company_id": company["id"],
            "department": dept,
            "kind": kind,
            "started_at": started_at.isoformat(),
            "ended_at": ended_at.isoformat(),
            "distance_km": distance_km,
            "occupancy": occupancy,
            "seats_offered": seats_offered,
            "seats_used": seats_used,
            "fuel_reimbursed_minor": fuel_reimbursed_minor,
            "co2_kg": co2_kg,
            "co2_avoided_kg": co2_avoided_kg,
            "origin_zone_id": origin_zone,
            "dest_zone_id": dest_zone,
        })

    return trips


def generate_sql_insert_script(trips: List[Dict[str, Any]], output_filepath: str) -> None:
    print(f"Writing SQL insert script to {output_filepath}...")
    with open(output_filepath, "w", encoding="utf-8") as f:
        f.write("-- Deterministic Seed Data Generated for Module 5 Analytics\n")
        f.write("-- Total Trips: {}\n\n".format(len(trips)))

        # Batch inserts in chunks of 500
        chunk_size = 500
        for i in range(0, len(trips), chunk_size):
            chunk = trips[i:i + chunk_size]
            f.write("INSERT INTO analytics.fact_trips (\n")
            f.write("  trip_id, company_id, department, kind, started_at, ended_at,\n")
            f.write("  distance_km, occupancy, seats_offered, seats_used,\n")
            f.write("  fuel_reimbursed_minor, co2_kg, co2_avoided_kg, origin_zone_id, dest_zone_id\n")
            f.write(") VALUES\n")

            values = []
            for t in chunk:
                v = (
                    f"({t['trip_id']}, {t['company_id']}, '{t['department']}', '{t['kind']}', "
                    f"'{t['started_at']}', '{t['ended_at']}', {t['distance_km']}, {t['occupancy']}, "
                    f"{t['seats_offered']}, {t['seats_used']}, {t['fuel_reimbursed_minor']}, "
                    f"{t['co2_kg']}, {t['co2_avoided_kg']}, {t['origin_zone_id']}, {t['dest_zone_id']})"
                )
                values.append(v)

            f.write(",\n".join(values))
            f.write("\nON CONFLICT (trip_id) DO NOTHING;\n\n")

        # Materialized views refresh
        f.write("-- Refresh Materialized Views Concurrently\n")
        f.write("REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.mv_trips_by_department_day;\n")
        f.write("REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.mv_occupancy_by_route_day;\n")
        f.write("REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.mv_fuel_reimbursed_month;\n")
        f.write("REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.mv_co2_by_company_month;\n")
        f.write("REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.mv_zone_flow_hour;\n")

    print(f"Successfully generated {output_filepath} with {len(trips)} records.")


def main():
    parser = argparse.ArgumentParser(description="Module 5 Deterministic Commute Data Seed Generator")
    parser.add_argument("--count", type=int, default=5000, help="Number of trips to generate (default: 5000)")
    parser.add_argument("--benchmark", action="store_true", help="Generate 200,000+ benchmark dataset")
    parser.add_argument("--output", type=str, default="seed_analytics_facts.sql", help="Output SQL script filename")
    args = parser.parse_args()

    count = 200000 if args.benchmark else args.count
    trips = generate_trip_dataset(total_trips=count, seed=42)
    generate_sql_insert_script(trips, args.output)


if __name__ == "__main__":
    main()
