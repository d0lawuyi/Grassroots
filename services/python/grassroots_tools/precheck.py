"""precheck: look over new venue submissions before an admin does.

For every submission waiting for review, it runs the same four checks the admin
does by hand (ownership, location, pricing, legitimacy) and saves what it finds
to the venue_prechecks table. The admin review screen shows the findings, so the
admin starts with the likely problems already pointed out.

It never approves or rejects anything. A person still makes every decision.

Each finding has a level:
  flag  something is probably wrong; the admin should look before approving
  warn  worth a second look
  ok    passed
The score starts at 100 and drops 25 per flag and 8 per warning.
"""

from __future__ import annotations

import re
import statistics
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Any

from . import __version__
from .geo import Geocoder, distance_m, name_similarity, nearest

DUPLICATE_RADIUS_M = 150     # another venue this close is probably the same place
SIMILAR_NAME_RADIUS_M = 2000 # a near-identical name within this distance is suspicious
ADDRESS_WARN_M = 300         # pin and address disagree by this much: worth a look
ADDRESS_FLAG_M = 1000        # ...by this much: probably wrong
PRICE_CEILING = 500          # dollars per hour; anything above is almost certainly a typo
PRICE_WARN_X = 2.5           # this many times the local typical price: worth a look
PRICE_FLAG_X = 4.0           # ...this many times: probably wrong
MIN_PRICE_SAMPLES = 3        # need at least this many paid venues to judge "typical"

URL_RE = re.compile(r"(https?://|www\.)\S+|\b\S+\.(com|net|org|io|co)\b", re.I)
PHONE_RE = re.compile(r"(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}")
EMAIL_RE = re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.]+\b")


@dataclass
class Finding:
    check: str     # ownership | location | pricing | legitimacy
    level: str     # flag | warn | ok
    message: str


def score(findings: list[Finding]) -> int:
    penalty = sum(25 if f.level == "flag" else 8 if f.level == "warn" else 0 for f in findings)
    return max(0, 100 - penalty)


def _has_contact_info(text: str) -> bool:
    return bool(URL_RE.search(text) or PHONE_RE.search(text) or EMAIL_RE.search(text))


def check_ownership(sub: dict[str, Any]) -> list[Finding]:
    if not sub.get("proof_path"):
        return [Finding("ownership", "flag", "No proof of ownership or management was uploaded.")]
    return [Finding("ownership", "ok", "Proof document uploaded. Open it to confirm the name matches.")]


def check_location(sub: dict[str, Any], parks: list[dict[str, Any]], address_point: dict[str, Any] | bool | None) -> list[Finding]:
    """address_point: where the typed address is on the map, False if the lookup found
    nothing, or None if no lookup was done (for example with --no-geocode)."""
    lat, lon = sub.get("latitude"), sub.get("longitude")
    if lat is None or lon is None:
        return [Finding("location", "flag", "No map pin was dropped.")]
    lat, lon = float(lat), float(lon)
    out: list[Finding] = []

    if isinstance(address_point, dict):
        d = distance_m(lat, lon, address_point["latitude"], address_point["longitude"])
        if d > ADDRESS_FLAG_M:
            out.append(Finding("location", "flag", f"The pin is {d / 1000:.1f} km from the address they typed."))
        elif d > ADDRESS_WARN_M:
            out.append(Finding("location", "warn", f"The pin is {d:.0f} m from the address. Could be a big park, or a wrong pin."))
    elif address_point is False and sub.get("address"):
        out.append(Finding("location", "warn", "The address couldn't be found on the map."))

    others = [p for p in parks if str(p.get("park_id")) != str(sub.get("park_id"))]
    near, d = nearest(lat, lon, others)
    if near is not None and d <= DUPLICATE_RADIUS_M:
        out.append(Finding("location", "flag", f"{d:.0f} m from \"{near.get('name')}\", which is already listed. Possible duplicate."))
    else:
        for p in others:
            if p.get("latitude") is None or p.get("longitude") is None:
                continue
            pd = distance_m(lat, lon, float(p["latitude"]), float(p["longitude"]))
            if pd <= SIMILAR_NAME_RADIUS_M and name_similarity(sub.get("name", ""), p.get("name", "")) >= 0.85:
                out.append(Finding("location", "warn", f"Very similar name to \"{p.get('name')}\", {pd:.0f} m away."))
                break

    if not any(f.level != "ok" for f in out):
        out.append(Finding("location", "ok", "Pin matches the address and no other venue is on top of it."))
    return out


def typical_price(sports: list[str], parks: list[dict[str, Any]]) -> float | None:
    """Median hourly rate of paid venues offering any of the same sports."""
    prices = [
        float(p["hourly_rate"])
        for p in parks
        if p.get("hourly_rate") not in (None, "")
        and float(p["hourly_rate"]) > 0
        and set(p.get("sports") or []) & set(sports or [])
    ]
    if len(prices) < MIN_PRICE_SAMPLES:
        return None
    return statistics.median(prices)


