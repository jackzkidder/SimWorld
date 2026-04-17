"""Auth endpoints - Clerk webhook and user management."""

import hashlib
import hmac
import logging
from fastapi import APIRouter, Depends, HTTPException, Request

from app.config import get_settings
from app.utils.auth import get_current_user as get_user_dep
from app.utils.supabase import add_credits, get_credits_for_org

logger = logging.getLogger(__name__)

router = APIRouter()


def _verify_webhook_signature(payload: bytes, headers: dict) -> bool:
    """Verify Clerk webhook signature using Svix."""
    settings = get_settings()
    secret = settings.CLERK_WEBHOOK_SECRET

    if not secret:
        logger.warning("CLERK_WEBHOOK_SECRET not set — accepting unverified webhook")
        return True

    try:
        from svix.webhooks import Webhook
        wh = Webhook(secret)
        wh.verify(payload, headers)
        return True
    except ImportError:
        logger.warning("svix not installed — skipping webhook verification")
        return True
    except Exception as e:
        logger.error(f"Clerk webhook verification failed: {e}")
        return False


@router.post("/webhook")
async def clerk_webhook(request: Request):
    """Handle Clerk webhook events (user.created, user.updated, etc.)."""
    payload = await request.body()
    headers = {
        "svix-id": request.headers.get("svix-id", ""),
        "svix-timestamp": request.headers.get("svix-timestamp", ""),
        "svix-signature": request.headers.get("svix-signature", ""),
    }

    if not _verify_webhook_signature(payload, headers):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    import json
    body = json.loads(payload)
    event_type = body.get("type", "")
    data = body.get("data", {})

    logger.info(f"Clerk webhook: {event_type}")

    if event_type == "user.created":
        user_id = data.get("id", "")
        email = ""
        email_addresses = data.get("email_addresses", [])
        if email_addresses:
            email = email_addresses[0].get("email_address", "")

        logger.info(f"New user created: {user_id} ({email})")

        # Initialize free tier credits for new user
        org_id = f"org_{user_id}"
        add_credits(org_id, amount=1, plan="free")
        logger.info(f"Initialized free credits for {org_id}")

    elif event_type == "user.updated":
        user_id = data.get("id", "")
        logger.info(f"User updated: {user_id}")

    return {"success": True}


@router.get("/me")
async def get_me(user: dict = Depends(get_user_dep)):
    """Get current user profile with live credit balance."""
    org_id = user.get("org_id", "dev_org_001")
    credits = get_credits_for_org(org_id)

    return {
        "success": True,
        "data": {
            "id": user.get("user_id", "user_demo"),
            "email": user.get("email", "demo@simworld.ai"),
            "plan": user.get("plan", "free"),
            "credits_remaining": credits["credits_remaining"],
            "credits_total": credits["credits_total"],
        },
    }
