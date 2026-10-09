"""A small Supabase database client.

Supabase puts a REST API (called PostgREST) in front of Postgres, at
<project url>/rest/v1/<table>. Filters go in the query string, for example
`status=eq.submitted` means WHERE status = 'submitted'. This class wraps the
three calls the tools need: read rows, insert rows, and upsert rows.
"""

from __future__ import annotations

from typing import Any, Iterable

from .config import Settings
from .web import request_json


class SupabaseRest:
    PAGE_SIZE = 1000  # PostgREST returns at most this many rows per request by default

    def __init__(self, settings: Settings):
        self.base = f"{settings.supabase_url}/rest/v1"
        self.headers = {"apikey": settings.service_key}
        # Older keys are JWTs ("eyJ...") and also go in the Authorization header.
        # Newer secret keys ("sb_secret_...") only go in the apikey header.
        if settings.service_key.startswith("eyJ"):
            self.headers["Authorization"] = f"Bearer {settings.service_key}"

    def select(self, table: str, columns: str = "*", **filters: str) -> list[dict[str, Any]]:
        """Read every matching row, a page at a time.

        select("parks", "park_id,name", status="eq.active")
        """
        rows: list[dict[str, Any]] = []
        offset = 0
        while True:
            params = {"select": columns, **filters, "limit": self.PAGE_SIZE, "offset": offset}
            page = request_json("GET", f"{self.base}/{table}", params=params, headers=self.headers) or []
            rows.extend(page)
            if len(page) < self.PAGE_SIZE:
                return rows
            offset += self.PAGE_SIZE

    def insert(self, table: str, rows: Iterable[dict[str, Any]]) -> list[dict[str, Any]]:
        rows = list(rows)
        if not rows:
            return []
        headers = {**self.headers, "Prefer": "return=representation"}
        return request_json("POST", f"{self.base}/{table}", headers=headers, body=rows) or []

    def upsert(self, table: str, rows: Iterable[dict[str, Any]], on_conflict: str) -> list[dict[str, Any]]:
        """Insert, or update the existing row when `on_conflict` columns already match."""
        rows = list(rows)
        if not rows:
            return []
        headers = {**self.headers, "Prefer": "return=representation,resolution=merge-duplicates"}
        return (
            request_json(
                "POST",
                f"{self.base}/{table}",
                params={"on_conflict": on_conflict},
                headers=headers,
                body=rows,
            )
            or []
        )