def check_pricing(sub: dict[str, Any], parks: list[dict[str, Any]]) -> list[Finding]:
    free = bool(sub.get("is_free"))
    rate = sub.get("hourly_rate")
    rate = float(rate) if rate not in (None, "") else None

    if free:
        if rate:
            return [Finding("pricing", "warn", f"Marked free but also has a ${rate:.2f}/hour rate.")]
        return [Finding("pricing", "ok", "Free to play.")]
    if not rate:
        return [Finding("pricing", "flag", "Marked as paid but no hourly rate was entered.")]
    if rate > PRICE_CEILING:
        return [Finding("pricing", "flag", f"${rate:.2f}/hour is very high. Possibly a typo (a daily or season price?).")]

    typical = typical_price(sub.get("sports") or [], parks)
    if typical is None:
        return [Finding("pricing", "ok", f"${rate:.2f}/hour. Not enough nearby paid venues to compare yet.")]
    times = rate / typical
    if times >= PRICE_FLAG_X:
        return [Finding("pricing", "flag", f"${rate:.2f}/hour is {times:.1f}x the typical ${typical:.2f} for these sports.")]
    if times >= PRICE_WARN_X:
        return [Finding("pricing", "warn", f"${rate:.2f}/hour is {times:.1f}x the typical ${typical:.2f}.")]
    return [Finding("pricing", "ok", f"${rate:.2f}/hour, in line with the typical ${typical:.2f}.")]


def check_legitimacy(sub: dict[str, Any]) -> list[Finding]:
    out: list[Finding] = []
    photos = sub.get("photos") or []
    if len(photos) == 0:
        out.append(Finding("legitimacy", "flag", "No photos of the field."))
    elif len(photos) == 1:
        out.append(Finding("legitimacy", "warn", "Only one photo. Ask for a few more angles."))

    if not sub.get("sports"):
        out.append(Finding("legitimacy", "flag", "No sports were picked."))

    name = (sub.get("name") or "").strip()
    if _has_contact_info(name):
        out.append(Finding("legitimacy", "flag", "The venue name contains a link, phone number or email."))
    elif len(name) >= 6 and name.isupper():
        out.append(Finding("legitimacy", "warn", "The name is all capitals."))

    free_text = " ".join(str(sub.get(k) or "") for k in ("rules", "availability", "parking"))
    if _has_contact_info(free_text):
        out.append(Finding("legitimacy", "warn", "Rules or availability include contact details. Bookings should go through the app."))

    if not any(f.level != "ok" for f in out):
        out.append(Finding("legitimacy", "ok", f"{len(photos)} photos, sports picked, nothing unusual in the text."))
    return out


def evaluate(sub: dict[str, Any], parks: list[dict[str, Any]], address_point: dict[str, Any] | bool | None) -> tuple[int, list[Finding]]:
    """Run all four checks on one submission. Pure function: no network, easy to test."""
    findings = (
        check_ownership(sub)
        + check_location(sub, parks, address_point)
        + check_pricing(sub, parks)
        + check_legitimacy(sub)
    )
    return score(findings), findings


def _when(stamp: str | None) -> datetime:
    """Database timestamp text -> datetime, so times compare correctly."""
    if not stamp:
        return datetime.min.replace(tzinfo=timezone.utc)
    return datetime.fromisoformat(stamp.replace("Z", "+00:00"))


def run(db, *, recheck: bool = False, geocode: bool = True) -> list[dict[str, Any]]:
    submissions = db.select("venue_submissions", "*", status="eq.submitted", order="submitted_at.asc")
    if not submissions:
        print("No submissions are waiting for review.")
        return []

    done = {r["submission_id"]: r["checked_at"] for r in db.select("venue_prechecks", "submission_id,checked_at")}
    parks = db.select("parks", "park_id,name,latitude,longitude,sports,hourly_rate")
    geocoder = Geocoder() if geocode else None

    results = []
    for sub in submissions:
        sid = sub["submission_id"]
        # Skip ones already checked, unless the owner resubmitted after the last check.
        if not recheck and sid in done and _when(sub.get("submitted_at")) <= _when(done[sid]):
            continue

        address_point = None
        if geocoder and sub.get("address"):
            query = ", ".join(x for x in (sub.get("address"), sub.get("city"), sub.get("state")) if x)
            address_point = geocoder.lookup(query) or False  # False = looked up, not found

        total, findings = evaluate(sub, parks, address_point)
        results.append(
            {
                "submission_id": sid,
                "score": total,
                "findings": [asdict(f) for f in findings],
                "tool_version": __version__,
                "checked_at": datetime.now(timezone.utc).isoformat(),
            }
        )
        flags = sum(f.level == "flag" for f in findings)
        warns = sum(f.level == "warn" for f in findings)
        print(f"  {sub.get('name', '?')[:40]:40}  score {total:3}  {flags} flags, {warns} warnings")

    if results:
        # Upsert so a resubmitted venue replaces its old pre-check.
        db.upsert("venue_prechecks", results, on_conflict="submission_id")
        print(f"Saved {len(results)} pre-checks. Admins will see them on the review screen.")
    else:
        print("Everything waiting has already been checked. Use --recheck to run them again.")
    return results
