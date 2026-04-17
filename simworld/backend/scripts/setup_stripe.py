#!/usr/bin/env python3
"""
One-time Stripe setup script.
Creates Products and Prices for SimWorld's pricing tiers.
Run once, then add the printed price IDs to your .env file.

Usage:
    STRIPE_SECRET_KEY=sk_test_xxx python scripts/setup_stripe.py
"""

import os
import sys

import stripe

stripe.api_key = os.environ.get("STRIPE_SECRET_KEY", "")

if not stripe.api_key:
    print("Error: Set STRIPE_SECRET_KEY environment variable")
    sys.exit(1)

PLANS = [
    {
        "name": "SimWorld Pro",
        "description": "10 simulations/month, 200 agents, full reports",
        "price_cents": 4900,
        "env_key": "STRIPE_PRO_PRICE_ID",
    },
    {
        "name": "SimWorld Team",
        "description": "Unlimited simulations, 1000 agents, 5 seats, API access",
        "price_cents": 19900,
        "env_key": "STRIPE_TEAM_PRICE_ID",
    },
]


def main():
    print("Creating SimWorld Stripe products and prices...\n")

    env_lines = []

    for plan in PLANS:
        # Create product
        product = stripe.Product.create(
            name=plan["name"],
            description=plan["description"],
        )
        print(f"Created product: {product.id} ({plan['name']})")

        # Create recurring price
        price = stripe.Price.create(
            product=product.id,
            unit_amount=plan["price_cents"],
            currency="usd",
            recurring={"interval": "month"},
        )
        print(f"  Price: {price.id} (${plan['price_cents'] / 100:.2f}/mo)")

        env_lines.append(f"{plan['env_key']}={price.id}")

    print("\n--- Add these to your .env file ---")
    for line in env_lines:
        print(line)
    print("-----------------------------------")


if __name__ == "__main__":
    main()
