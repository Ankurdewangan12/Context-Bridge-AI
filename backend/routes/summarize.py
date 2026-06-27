"""
POST /summarize

Accepts raw conversation text from the extension and returns a structured
ProjectState produced by the summary chain.
"""

from fastapi import APIRouter, HTTPException

from models.project_state import SummarizeRequest, SummarizeResponse
from services.extractor_service import EmptyConversationError, clean_conversation_text
from services.llm_service import summarize_conversation

router = APIRouter(tags=["summarize"])


@router.post("/summarize", response_model=SummarizeResponse)
async def summarize(payload: SummarizeRequest) -> SummarizeResponse:
    try:
        cleaned = clean_conversation_text(payload.conversation)
    except EmptyConversationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    try:
        project_state = await summarize_conversation(
            source_ai=payload.source_ai,
            conversation=cleaned,
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=502,
            detail=f"Failed to generate project state: {exc}",
        ) from exc

    return SummarizeResponse(project_state=project_state)
