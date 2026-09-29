import os
import urllib.request
import sys

URL = "https://download.geofabrik.de/asia/sri-lanka-latest.osm.pbf"
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "sri-lanka-latest.osm.pbf")

def download_osm():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    if os.path.exists(OUTPUT_FILE):
        size_mb = os.path.getsize(OUTPUT_FILE) / (1024 * 1024)
        print(f"[OSM] File already exists: {OUTPUT_FILE} ({size_mb:.2f} MB)")
        return OUTPUT_FILE

    print(f"[OSM] Downloading Sri Lanka OSM extract from:\n  {URL}\nDestination:\n  {OUTPUT_FILE}")

    def progress_callback(blocks, block_size, total_size):
        downloaded = blocks * block_size
        if total_size > 0:
            percent = min(100.0, downloaded * 100.0 / total_size)
            downloaded_mb = downloaded / (1024 * 1024)
            total_mb = total_size / (1024 * 1024)
            sys.stdout.write(f"\r[OSM] Progress: {percent:.1f}% ({downloaded_mb:.1f} MB / {total_mb:.1f} MB)")
            sys.stdout.flush()

    urllib.request.urlretrieve(URL, OUTPUT_FILE, reporthook=progress_callback)
    print("\n[OSM] Download complete successfully!")
    return OUTPUT_FILE

if __name__ == "__main__":
    download_osm()
