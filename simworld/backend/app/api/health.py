from fastapi import APIRouter
from app.config import get_settings
from app.services.mirofish_client import MirofishClient

router = APIRouter()
settings = get_settings()


@router.get("/health")
async def health_check():
    """Health check with MiroFish connectivity status."""
    client = MirofishClient()
    try:
        mirofish_ok = await client.health_check()
    except Exception:
        mirofish_ok = False
    finally:
        await client.close()

    return {
        "status": "ok",
        "service": "simworld-api",
        "version": "0.1.0",
        "mirofish_url": settings.MIROFISH_BASE_URL,
        "mirofish_connected": mirofish_ok,
    }
