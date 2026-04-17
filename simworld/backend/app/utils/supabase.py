"""
Supabase client utility.

Provides a configured Supabase client for database operations.
Falls back to a mock client in dev mode when no Supabase URL is configured.
"""

import logging
from functools import lru_cache
from typing import Optional

from app.config import get_settings

logger = logging.getLogger(__name__)

_client = None


def get_supabase():
    """
    Get the Supabase client singleton.
    Returns None if Supabase is not configured (dev mode without DB).
    """
    global _client
    if _client is not None:
        return _client

    settings = get_settings()

    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_KEY:
        logger.info("Supabase not configured — database operations will use in-memory fallback")
        return None

    try:
        from supabase import create_client
        _client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)
        logger.info(f"Supabase client initialized: {settings.SUPABASE_URL}")
        return _client
    except Exception as e:
        logger.warning(f"Failed to initialize Supabase client: {e}")
        return None


# ─── In-memory credit store (dev fallback) ──────────────────────────

_dev_credits: dict[str, dict] = {}


def get_credits_for_org(org_id: str) -> dict:
    """
    Get credit balance for an organization.
    Uses Supabase if available, otherwise in-memory fallback.
    """
    sb = get_supabase()
    if sb:
        try:
            result = sb.table("credits").select("*").eq("org_id", org_id).order(
                "period_start", desc=True
            ).limit(1).execute()
            if result.data:
                row = result.data[0]
                return {
                    "org_id": org_id,
                    "credits_total": row.get("credits_purchased", 1),
                    "credits_used": row.get("credits_used", 0),
                    "credits_remaining": row.get("credits_purchased", 1) - row.get("credits_used", 0),
                    "period_end": row.get("period_end", ""),
                }
        except Exception as e:
            logger.warning(f"Failed to query credits: {e}")

    # Dev fallback — generous allowance so demo mode is usable
    if org_id not in _dev_credits:
        _dev_credits[org_id] = {
            "org_id": org_id,
            "credits_total": 100,
            "credits_used": 0,
            "credits_remaining": 100,
            "period_end": "2026-04-30",
        }
    return _dev_credits[org_id]


def deduct_credits(org_id: str, amount: int) -> bool:
    """
    Deduct credits from an organization. Returns True if successful.
    """
    sb = get_supabase()
    if sb:
        try:
            # Get current credits
            result = sb.table("credits").select("*").eq("org_id", org_id).order(
                "period_start", desc=True
            ).limit(1).execute()
            if result.data:
                row = result.data[0]
                new_used = row.get("credits_used", 0) + amount
                sb.table("credits").update({"credits_used": new_used}).eq(
                    "id", row["id"]
                ).execute()
                return True
        except Exception as e:
            logger.warning(f"Failed to deduct credits: {e}")
            return False

    # Dev fallback
    credits = get_credits_for_org(org_id)
    if credits["credits_remaining"] >= amount:
        credits["credits_used"] += amount
        credits["credits_remaining"] -= amount
        return True
    return False


def add_credits(org_id: str, amount: int, plan: str = "pro"):
    """
    Add credits to an organization (called after successful Stripe payment).
    """
    sb = get_supabase()
    if sb:
        try:
            from datetime import datetime, timedelta
            now = datetime.utcnow()
            period_end = now + timedelta(days=30)
            sb.table("credits").insert({
                "org_id": org_id,
                "credits_purchased": amount,
                "credits_used": 0,
                "period_start": now.isoformat(),
                "period_end": period_end.isoformat(),
            }).execute()
        except Exception as e:
            logger.warning(f"Failed to add credits: {e}")

    # Dev fallback
    _dev_credits[org_id] = {
        "org_id": org_id,
        "credits_total": amount,
        "credits_used": 0,
        "credits_remaining": amount,
        "period_end": "2026-04-27",
    }
