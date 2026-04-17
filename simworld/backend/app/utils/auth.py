"""
Authentication dependency for FastAPI endpoints.

Demo mode: returns a default user when no auth is configured.
Production: verifies JWT from Authorization: Bearer <token> header.
"""

import logging

from fastapi import HTTPException, Request
from jose import JWTError, jwt

from app.config import get_settings

logger = logging.getLogger(__name__)

# Default demo user when auth is not configured
DEMO_USER = {
    "user_id": "demo_user",
    "org_id": "demo_org",
    "email": "demo@simworld.ai",
    "name": "Demo User",
    "plan": "free",
}


def _auth_is_configured() -> bool:
    """Check if real authentication is set up."""
    settings = get_settings()
    return bool(settings.CLERK_SECRET_KEY and settings.CLERK_SECRET_KEY != "sk_test_placeholder")


async def get_current_user(request: Request) -> dict:
    """
    Extract the current user from the request.

    - If Clerk is configured: verify JWT from Authorization header
    - If not configured: return demo user (allows app to work without auth setup)
    """
    settings = get_settings()

    # JWT auth — try this first if an Authorization header is present
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header[7:]
        if not _auth_is_configured():
            logger.warning("JWT provided but auth not configured — accepting as demo user")
            return DEMO_USER.copy()
        try:
            payload = jwt.decode(token, settings.CLERK_SECRET_KEY, algorithms=["HS256"])
            return {
                "user_id": payload.get("sub", ""),
                "org_id": payload.get("org_id", ""),
                "email": payload.get("email", ""),
                "name": payload.get("name", ""),
                "plan": payload.get("plan", "free"),
            }
        except JWTError as e:
            raise HTTPException(status_code=401, detail=f"Invalid token: {e}")

    # No auth header — allow demo access
    # Once the frontend integrates Clerk SDK and sends JWTs,
    # change this to reject unauthenticated requests:
    #   if _auth_is_configured():
    #       raise HTTPException(status_code=401, detail="Authentication required")
    return DEMO_USER.copy()
