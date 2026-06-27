"""
POST /reconstruct

Accepts a ProjectState + target AI name and returns a continuation prompt.
Falls back to a deterministic template if the LLM call fails, so the
endpoint stays usable even without an API key configured.
"""

import logging

from fastapi import APIRouter

from models.project_state import ReconstructRequest, ReconstructResponse
from services.llm_service import reconstruct_prompt
from services.prompt_service import build_fallback_prompt

logger = logging.getLogger("contextbridge.routes.reconstruct")

router = APIRouter(tags=["reconstruct"])


@router.post("/reconstruct", response_model=ReconstructResponse)
async def reconstruct(payload: ReconstructRequest) -> ReconstructResponse:
    try:
        prompt_text = await reconstruct_prompt(
            project_state=payload.project_state,
            target_ai=payload.target_ai,
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("LLM reconstruction failed, using fallback template: %s", exc)
        prompt_text = build_fallback_prompt(
            project_state=payload.project_state,
            target_ai=payload.target_ai,
        )

    return ReconstructResponse(prompt=prompt_text)
