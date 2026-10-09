"""Tiny HTTP helpers on top of urllib (part of the standard library)."""

from __future__ import annotations

import json
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

from .config import USER_AGENT


class HttpError(RuntimeError):
    def __init__(self, status: int, body: str, url: str):
        super().__init__(f"HTTP {status} from {url}: {body[:400]}")
        self.status = status
        self.body = body


def request_json(
    method: str,
    url: str,
    *,
    params: dict[str, Any] | None = None,
    headers: dict[str, str] | None = None,
    body: Any = None,
    form: dict[str, str] | None = None,
    timeout: float = 60,
    retries: int = 2,
) -> Any:
    """Send a request and return the decoded JSON (or None for an empty reply).

    `body` is sent as JSON, `form` as a regular web form. Server errors (5xx) and
    rate limits (429) are retried a couple of times with a short wait.
    """
    if params:
        url = f"{url}?{urllib.parse.urlencode(params, doseq=True)}"

    all_headers = {"User-Agent": USER_AGENT, "Accept": "application/json"}
    data = None
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        all_headers["Content-Type"] = "application/json"
    elif form is not None:
        data = urllib.parse.urlencode(form).encode("utf-8")
        all_headers["Content-Type"] = "application/x-www-form-urlencoded"
    all_headers.update(headers or {})

    for attempt in range(retries + 1):
        req = urllib.request.Request(url, data=data, headers=all_headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                raw = resp.read().decode("utf-8")
                return json.loads(raw) if raw.strip() else None
        except urllib.error.HTTPError as err:
            text = err.read().decode("utf-8", errors="replace")
            if err.code in (429, 500, 502, 503, 504) and attempt < retries:
                time.sleep(2 * (attempt + 1))
                continue
            raise HttpError(err.code, text, url) from None
    raise AssertionError("unreachable")
