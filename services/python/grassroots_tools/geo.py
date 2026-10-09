"""Map math and name matching shared by the import and the pre-check."""

from __future__ import annotations

import math
import re
import time
from difflib import SequenceMatcher
from typing import Any

from .web import request_json

EARTH_RADIUS_M = 6_371_000


def distance_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Straight-line distance in meters between two points (the haversine formula)."""
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = p2 - p1
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(a))


# Words that say what kind of place it is, not which place. Dropped before comparing names.
_FILLER = {"the", "park", "field", "fields", "court", "courts", "complex", "center", "centre", "sports", "of", "and", "at"}


def normalize_name(name: str) -> str:
    """'The Eagle Creek Park - Field 1' -> 'eagle creek 1'."""
    words = re.findall(r"[a-z0-9]+", (name or "").lower().replace("&", " and "))
    kept = [w for w in words if w not in _FILLER]
    return " ".join(kept or words)


def name_similarity(a: str, b: str) -> float:
    """0.0 (nothing alike) to 1.0 (same name once filler words are removed)."""
    na, nb = normalize_name(a), normalize_name(b)
    if not na or not nb:
        return 0.0
    return SequenceMatcher(None, na, nb).ratio()


def nearest(lat: float, lon: float, places: list[dict[str, Any]]) -> tuple[dict[str, Any] | None, float]:
    """The closest place with latitude/longitude, and how far away it is in meters."""
    best, best_d = None, math.inf
    for place in places:
        plat, plon = place.get("latitude"), place.get("longitude")
        if plat is None or plon is None:
            continue
        d = distance_m(lat, lon, float(plat), float(plon))
        if d < best_d:
            best, best_d = place, d
    return best, best_d


def street_address(addr: dict[str, Any]) -> str | None:
    """Nominatim's address parts -> '1200 W 38th St', or just the road if there's no number."""
    road = addr.get("road") or addr.get("pedestrian") or addr.get("footway") or addr.get("path")
    if not road:
        return None
    return f"{addr['house_number']} {road}" if addr.get("house_number") else road


class Geocoder:
    """Turns an address into map coordinates using OpenStreetMap's Nominatim.

    Nominatim's free service allows one request per second, so calls are spaced out
    and answers are remembered for the rest of the run.
    """

    URL = "https://nominatim.openstreetmap.org/search"

    def __init__(self) -> None:
        self._cache: dict[str, dict[str, Any] | None] = {}
        self._last_call = 0.0

    def lookup(self, query: str) -> dict[str, Any] | None:
        query = " ".join((query or "").split())
        if not query:
            return None
        if query in self._cache:
            return self._cache[query]

        wait = 1.1 - (time.monotonic() - self._last_call)
        if wait > 0:
            time.sleep(wait)
        self._last_call = time.monotonic()

        results = request_json("GET", self.URL, params={"q": query, "format": "jsonv2", "limit": 1}) or []
        hit = None
        if results:
            r = results[0]
            south, north, west, east = (float(x) for x in r["boundingbox"])
            hit = {
                "latitude": float(r["lat"]),
                "longitude": float(r["lon"]),
                "bbox": (south, west, north, east),
                "label": r.get("display_name", query),
            }
        self._cache[query] = hit
        return hit

    def reverse(self, lat: float, lon: float) -> str | None:
        """Map point -> nearest street address, or None if there isn't one."""
        wait = 1.1 - (time.monotonic() - self._last_call)
        if wait > 0:
            time.sleep(wait)
        self._last_call = time.monotonic()
        r = request_json(
            "GET",
            "https://nominatim.openstreetmap.org/reverse",
            params={"lat": f"{lat:.6f}", "lon": f"{lon:.6f}", "format": "jsonv2", "zoom": 17},
        ) or {}
        return street_address(r.get("address") or {})
