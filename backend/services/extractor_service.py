"""
Extractor Service — light validation/cleanup of raw conversation text that
arrives from the browser extension's content scripts.

The actual DOM scraping happens client-side (in content_scripts/*.js).
This service just sanity-checks and normalizes what comes over the wire.
"""

from config import settings


class EmptyConversationError(ValueError):
    pass


def clean_conversation_text(raw_text: str) -> str:
    """
    Normalizes whitespace and enforces a max length so a single oversized
    request can't blow up token usage / cost.
    """
    if not raw_text or not raw_text.strip():
        raise EmptyConversationError("Conversation text is empty.")

    text = raw_text.strip()

    # Collapse excessive blank lines (3+ newlines -> 2)
    while "\n\n\n" in text:
        text = text.replace("\n\n\n", "\n\n")

    max_chars = settings.MAX_CONVERSATION_CHARS
    if len(text) > max_chars:
        text = text[-max_chars:]

    return text
