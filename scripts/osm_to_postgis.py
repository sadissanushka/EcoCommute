"""
OSM PBF to PostGIS ETL Pipeline for Sri Lanka
Parses road network (drivable highways), computes edge weights,
and populates road_nodes and road_edges tables.
"""

import os
import sys
import math
import osmium
import psycopg2
from psycopg2.extras import execute_batch

DB_CONFIG = {
    "dbname": os.environ.get("DB_NAME", "corporate_shuttle"),
    "user": os.environ.get("DB_USER", "postgres"),
    "password": os.environ.get("DB_PASSWORD", "postgres"),
    "host": os.environ.get("DB_HOST", "localhost"),
    "port": int(os.environ.get("DB_PORT", 5432)),
}

SPEED_LOOKUP_KMH = {
    "motorway": 100.0,
    "motorway_link": 60.0,
    "trunk": 70.0,
    "trunk_link": 50.0,
    "primary": 60.0,
    "primary_link": 40.0,
    "secondary": 50.0,
    "secondary_link": 35.0,
    "tertiary": 40.0,
    "tertiary_link": 30.0,
    "residential": 30.0,
    "living_street": 20.0,
    "service": 20.0,
    "unclassified": 35.0,
}

ACCEPTED_HIGHWAYS = set(SPEED_LOOKUP_KMH.keys())

def haversine_m(lat1, lon1, lat2, lon2):
    r = 6371000.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi / 2.0)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0)**2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return r * c

class RoadNetworkHandler(osmium.SimpleHandler):
    def __init__(self, max_edges=None):
        super().__init__()
        self.nodes = {}       # node_id -> (lat, lon)
        self.edges = []       # [(source, target, distance_m, speed_kmh, is_oneway, line_wkt)]
        self.max_edges = max_edges

    def way(self, w):
        if self.max_edges and len(self.edges) >= self.max_edges:
            return

        highway = w.tags.get("highway")
        if highway not in ACCEPTED_HIGHWAYS:
            return

        if len(w.nodes) < 2:
            return

        speed = SPEED_LOOKUP_KMH.get(highway, 40.0)
        oneway_tag = w.tags.get("oneway", "no").lower()
        junction = w.tags.get("junction", "").lower()

        is_oneway = oneway_tag in ("yes", "true", "1") or junction == "roundabout"
        is_reverse_oneway = oneway_tag == "-1"

        try:
            coords = [(n.ref, n.lat, n.lon) for n in w.nodes]
        except osmium.InvalidLocationError:
            # Nodes without location cache
            return

        for i in range(len(coords) - 1):
            n1_id, lat1, lon1 = coords[i]
            n2_id, lat2, lon2 = coords[i + 1]

            self.nodes[n1_id] = (lat1, lon1)
            self.nodes[n2_id] = (lat2, lon2)

            dist_m = haversine_m(lat1, lon1, lat2, lon2)
            if dist_m < 0.1:
                continue

            line_wkt = f"SRID=4326;LINESTRING({lon1} {lat1}, {lon2} {lat2})"

            if is_reverse_oneway:
                self.edges.append((n2_id, n1_id, dist_m, speed, True, f"SRID=4326;LINESTRING({lon2} {lat2}, {lon1} {lat1})"))
            else:
                self.edges.append((n1_id, n2_id, dist_m, speed, is_oneway, line_wkt))

def import_to_postgis(pbf_path, limit_edges=None):
    print(f"[ETL] Parsing OSM PBF: {pbf_path}")
    handler = RoadNetworkHandler(max_edges=limit_edges)
    
    # Use location cache to enable node coordinates inside ways
    handler.apply_file(pbf_path, locations=True, idx='flex_mem')

    print(f"[ETL] Extracted {len(handler.nodes)} unique road vertices and {len(handler.edges)} road segments.")

    print(f"[ETL] Connecting to PostgreSQL at {DB_CONFIG['host']}:{DB_CONFIG['port']}...")
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()

    try:
        print("[ETL] Clearing existing graph tables...")
        cur.execute("TRUNCATE road_edges, road_nodes RESTART IDENTITY CASCADE;")

        print(f"[ETL] Inserting {len(handler.nodes)} nodes into road_nodes...")
        node_records = [
            (nid, f"SRID=4326;POINT({lon} {lat})")
            for nid, (lat, lon) in handler.nodes.items()
        ]
        execute_batch(
            cur,
            "INSERT INTO road_nodes (id, geom) VALUES (%s, ST_GeomFromEWKT(%s)) ON CONFLICT (id) DO NOTHING;",
            node_records,
            page_size=5000
        )
        conn.commit()
        print("[ETL] Nodes inserted.")

        print(f"[ETL] Inserting {len(handler.edges)} edges into road_edges...")
        edge_records = [
            (src, tgt, round(dist, 2), speed, is_oneway, line_wkt)
            for src, tgt, dist, speed, is_oneway, line_wkt in handler.edges
        ]
        execute_batch(
            cur,
            """
            INSERT INTO road_edges (source, target, distance_m, speed_kmh, is_oneway, geom)
            VALUES (%s, %s, %s, %s, %s, ST_GeomFromEWKT(%s));
            """,
            edge_records,
            page_size=5000
        )
        conn.commit()
        print("[ETL] Edges inserted.")

        cur.execute("SELECT COUNT(*) FROM road_nodes;")
        node_cnt = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM road_edges;")
        edge_cnt = cur.fetchone()[0]
        print(f"[ETL] Ingestion complete! Total road_nodes: {node_cnt}, Total road_edges: {edge_cnt}")

    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    pbf_file = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "data", "sri-lanka-latest.osm.pbf")
    limit = int(sys.argv[2]) if len(sys.argv) > 2 else None
    if not os.path.exists(pbf_file):
        print(f"Error: PBF file not found at {pbf_file}. Run scripts/download_osm.py first.")
        sys.exit(1)
    import_to_postgis(pbf_file, limit_edges=limit)
