"""Settings: where Supabase is and which key to use.

Looks in this order, first match wins:
  1. real environment variables
  2. services/python/.env
  3. the app's own .env in the project root (for the URL only)

The service role key must NEVER go in the app's .env or in GitHub. It skips row
level security, so it can read and write everything. Keep it in services/python/.env,
which .gitignore already keeps out of git.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

PYTHON_DIR = Path(__file__).resolve().parent.parent      # services/python
PROJECT_ROOT = PYTHON_DIR.parent.parent                  # the Grassroots folder
OUT_DIR = PYTHON_DIR / "out"                             # previews and newsletters land here

# Identify ourselves to OpenStreetMap services, as their usage policy asks.
USER_AGENT = "GrassrootsTools/0.1 (https://github.com/d0lawuyi/Grassroots)"


def read_env_file(path: Path) -> dict[str, str]:
    """Parse a simple KEY=value .env file. Lines starting with # are comments."""
    values: dict[str, str] = {}
    if not path.exists():
        return values
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


@dataclass(frozen=True)
class Settings:
    supabase_url: str
    service_key: str


class MissingSetting(RuntimeError):
    pass


def load_settings() -> Settings:
    local = read_env_file(PYTHON_DIR / ".env")
    app = read_env_file(PROJECT_ROOT / ".env")

    url = (
        os.environ.get("SUPABASE_URL")
        or local.get("SUPABASE_URL")
        or app.get("EXPO_PUBLIC_SUPABASE_URL")
        or ""
    ).rstrip("/")
    # Supabase shows the API address both with and without /rest/v1 on the end.
    # The tools add /rest/v1 themselves, so take it off if it was pasted in.
    if url.endswith("/rest/v1"):
        url = url[: -len("/rest/v1")]
    key =os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or local.get("SUPABASE_SERVICE_ROLE_KEY") or ""

    if not url:
        raise MissingSetting("SUPABASE_URL is missing. Add it to services/python/.env (see .env.example).")
    if not key:
        raise MissingSetting(
            "SUPABASE_SERVICE_ROLE_KEY is missing. In Supabase go to Project Settings > API Keys, "
            "copy the secret (service_role) key, and put it in services/python/.env."
        )
    if key_role(key) == "anon":
        raise MissingSetting(
            "SUPABASE_SERVICE_ROLE_KEY is the public (anon / publishable) key, the same one the app uses. "
            "It can't see review queues or add venues. In Supabase go to Project Settings > API Keys and "
            "copy the secret key (sb_secret_...) or the service_role key instead."
        )
    return Settings(supabase_url=url, service_key=key)


def key_role(key: str) -> str | None:
    """'anon', 'service_role', or None if it can't tell.

    New-style keys say what they are in their prefix. Old-style keys are JWTs: three
    base64 parts separated by dots, and the middle part is JSON that includes the role.
    """
    if key.startswith("sb_publishable_"):
        return "anon"
    if key.startswith("sb_secret_"):
        return "service_role"
    parts = key.split(".")
    if len(parts) == 3:
        import base64
        import json

        payload = parts[1] + "=" * (-len(parts[1]) % 4)  # base64 needs padding to a multiple of 4
        try:
            return json.loads(base64.urlsafe_b64decode(payload)).get("role")
        except (ValueError, json.JSONDecodeError):
            return None
    return None
