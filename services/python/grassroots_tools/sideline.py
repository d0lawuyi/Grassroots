"""sideline: build this week's issue of The Sideline, the Grassroots newsletter.

It reads the last 7 days from Supabase and writes two files to out/:
  sideline-YYYY-MM-DD.html   open it in a browser to preview the email
  sideline-YYYY-MM-DD.txt    the plain-text version email apps show as a fallback

What goes in:
  - the week in numbers (games played, players, new verified venues)
  - player of the week: only players who said yes to being featured (users.sideline_feature)
  - the busiest venue of the week
  - new verified venues
  - games coming up in the next 7 days that still have room

Sending the email is a later step. For now you review the preview, which is the
safe way to start with anything that goes to real people.
"""

from __future__ import annotations

import html
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any

from .config import OUT_DIR

SPORT_LABEL = {
    "soccer": "Soccer",
    "basketball": "Basketball",
    "flag_football": "Flag football",
    "track": "Track",
    "ultimate": "Ultimate",
}

# Clubhouse colors, written out because email apps ignore external stylesheets
CREAM, PAPER, INK, MUTE, FOREST, CLAY, SAGE = "#F4F0E6", "#FFFDF8", "#172019", "#59625B", "#17442F", "#B9441B", "#D5E2D0"


@dataclass
class Digest:
    week_start: datetime
    week_end: datetime
    games_played: int = 0
    players: int = 0
    player_of_week: dict[str, Any] | None = None
    busiest_venue: dict[str, Any] | None = None
    new_venues: list[dict[str, Any]] = field(default_factory=list)
    upcoming: list[dict[str, Any]] = field(default_factory=list)


