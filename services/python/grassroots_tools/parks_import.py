"""parks-import: find public sports fields on OpenStreetMap and add them as venues.

How it works:
  1. Look up the city's bounding box (Nominatim).
  2. Ask OpenStreetMap (the Overpass API) for every sports pitch in that box, plus every park.
  3. Many pitches have no name, so each one borrows the name of the park it sits in.
  4. Pitches in the same park become one venue, with all their sports combined.
  5. Anything already in your parks table (close by, or with the same name) is skipped.
  6. Writes a preview to out/. Only with --commit does it add rows to Supabase.

Imported venues come in unverified, so Explore shows them as "Not yet verified"
until an owner claims and verifies them.

Map data (c) OpenStreetMap contributors, available under the Open Database License.
"""

from __future__ import annotations

import csv
import json
from dataclasses import dataclass, field
from datetime import date
from typing import Any

from .config import OUT_DIR
from .geo import Geocoder, distance_m, name_similarity, nearest, normalize_name
from .web import request_json

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

# OpenStreetMap sport tag -> the sport ids the app uses (see SPORTS in ExploreScreen.js)
SPORT_MAP = {
    "soccer": "soccer",
    "basketball": "basketball",
    "american_football": "flag_football",
    "athletics": "track",
    "running": "track",
    "ultimate": "ultimate",
}

PARK_RADIUS_M = 400       # an unnamed pitch borrows the name of a park this close
GROUP_RADIUS_M = 600      # pitches with the same name this close become one venue
DUPLICATE_RADIUS_M = 150  # anything this close to an existing venue is skipped
SAME_NAME_RADIUS_M = 1000 # same name within this distance counts as a duplicate too


@dataclass
class Pitch:
    latitude: float
    longitude: float
    sports: set[str]
    name: str | None


@dataclass
class Venue:
    name: str
    latitude: float
    longitude: float
    sports: set[str] = field(default_factory=set)
    pitch_count: int = 1


def overpass_query(bbox: tuple[float, float, float, float]) -> str:
    south, west, north, east = bbox
    box = f"{south},{west},{north},{east}"
    sports = "|".join(SPORT_MAP)
    return f"""
[out:json][timeout:90];
(
  nwr["leisure"="pitch"]["sport"~"{sports}"]({box});
  nwr["leisure"~"^(park|recreation_ground)$"]["name"]({box});
);
out center tags;
"""


def parse_overpass(elements: list[dict[str, Any]]) -> tuple[list[Pitch], list[dict[str, Any]]]:
    """Split the Overpass answer into pitches and named parks."""
    pitches: list[Pitch] = []
    parks: list[dict[str, Any]] = []
    for el in elements:
        tags = el.get("tags", {})
        # Nodes have lat/lon; ways and areas come back with a "center" point instead.
        lat = el.get("lat", el.get("center", {}).get("lat"))
        lon = el.get("lon", el.get("center", {}).get("lon"))
        if lat is None or lon is None:
            continue

        if tags.get("leisure") == "pitch":
            osm_sports = {s.strip() for s in tags.get("sport", "").split(";")}
            sports = {SPORT_MAP[s] for s in osm_sports if s in SPORT_MAP}
            if sports:
                pitches.append(Pitch(float(lat), float(lon), sports, tags.get("name")))
        elif tags.get("name"):
            parks.append({"name": tags["name"], "latitude": float(lat), "longitude": float(lon)})
    return pitches, parks


