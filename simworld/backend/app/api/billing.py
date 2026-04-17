"""
Billing endpoints — Stripe integration for credit-based simulation billing.

Endpoints:
- GET  /plans      — Available pricing tiers
- POST /checkout   — Create Stripe Checkout session
- POST /webhook    — Handle Stripe webhook events
- GET  /credits    — Current user's credit balance
- POST /portal     — Create Stripe Customer Portal session
"""

import logging

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request

from app.config import get_settings
from app.utils.auth import get_current_user
from app.utils.supabase import get_credits_for_org, add_credits, get_supabase

logger = logging.getLogger(__name__)

router = APIRouter()

# Plan definitions — price IDs set via env or Stripe setup script
PLANS = {
    "free": {
        "id": "free",
        "name": "Free",
        "price": 0,
        "credits_per_month": 1,
        "max_agents": 50,
        "features": [
            "1 simulation/month",
            "50 agents max",
            "Basic report",
        ],
    },
    "pro": {
        "id": "pro",
        "name": "Pro",
        "price": 4900,
        "credits_per_month": 10,
        "max_agents": 200,
        "stripe_price_id": "price_1TGVUaAHKe2oSHJ38fdINjfD",
        "features": [
            "10 simulations/month",
            "200 agents",
            "Full report + PDF",
            "Agent explorer",
            "Scenario comparison",
        ],
    },
    "team": {
        "id": "team",
        "name": "Team",
        "price": 19900,
        "credits_per_month": 100,
        "max_agents": 1000,
        "stripe_price_id": "price_1TGVV3AHKe2oSHJ3Fat01apJ",
        "features": [
            "Unlimited simulations",
            "1000 agents",
            "All Pro features",
            "5 seats",
            "API access",
            "White-label PDFs",
        ],
    },
}


def _init_stripe():
    """Configure stripe with the secret key."""
    settings = get_settings()
    stripe.api_key = settings.STRIPE_SECRET_KEY


@router.get("/plans")
async def get_plans():
    """Get available pricing plans."""
    return {
        "success": True,
        "data": list(PLANS.values()),
    }


@router.post("/checkout")
async def create_checkout_session(
    body: dict,
    user: dict = Depends(get_current_user),
):
    """
    Create a Stripe Checkout session for plan upgrade.
    Returns { url } — the frontend opens this in the system browser (Tauri)
    or redirects (web).
    """
    settings = get_settings()

    # Guard: Stripe must be configured
    if not settings.STRIPE_SECRET_KEY:
        raise HTTPException(
            status_code=503,
            detail="Billing is not configured yet. Please set STRIPE_SECRET_KEY.",
        )

    _init_stripe()

    plan_id = body.get("plan", "pro")
    plan = PLANS.get(plan_id)
    if not plan or plan_id == "free":
        raise HTTPException(status_code=400, detail=f"Invalid plan: {plan_id}")

    price_id = plan.get("stripe_price_id") or getattr(
        settings, f"STRIPE_{plan_id.upper()}_PRICE_ID", ""
    )
    if not price_id:
        raise HTTPException(
            status_code=503,
            detail=f"Stripe price not configured for plan: {plan_id}.",
        )

    # Get or create Stripe customer
    customer_id = None
    sb = get_supabase()
    if sb:
        try:
            result = sb.table("organizations").select("stripe_customer_id").eq(
                "id", user["org_id"]
            ).limit(1).execute()
            if result.data:
                customer_id = result.data[0].get("stripe_customer_id")
        except Exception:
            pass

    if not customer_id:
        customer = stripe.Customer.create(
            email=user.get("email", ""),
            metadata={"org_id": user["org_id"], "user_id": user["user_id"]},
        )
        customer_id = customer.id
        # Save to DB
        if sb:
            try:
                sb.table("organizations").update(
                    {"stripe_customer_id": customer_id}
                ).eq("id", user["org_id"]).execute()
            except Exception:
                pass

    # Create checkout session
    success_url = body.get("success_url", "https://simworld.ai/billing/success")
    cancel_url = body.get("cancel_url", "https://simworld.ai/billing/cancel")

    session = stripe.checkout.Session.create(
        customer=customer_id,
        mode="subscription",
        line_items=[{"price": price_id, "quantity": 1}],
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={"org_id": user["org_id"], "plan": plan_id},
    )

    return {"success": True, "data": {"url": session.url}}


