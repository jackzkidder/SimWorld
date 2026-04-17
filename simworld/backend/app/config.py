import os
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # App
    APP_NAME: str = "SimWorld"
    DEBUG: bool = os.getenv("DEBUG", "false").lower() in ("1", "true", "yes")

    # Clerk Auth
    CLERK_SECRET_KEY: str = ""
    CLERK_PUBLISHABLE_KEY: str = ""
    CLERK_WEBHOOK_SECRET: str = ""

    # Supabase
    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_KEY: str = ""

    # Stripe
    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""

    # Redis
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")

    # CORS — allow deployed frontend, localhost for dev, Tauri
    CORS_ORIGINS: str = os.getenv(
        "CORS_ORIGINS",
        "http://localhost:3000,https://simworld.vercel.app,https://simworld-web.vercel.app,https://tauri.localhost,tauri://localhost",
    )

    # MiroFish
    MIROFISH_BASE_URL: str = os.getenv("MIROFISH_BASE_URL", "http://localhost:5001")

    # Stripe price IDs
    STRIPE_PRO_PRICE_ID: str = ""
    STRIPE_TEAM_PRICE_ID: str = ""

    # LLM (passed through to MiroFish)
    LLM_API_KEY: str = ""
    LLM_BASE_URL: str = ""
    LLM_MODEL_NAME: str = ""
    ZEP_API_KEY: str = ""

    # Anthropic (Claude-powered simulation fallback)
    ANTHROPIC_API_KEY: str = ""

    class Config:
        env_file = "../.env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