def _ts(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def display_name(full_name: str | None) -> str:
    """'Danny Olawuyi' -> 'Danny O.' Never print a full surname in a newsletter."""
    parts = (full_name or "").split()
    if not parts:
        return "A Grassroots player"
    return parts[0] if len(parts) == 1 else f"{parts[0]} {parts[-1][0]}."


def sport_label(sport: str | None) -> str:
    return SPORT_LABEL.get(sport or "", (sport or "Pickup").replace("_", " ").capitalize())


def build_digest(
    *,
    now: datetime,
    games: list[dict[str, Any]],
    bookings: list[dict[str, Any]],
    users: list[dict[str, Any]],
    parks: list[dict[str, Any]],
) -> Digest:
    """Work out the newsletter's content. Pure function: give it rows, get a Digest back."""
    start = now - timedelta(days=7)
    soon = now + timedelta(days=7)
    d = Digest(week_start=start, week_end=now)

    played = [g for g in games if _ts(g.get("end_time")) and start < _ts(g["end_time"]) <= now]
    played_ids = {g["game_id"] for g in played}
    week_bookings = [b for b in bookings if b.get("game_id") in played_ids]

    d.games_played = len(played)
    d.players = len({b["player_id"] for b in week_bookings})

    # Player of the week: games played + 1.5 per game hosted. Opted-in players only.
    featured = {u["user_id"]: u for u in users if u.get("sideline_feature")}
    points: Counter[str] = Counter()
    played_count: Counter[str] = Counter()
    hosted_count: Counter[str] = Counter()
    for b in week_bookings:
        played_count[b["player_id"]] += 1
        points[b["player_id"]] += 1
    for g in played:
        if g.get("organizer_id"):
            hosted_count[g["organizer_id"]] += 1
            points[g["organizer_id"]] += 1.5
    ranked = sorted(
        (uid for uid in points if uid in featured),
        key=lambda uid: (-points[uid], display_name(featured[uid].get("full_name"))),
    )
    if ranked:
        top = ranked[0]
        d.player_of_week = {
            "name": display_name(featured[top].get("full_name")),
            "played": played_count[top],
            "hosted": hosted_count[top],
        }

    # Busiest venue: the most games played there this week.
    by_park: Counter[str] = Counter(str(g.get("park_id")) for g in played if g.get("park_id") is not None)
    park_names = {str(p["park_id"]): p.get("name", "A local field") for p in parks}
    if by_park:
        pid, count = sorted(by_park.items(), key=lambda kv: (-kv[1], park_names.get(kv[0], "")))[0]
        d.busiest_venue = {"name": park_names.get(pid, "A local field"), "games": count}

    d.new_venues = sorted(
        (
            {"name": p.get("name"), "city": p.get("city"), "sports": p.get("sports") or []}
            for p in parks
            if (_ts(p.get("verified_at")) or start) > start
        ),
        key=lambda v: v["name"] or "",
    )

    # Upcoming games with open spots, soonest first, at most 5.
    joined: defaultdict[Any, int] = defaultdict(int)
    for b in bookings:
        joined[b.get("game_id")] += 1
    upcoming = []
    for g in games:
        when = _ts(g.get("start_time"))
        if not when or not (now < when <= soon):
            continue
        cap = g.get("max_players")
        if cap and joined[g["game_id"]] >= cap:
            continue
        upcoming.append(
            {
                "title": g.get("title") or "Pickup game",
                "sport": sport_label(g.get("sport")),
                "when": when,
                "venue": park_names.get(str(g.get("park_id")), "TBA"),
                "spots": (cap - joined[g["game_id"]]) if cap else None,
            }
        )
    d.upcoming = sorted(upcoming, key=lambda u: u["when"])[:5]
    return d


def _when(dt: datetime) -> str:
    """'Sat Oct 10, 4:00 PM UTC'. Built by hand because %-d only works on Mac and Linux.

    Shown in UTC for now; each reader's own time zone comes with sending.
    """
    hour = dt.hour % 12 or 12
    return f"{dt:%a %b} {dt.day}, {hour}:{dt.minute:02d} {'AM' if dt.hour < 12 else 'PM'} UTC"


def render_text(d: Digest) -> str:
    lines = [
        "THE SIDELINE",
        f"Week of {d.week_start:%b %d} to {d.week_end:%b %d}",
        "",
        f"{d.games_played} games played by {d.players} players.",
    ]
    if d.player_of_week:
        p = d.player_of_week
        lines += ["", f"PLAYER OF THE WEEK: {p['name']} ({p['played']} played, {p['hosted']} hosted)"]
    if d.busiest_venue:
        lines += ["", f"BUSIEST FIELD: {d.busiest_venue['name']} ({d.busiest_venue['games']} games)"]
    if d.new_venues:
        lines += ["", "NEW VERIFIED VENUES"] + [f"- {v['name']}" + (f", {v['city']}" if v.get("city") else "") for v in d.new_venues]
    if d.upcoming:
        lines += ["", "THIS WEEK, STILL ROOM"] + [f"- {u['title']} ({u['sport']}) at {u['venue']}, {_when(u['when'])}" for u in d.upcoming]
    lines += ["", "See you on the field.", "Grassroots"]
    return "\n".join(lines) + "\n"


def render_html(d: Digest) -> str:
    """Email-safe HTML: tables for layout, inline styles, every bit of user text escaped."""
    e = html.escape

    def section(title: str, body: str) -> str:
        return (
            f'<tr><td style="padding:22px 28px 0">'
            f'<div style="font:700 11px/1.4 Arial,sans-serif;letter-spacing:2px;color:{FOREST};text-transform:uppercase">{e(title)}</div>'
            f"{body}</td></tr>"
        )

    def stat(value: Any, label: str) -> str:
        return (
            f'<td align="center" width="33%" style="padding:14px 6px;background:{CREAM};border-radius:12px">'
            f'<div style="font:700 26px Georgia,serif;color:{FOREST}">{e(str(value))}</div>'
            f'<div style="font:600 11px Arial,sans-serif;color:{MUTE};letter-spacing:1px">{e(label)}</div></td>'
        )

    parts = [
        section(
            "The week in numbers",
            '<table role="presentation" width="100%" cellspacing="8" style="margin-top:6px"><tr>'
            + stat(d.games_played, "GAMES")
            + stat(d.players, "PLAYERS")
            + stat(len(d.new_venues), "NEW VENUES")
            + "</tr></table>",
        )
    ]
    if d.player_of_week:
        p = d.player_of_week
        parts.append(
            section(
                "Player of the week",
                f'<div style="margin-top:8px;padding:16px;background:{SAGE};border-radius:14px">'
                f'<div style="font:700 22px Georgia,serif;color:{INK}">{e(p["name"])}</div>'
                f'<div style="font:15px Arial,sans-serif;color:{INK};margin-top:4px">'
                f'Played {p["played"]} and hosted {p["hosted"]} this week. Thanks for keeping games going.</div></div>',
            )
        )
    if d.busiest_venue:
        b = d.busiest_venue
        parts.append(
            section(
                "Busiest field",
                f'<p style="font:15px/1.5 Arial,sans-serif;color:{INK};margin:8px 0 0">'
                f'<b>{e(b["name"])}</b> hosted {b["games"]} {"game" if b["games"] == 1 else "games"}.</p>',
            )
        )
    if d.new_venues:
        items = "".join(
            f'<li style="margin:4px 0"><b>{e(v["name"] or "")}</b>'
            + (f', {e(v["city"])}' if v.get("city") else "")
            + (f' <span style="color:{MUTE}">({e(", ".join(sport_label(s) for s in v["sports"]))})</span>' if v["sports"] else "")
            + "</li>"
            for v in d.new_venues
        )
        parts.append(section("New verified venues", f'<ul style="font:15px/1.5 Arial,sans-serif;color:{INK};padding-left:18px;margin:8px 0 0">{items}</ul>'))
    if d.upcoming:
        rows = "".join(
            f'<tr><td style="padding:10px 0;border-bottom:1px solid #E6E0D2;font:15px/1.4 Arial,sans-serif;color:{INK}">'
            f'<b>{e(u["title"])}</b><br><span style="color:{MUTE}">{e(u["sport"])} at {e(u["venue"])}, {e(_when(u["when"]))}</span></td>'
            f'<td align="right" style="padding:10px 0;border-bottom:1px solid #E6E0D2;font:700 13px Arial,sans-serif;color:{CLAY};white-space:nowrap">'
            + (f'{u["spots"]} {"spot" if u["spots"] == 1 else "spots"} left' if u["spots"] else "Open")
            + "</td></tr>"
            for u in d.upcoming
        )
        parts.append(section("This week, still room", f'<table role="presentation" width="100%" style="margin-top:4px">{rows}</table>'))

    body = "".join(parts)
    return f"""<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>The Sideline</title></head>
<body style="margin:0;padding:24px 12px;background:{CREAM}">
<table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:{PAPER};border-radius:20px;overflow:hidden">
<tr><td style="padding:28px 28px 6px">
<div style="font:700 30px Georgia,serif;color:{FOREST}">The Sideline</div>
<div style="font:14px Arial,sans-serif;color:{MUTE};margin-top:4px">Grassroots weekly, {d.week_start:%b %d} to {d.week_end:%b %d}</div>
</td></tr>
{body}
<tr><td style="padding:26px 28px 28px;font:13px/1.5 Arial,sans-serif;color:{MUTE}">
See you on the field.<br>Want to be featured? Turn on "Feature me in The Sideline" in your profile.
</td></tr>
</table></body></html>
"""


def run(db, *, now: datetime | None = None) -> dict[str, str]:
    now = (now or datetime.now(timezone.utc)).replace(microsecond=0)
    window_start = (now - timedelta(days=7)).isoformat()
    window_end = (now + timedelta(days=7)).isoformat()

    # Every game that ended in the last week or starts in the next one
    games = db.select(
        "games",
        "*",
        **{"or": f"(and(end_time.gte.{window_start},end_time.lte.{now.isoformat()}),and(start_time.gt.{now.isoformat()},start_time.lte.{window_end}))"},
    )
    ids = [str(g["game_id"]) for g in games]
    bookings = db.select("bookings", "game_id,player_id", game_id=f"in.({','.join(ids)})") if ids else []
    users = db.select("users", "user_id,full_name,sideline_feature", sideline_feature="eq.true")
    parks = db.select("parks", "park_id,name,city,sports,verified_at")

    digest = build_digest(now=now, games=games, bookings=bookings, users=users, parks=parks)

    OUT_DIR.mkdir(exist_ok=True)
    stem = OUT_DIR / f"sideline-{now:%Y-%m-%d}"
    html_path, text_path = stem.with_suffix(".html"), stem.with_suffix(".txt")
    html_path.write_text(render_html(digest), encoding="utf-8")
    text_path.write_text(render_text(digest), encoding="utf-8")

    print(f"{digest.games_played} games, {digest.players} players, {len(digest.new_venues)} new venues, {len(digest.upcoming)} upcoming")
    if digest.player_of_week is None:
        print("No player of the week: nobody who played has turned on 'Feature me' yet.")
    print(f"Preview: {html_path}")
    return {"html": str(html_path), "text": str(text_path)}
