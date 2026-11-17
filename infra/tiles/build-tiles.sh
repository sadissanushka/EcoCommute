#!/usr/bin/env bash
# Planetiler Sri Lanka Vector Tile Build Pipeline (Module 1 — Step 4.1)
# Downloads Sri Lanka OSM PBF from Geofabrik and generates sri-lanka.mbtiles
# for self-hosted serving via tileserver-gl (zero external API keys).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="${SCRIPT_DIR}/data"
PBF_FILE="${DATA_DIR}/sri-lanka-latest.osm.pbf"
MBTILES_FILE="${DATA_DIR}/sri-lanka.mbtiles"
GEOFABRIK_URL="https://download.geofabrik.de/asia/sri-lanka-latest.osm.pbf"

mkdir -p "${DATA_DIR}"

if [ ! -f "${PBF_FILE}" ]; then
  echo "[Planetiler] Downloading Sri Lanka OSM PBF from Geofabrik..."
  curl -L --fail --retry 3 -o "${PBF_FILE}" "${GEOFABRIK_URL}"
else
  echo "[Planetiler] Using cached PBF: ${PBF_FILE}"
fi

echo "[Planetiler] Building vector MBTiles archive..."
docker run --rm \
  -e JAVA_TOOL_OPTIONS="-Xmx4g" \
  -v "${DATA_DIR}:/data" \
  ghcr.io/onthegomap/planetiler:latest \
  --osm-path=/data/sri-lanka-latest.osm.pbf \
  --output=/data/sri-lanka.mbtiles \
  --download

echo "[Planetiler] Build complete: ${MBTILES_FILE}"
