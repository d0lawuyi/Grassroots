"""Command line entry point: python -m grassroots_tools <command> [options]"""

from __future__ import annotations

import argparse
import sys

from . import __version__
from .config import MissingSetting, load_settings
from .supabase_rest import SupabaseRest
from .web import HttpError


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m grassroots_tools", description="Grassroots helper tools")
    parser.add_argument("--version", action="version", version=__version__)
    sub = parser.add_subparsers(dest="command", required=True)

    imp = sub.add_parser("parks-import", help="add public sports fields from OpenStreetMap")
    imp.add_argument("--city", required=True, help='for example "Indianapolis"')
    imp.add_argument("--state", required=True, help='two letters, for example "IN"')
    imp.add_argument("--limit", type=int, help="add at most this many venues")
    imp.add_argument("--commit", action="store_true", help="actually add them (without this it's a dry run)")

    pre = sub.add_parser("precheck", help="pre-check venue submissions waiting for review")
    pre.add_argument("--recheck", action="store_true", help="check again even if already checked")
    pre.add_argument("--no-geocode", action="store_true", help="skip the address lookup (works offline)")

    sub.add_parser("sideline", help="build this week's Sideline newsletter preview")

    args = parser.parse_args(argv)

    try:
        db = SupabaseRest(load_settings())
        if args.command == "parks-import":
            from . import parks_import

            parks_import.run(db, city=args.city, state=args.state.upper(), commit=args.commit, limit=args.limit)
        elif args.command == "precheck":
            from . import precheck

            precheck.run(db, recheck=args.recheck, geocode=not args.no_geocode)
        elif args.command == "sideline":
            from . import sideline

            sideline.run(db)
    except MissingSetting as err:
        print(f"Setup needed: {err}", file=sys.stderr)
        return 2
    except HttpError as err:
        hint = ""
        if err.status in (401, 403):
            hint = "\nCheck SUPABASE_SERVICE_ROLE_KEY in services/python/.env."
        elif err.status == 404 or "does not exist" in err.body:
            hint = "\nHas supabase/migrations/003_python_tools.sql been run in the SQL Editor?"
        print(f"Request failed: {err}{hint}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
