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
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or local.get("SUPABASE_SERVICE_ROLE_KEY") or ""

    if not url:
        raise MissingSetting("SUPABASE_URL is missing. Add it to services/python/.env (see .env.example).")
    if not key:
        raise MissingSetting(
            "SUPABASE_SERVICE_ROLE_KEY is missing. In Supabase go to Project Settings > API Keys, "
            "copy the secret (service_role) key, and put it in services/python/.env."
        )
    return Settings(supabase_url=url, service_key=key)
