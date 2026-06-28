"""
ContextBridge AI — FastAPI application entrypoint.

Run locally with:
    uvicorn main:app --reload

Endpoints are registered here; actual logic lives in routes/.
"""

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from routes.reconstruct import router as reconstruct_router
from routes.summarize import router as summarize_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("contextbridge.main")

if not settings.GEMINI_API_KEY:
    logger.warning(
        "GEMINI_API_KEY is not set! /summarize and /reconstruct will fail or "
        "fall back to templates. Check that backend/.env exists and contains "
        "a real key (copy backend/.env.example to backend/.env first)."
    )

app = FastAPI(
    title="ContextBridge AI API",
    description="Backend for summarizing and reconstructing AI conversation context.",
    version="0.1.0",
)

# CORS — during development this can stay permissive ("*"), but should be
# locked down to your actual chrome-extension:// origin before shipping.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check():
    """Simple liveness check — also used by Render to confirm the service is up."""
    return {"status": "ok", "service": "ContextBridge AI"}


app.include_router(summarize_router)
app.include_router(reconstruct_router)
