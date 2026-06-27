"""
Summary Chain — turns raw conversation text into a structured ProjectState.

Uses Gemini's native structured-output support via LangChain's
with_structured_output(), which is far more reliable than asking the model
to "return JSON" and parsing it manually with regex.
"""

from pathlib import Path

from langchain_core.prompts import PromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI

from config import settings
from models.project_state import ProjectState

PROMPT_PATH = Path(__file__).resolve().parent.parent / "prompts" / "summarize_prompt.txt"


def _load_prompt_template() -> PromptTemplate:
    template_text = PROMPT_PATH.read_text(encoding="utf-8")
    return PromptTemplate(
        template=template_text,
        input_variables=["source_ai", "conversation"],
    )


def build_summary_chain():
    """
    Returns a callable chain: invoke({"source_ai": ..., "conversation": ...}) -> ProjectState
    """
    llm = ChatGoogleGenerativeAI(
        model=settings.GEMINI_MODEL,
        google_api_key=settings.GEMINI_API_KEY,
        temperature=0,
    )

    # with_structured_output forces the model to return data matching the
    # ProjectState schema directly — no manual JSON parsing required.
    structured_llm = llm.with_structured_output(ProjectState)

    prompt = _load_prompt_template()

    chain = prompt | structured_llm
    return chain


async def run_summary_chain(source_ai: str, conversation: str) -> ProjectState:
    """
    Convenience wrapper: builds the chain and runs it once.
    Truncates extremely long conversations to protect against blowing the
    context window (a proper map-reduce summarizer can replace this later).
    """
    max_chars = settings.MAX_CONVERSATION_CHARS
    if len(conversation) > max_chars:
        # Keep the most recent portion — usually the most relevant for "continue from here".
        conversation = conversation[-max_chars:]

    chain = build_summary_chain()
    result: ProjectState = await chain.ainvoke(
        {"source_ai": source_ai, "conversation": conversation}
    )
    return result