def group_into_venues(pitches: list[Pitch], parks: list[dict[str, Any]]) -> list[Venue]:
    """Name each pitch, then merge pitches that share a name and sit close together."""
    venues: list[Venue] = []
    for pitch in pitches:
        name = pitch.name
        # A pitch's own name is often just "Field 2"; the park name is more useful then.
        park, park_d = nearest(pitch.latitude, pitch.longitude, parks)
        if park is not None and park_d <= PARK_RADIUS_M:
            if not name or len(normalize_name(name)) <= 2:
                name = park["name"]
        if not name:
            continue  # no name and no park nearby: nothing a player would recognize

        match = next(
            (
                v
                for v in venues
                if normalize_name(v.name) == normalize_name(name)
                and distance_m(v.latitude, v.longitude, pitch.latitude, pitch.longitude) <= GROUP_RADIUS_M
            ),
            None,
        )
        if match is None:
            venues.append(Venue(name, pitch.latitude, pitch.longitude, set(pitch.sports)))
        else:
            # Keep a running average so the pin lands in the middle of the fields.
            n = match.pitch_count
            match.latitude = (match.latitude * n + pitch.latitude) / (n + 1)
            match.longitude = (match.longitude * n + pitch.longitude) / (n + 1)
            match.sports |= pitch.sports
            match.pitch_count += 1
    return venues


def is_duplicate(venue: Venue, existing: list[dict[str, Any]]) -> tuple[bool, str]:
    """Is this venue already in the parks table? Returns (yes/no, reason)."""
    for park in existing:
        if park.get("latitude") is None or park.get("longitude") is None:
            continue
        d = distance_m(venue.latitude, venue.longitude, float(park["latitude"]), float(park["longitude"]))
        if d <= DUPLICATE_RADIUS_M:
            return True, f"{d:.0f} m from {park.get('name')}"
        if d <= SAME_NAME_RADIUS_M and name_similarity(venue.name, park.get("name", "")) >= 0.85:
            return True, f"same name as {park.get('name')} ({d:.0f} m away)"
    return False, ""


def run(db, *, city: str, state: str, commit: bool, limit: int | None = None) -> dict[str, Any]:
    geocoder = Geocoder()
    place = geocoder.lookup(f"{city}, {state}, USA")
    if place is None:
        raise SystemExit(f"Couldn't find {city}, {state} on the map. Check the spelling.")
    print(f"Searching {place['label']}")

    answer = request_json("POST", OVERPASS_URL, form={"data": overpass_query(place["bbox"])}, timeout=120)
    pitches, parks = parse_overpass(answer.get("elements", []))
    venues = group_into_venues(pitches, parks)
    print(f"Found {len(pitches)} sports pitches in {len(parks)} named parks -> {len(venues)} possible venues")

    existing = db.select("parks", "park_id,name,latitude,longitude")
    new, skipped = [], []
    for v in sorted(venues, key=lambda v: (-v.pitch_count, v.name)):
        dup, why = is_duplicate(v, existing)
        (skipped if dup else new).append((v, why))
    if limit is not None:
        new = new[:limit]

    rows = [
        {
            "name": v.name[:80],
            "sports": sorted(v.sports),
            "latitude": round(v.latitude, 6),
            "longitude": round(v.longitude, 6),
            "city": city,
            "state": state,
            "status": "active",
        }
        for v, _ in new
    ]

    OUT_DIR.mkdir(exist_ok=True)
    stamp = f"{normalize_name(city).replace(' ', '-')}-{date.today().isoformat()}"
    preview = OUT_DIR / f"parks-import-{stamp}.csv"
    with preview.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["action", "name", "sports", "pitches", "latitude", "longitude", "reason"])
        for v, _ in new:
            w.writerow(["add", v.name, " ".join(sorted(v.sports)), v.pitch_count, f"{v.latitude:.6f}", f"{v.longitude:.6f}", ""])
        for v, why in skipped:
            w.writerow(["skip", v.name, " ".join(sorted(v.sports)), v.pitch_count, f"{v.latitude:.6f}", f"{v.longitude:.6f}", why])

    print(f"{len(rows)} new, {len(skipped)} already in Grassroots. Preview: {preview}")

    inserted = 0
    if commit and rows:
        inserted = len(db.insert("parks", rows))
        print(f"Added {inserted} venues to Supabase (unverified).")
    elif rows:
        print("Dry run: nothing was added. Check the preview, then run again with --commit.")

    summary = {"new": len(rows), "skipped": len(skipped), "inserted": inserted, "preview": str(preview)}
    (OUT_DIR / f"parks-import-{stamp}.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    return summary
