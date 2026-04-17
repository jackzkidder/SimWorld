#!/usr/bin/env python3
"""
Set up Supabase tables for SimWorld.

Usage:
    python scripts/setup_supabase.py

Requires SUPABASE_URL and SUPABASE_SERVICE_KEY in environment or ../.env
"""

import os
import sys

# Load .env from parent directory
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))

from supabase import create_client


def main():
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")

    if not url or not key:
        print("ERROR: Set SUPABASE_URL and SUPABASE_SERVICE_KEY in environment or .env")
        sys.exit(1)

    print(f"Connecting to Supabase: {url}")
    client = create_client(url, key)

    # The schema SQL from models/schemas.py
    from app.models.schemas import SCHEMA_SQL

    # Supabase doesn't support multi-statement SQL via the client directly.
    # Use the SQL editor in the Supabase dashboard instead.
    print("\n" + "=" * 60)
    print("COPY THE SQL BELOW INTO YOUR SUPABASE SQL EDITOR")
    print("Dashboard → SQL Editor → New Query → Paste → Run")
    print("=" * 60)
    print(SCHEMA_SQL)
    print("=" * 60)

    # Also seed a dev organization and credits
    seed_sql = """
-- Seed dev organization (for local development / testing)
INSERT INTO organizations (id, name, plan, seats_limit)
VALUES ('00000000-0000-0000-0000-000000000001', 'SimWorld Dev Org', 'free', 5)
ON CONFLICT DO NOTHING;

-- Seed initial free credits
INSERT INTO credits (org_id, plan, credits_total, credits_used, period_start, period_end)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'free',
    1,
    0,
    NOW(),
    NOW() + INTERVAL '30 days'
)
ON CONFLICT DO NOTHING;
"""
    print("\nOPTIONAL: Seed dev data (run after the schema):")
    print(seed_sql)


if __name__ == "__main__":
    main()