@router.post("/webhook")
async def stripe_webhook(request: Request):
    """
    Handle Stripe webhook events.
    Events handled:
    - checkout.session.completed: New subscription
    - invoice.paid: Recurring billing
    - customer.subscription.deleted: Cancellation
    """
    _init_stripe()
    settings = get_settings()

    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    if not settings.STRIPE_WEBHOOK_SECRET:
        logger.warning("Stripe webhook secret not configured — parsing unverified event")
        try:
            event_data = await request.json()
            event = stripe.Event.construct_from(event_data, stripe.api_key)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid webhook payload")
    else:
        try:
            event = stripe.Webhook.construct_event(
                payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
            )
        except stripe.error.SignatureVerificationError:
            raise HTTPException(status_code=400, detail="Invalid webhook signature")

    event_type = event["type"]
    data = event["data"]["object"]

    if event_type == "checkout.session.completed":
        org_id = data.get("metadata", {}).get("org_id", "")
        plan_id = data.get("metadata", {}).get("plan", "pro")
        subscription_id = data.get("subscription", "")
        customer_id = data.get("customer", "")

        plan = PLANS.get(plan_id, PLANS["pro"])
        credits = plan["credits_per_month"]

        logger.info(f"Checkout completed: org={org_id}, plan={plan_id}, credits={credits}")

        # Update org plan
        sb = get_supabase()
        if sb:
            try:
                sb.table("organizations").update({
                    "plan": plan_id,
                    "stripe_subscription_id": subscription_id,
                    "stripe_customer_id": customer_id,
                }).eq("id", org_id).execute()
            except Exception as e:
                logger.warning(f"Failed to update org plan: {e}")

        # Add credits
        add_credits(org_id, credits, plan_id)

    elif event_type == "invoice.paid":
        subscription_id = data.get("subscription", "")
        customer_id = data.get("customer", "")

        # Look up org by subscription
        sb = get_supabase()
        if sb:
            try:
                result = sb.table("organizations").select("id, plan").eq(
                    "stripe_subscription_id", subscription_id
                ).limit(1).execute()
                if result.data:
                    org = result.data[0]
                    plan = PLANS.get(org["plan"], PLANS["pro"])
                    add_credits(org["id"], plan["credits_per_month"], org["plan"])
                    logger.info(f"Invoice paid: org={org['id']}, credits={plan['credits_per_month']}")
            except Exception as e:
                logger.warning(f"Failed to process invoice.paid: {e}")

    elif event_type == "customer.subscription.deleted":
        subscription_id = data.get("id", "")

        sb = get_supabase()
        if sb:
            try:
                sb.table("organizations").update({
                    "plan": "free",
                    "stripe_subscription_id": None,
                }).eq("stripe_subscription_id", subscription_id).execute()
                logger.info(f"Subscription cancelled: {subscription_id}")
            except Exception as e:
                logger.warning(f"Failed to process subscription deletion: {e}")

    return {"success": True}


@router.get("/credits")
async def get_credits(user: dict = Depends(get_current_user)):
    """Get current user's credit balance."""
    credits = get_credits_for_org(user["org_id"])
    return {
        "success": True,
        "data": {
            "plan": user.get("plan", "free"),
            "credits_used": credits["credits_used"],
            "credits_remaining": credits["credits_remaining"],
            "credits_total": credits["credits_total"],
            "reset_date": credits.get("period_end", ""),
        },
    }


@router.post("/portal")
async def create_portal_session(
    user: dict = Depends(get_current_user),
):
    """
    Create a Stripe Customer Portal session for managing subscriptions.
    Returns { url } — open in system browser.
    """
    settings = get_settings()
    if not settings.STRIPE_SECRET_KEY:
        raise HTTPException(
            status_code=503,
            detail="Billing is not configured yet. Please set STRIPE_SECRET_KEY.",
        )

    _init_stripe()

    # Find customer ID
    customer_id = None
    sb = get_supabase()
    if sb:
        try:
            result = sb.table("organizations").select("stripe_customer_id").eq(
                "id", user["org_id"]
            ).limit(1).execute()
            if result.data:
                customer_id = result.data[0].get("stripe_customer_id")
        except Exception:
            pass

    if not customer_id:
        raise HTTPException(status_code=400, detail="No active subscription found")

    session = stripe.billing_portal.Session.create(
        customer=customer_id,
        return_url="https://simworld.ai/dashboard",
    )

    return {"success": True, "data": {"url": session.url}}
