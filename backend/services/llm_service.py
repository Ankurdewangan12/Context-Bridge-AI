"""
LLM Service — thin wrapper around the chains, with retry-on-failure logic.

Keeping this as its own layer means routes/ never talk to LangChain directly,
which makes it easy to swap providers (e.g. add an OpenAI fallback) later
without touching route code.
"""

import asyncio
import logging

from chains.reconstruction_chain import run_reconstruction_chain
from chains.summary_chain import run_summary_chain
from models.project_state import ProjectState

logger = logging.getLogger("contextbridge.llm_service")

MAX_RETRIES = 2


async def summarize_conversation(source_ai: str, conversation: str) -> ProjectState:
    """
    Calls the summary chain with a couple of retries, since LLM structured
    output can occasionally fail to validate against the schema.
    """
    last_error: Exception | None = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            return await run_summary_chain(source_ai, conversation)
        except Exception as exc:  # noqa: BLE001 — we want to retry on any failure here
            last_error = exc
            logger.warning("summarize_conversation attempt %s failed: %s", attempt, exc)
            await asyncio.sleep(0.5 * attempt)

    logger.error("summarize_conversation failed after %s attempts: %s", MAX_RETRIES, last_error)
    raise RuntimeError(f"Failed to summarize conversation: {last_error}") from last_error


async def reconstruct_prompt(project_state: ProjectState, target_ai: str) -> str:
    """
    Calls the reconstruction chain with a couple of retries.
    """
    last_error: Exception | None = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            return await run_reconstruction_chain(project_state, target_ai)
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            logger.warning("reconstruct_prompt attempt %s failed: %s", attempt, exc)
            await asyncio.sleep(0.5 * attempt)

    logger.error("reconstruct_prompt failed after %s attempts: %s", MAX_RETRIES, last_error)
    raise RuntimeError(f"Failed to reconstruct prompt: {last_error}") from last_error
