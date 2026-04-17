# SimWorld Deployment Guide

## Prerequisites

- [Fly.io CLI](https://fly.io/docs/flyctl/install/) (`flyctl`)
- [Stripe account](https://dashboard.stripe.com) (test mode is fine to start)
- [Supabase account](https://supabase.com) (free tier works)
- [Rust toolchain](https://rustup.rs) (for building the desktop app)
- Node.js 18+

## Step 1: Deploy the Backend to Fly.io

```bash
# Install Fly CLI
curl -L https://fly.io/install.sh | sh

# Login
fly auth login

# From the backend directory
cd simworld/backend

# Launch the app (first time only)
fly launch --no-deploy

# Set secrets (replace with your real values)
fly secrets set \
  STRIPE_SECRET_KEY=sk_test_YOUR_KEY \
  STRIPE_WEBHOOK_SECRET=whsec_YOUR_SECRET \
  SUPABASE_URL=https://YOUR_PROJECT.supabase.co \
  SUPABASE_SERVICE_KEY=YOUR_SERVICE_KEY \
  CLERK_SECRET_KEY=sk_test_YOUR_KEY \
  CORS_ORIGINS="https://tauri.localhost,tauri://localhost,https://simworld.ai"

# Deploy
fly deploy
```

Your API will be live at `https://simworld-api.fly.dev`.

## Step 2: Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** > **New Query**
3. Run the setup script to get the SQL:
   ```bash
   cd simworld/backend
   python scripts/setup_supabase.py
   ```
4. Copy the output SQL into the Supabase SQL editor and run it
5. Copy your project URL and service key into Fly secrets (Step 1)

## Step 3: Stripe (Already Done)

Products and prices are already created in your Stripe account:

| Plan | Product ID | Price ID | Amount |
|------|-----------|----------|--------|
| Pro | prod_UEzS75JaxDpOsu | price_1TGVUaAHKe2oSHJ38fdINjfD | $49/mo |
| Team | prod_UEzTLn6Zs3qIJK | price_1TGVV3AHKe2oSHJ3Fat01apJ | $199/mo |

Set up the Stripe webhook:
1. Go to [Stripe Webhooks](https://dashboard.stripe.com/webhooks)
2. Add endpoint: `https://simworld-api.fly.dev/api/billing/webhook`
3. Select events: `checkout.session.completed`, `invoice.paid`, `customer.subscription.deleted`
4. Copy the signing secret and set it: `fly secrets set STRIPE_WEBHOOK_SECRET=whsec_...`

## Step 4: Build the Desktop App

```bash
cd simworld/frontend

# Install dependencies
npm install

# Build the Tauri desktop app
npm run tauri:build
```

Installers will be in `src-tauri/target/release/bundle/`:
- **Windows**: `simworld_0.1.0_x64-setup.exe` (NSIS installer)
- **macOS**: `SimWorld.dmg`
- **Linux**: `simworld_0.1.0_amd64.deb`

## Step 5: Distribute

Upload the installers to your website or use GitHub Releases:

```bash
# Create a GitHub release with the installers
gh release create v0.1.0 \
  src-tauri/target/release/bundle/nsis/*.exe \
  src-tauri/target/release/bundle/dmg/*.dmg \
  src-tauri/target/release/bundle/deb/*.deb \
  --title "SimWorld v0.1.0" \
  --notes "First release of SimWorld desktop app"
```

## Architecture

```
User's Desktop (Tauri app)
    ↓ HTTPS
Fly.io (simworld-api.fly.dev)
    ├── FastAPI backend
    ├── → Stripe (billing)
    ├── → Supabase (database)
    └── → MiroFish (simulations)
```
