#!/usr/bin/env python3
"""Give indexed photo locations approximate names without uploading GPS coordinates.

GeoNames cities1000.zip is downloaded separately from
https://download.geonames.org/export/dump/ and is licensed CC BY 4.0.
This tool reads the photo index and the local gazetteer, then stores only one
approximate city label per occupied 0.1-degree photo cluster in the index.
"""

import argparse
import datetime
import math
import re
import sqlite3
import zipfile
from collections import defaultdict
from pathlib import Path


def city_name(name, alternatives):
    chinese = [part for part in alternatives.split(",")
               if re.fullmatch(r"[\u3400-\u9fff]{2,8}", part)]
    return min(chinese, key=len) if chinese else name


def load_cities(path):
    buckets = defaultdict(list)
    with zipfile.ZipFile(path) as archive, archive.open("cities1000.txt") as source:
        for raw in source:
            row = raw.decode("utf-8").rstrip("\n").split("\t")
            if len(row) < 15:
                continue
            try:
                lat, lng = float(row[4]), float(row[5])
            except ValueError:
                continue
            if not -90 <= lat <= 90 or not -180 <= lng <= 180:
                continue
            name = city_name(row[1], row[3])
            buckets[(math.floor(lat / 2), math.floor(lng / 2))].append(
                (lat, lng, name, row[8], int(row[14] or 0)))
    return buckets


def distance_km(lat1, lng1, lat2, lng2):
    a, b = math.radians(lat1), math.radians(lat2)
    dlat, dlng = b - a, math.radians(lng2 - lng1)
    h = math.sin(dlat / 2) ** 2 + math.cos(a) * math.cos(b) * math.sin(dlng / 2) ** 2
    return 12742 * math.asin(min(1, math.sqrt(h)))


def nearest_city(buckets, lat, lng, maximum_km=50):
    key = (math.floor(lat / 2), math.floor(lng / 2))
    best = None
    for dlat in range(-2, 3):
        for dlng in range(-3, 4):
            for item in buckets.get((key[0] + dlat, key[1] + dlng), ()):
                distance = distance_km(lat, lng, item[0], item[1])
                if distance <= maximum_km and (best is None or distance < best[0]):
                    best = (distance, item)
    return best


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--index-db", type=Path, required=True)
    parser.add_argument("--cities-zip", type=Path, required=True)
    parser.add_argument("--maximum-km", type=float, default=50)
    args = parser.parse_args()
    buckets = load_cities(args.cities_zip)
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    with sqlite3.connect(args.index_db, timeout=30) as conn:
        conn.execute("""CREATE TABLE IF NOT EXISTS photo_place_labels (
            key TEXT PRIMARY KEY, latitude REAL NOT NULL, longitude REAL NOT NULL,
            label TEXT NOT NULL, source TEXT NOT NULL, distance_km REAL,
            updated_at TEXT NOT NULL)""")
        source = conn.execute("SELECT source_id FROM scan_runs ORDER BY id DESC LIMIT 1").fetchone()
        if not source:
            print("No completed photo scan found")
            return
        clusters = conn.execute("""SELECT round(latitude,1),round(longitude,1),
                   avg(latitude),avg(longitude),count(*)
            FROM media_files WHERE source_id=? AND status='active'
              AND kind IN ('image','video') AND latitude BETWEEN -90 AND 90
              AND longitude BETWEEN -180 AND 180
            GROUP BY round(latitude,1),round(longitude,1)""", (source[0],)).fetchall()
        named = 0
        for lat, lng, mean_lat, mean_lng, _count in clusters:
            key = f"approx:{lat:.1f},{lng:.1f}"
            existing = conn.execute("SELECT source FROM photo_place_labels WHERE key=?", (key,)).fetchone()
            if existing and existing[0] != "geonames-city":
                continue
            found = nearest_city(buckets, mean_lat, mean_lng, args.maximum_km)
            if found is None:
                continue
            distance, city = found
            label = f"{city[2]} · {city[3]}"
            conn.execute("""INSERT INTO photo_place_labels
                (key,latitude,longitude,label,source,distance_km,updated_at)
                VALUES (?,?,?,?,?,?,?) ON CONFLICT(key) DO UPDATE SET
                  latitude=excluded.latitude, longitude=excluded.longitude,
                  label=excluded.label, source=excluded.source,
                  distance_km=excluded.distance_km, updated_at=excluded.updated_at""",
                (key, mean_lat, mean_lng, label, "geonames-city", distance, now))
            named += 1
        conn.commit()
    print(f"clusters={len(clusters)} named={named} unmatched={len(clusters)-named}")


if __name__ == "__main__":
    main()
