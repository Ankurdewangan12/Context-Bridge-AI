"""
Reconstruction Chain — turns a ProjectState into a continuation prompt
written for a specific target AI.
"""

from pathlib import Path

from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import PromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI

from config import settings
from models.project_state import ProjectState

PROMPT_PATH = Path(__file__).resolve().parent.parent / "prompts" / "reconstruct_prompt.txt"


def _load_prompt_template() -> PromptTemplate:
    template_text = PROMPT_PATH.read_text(encoding="utf-8")
    return PromptTemplate(
        template=template_text,
        input_variables=[
            "objective",
            "current_progress",
            "important_facts",
            "decisions",
            "code_written",
            "bugs_found",
            "next_steps",
            "target_ai",
        ],
    )


def build_reconstruction_chain():
    """
    Returns a callable chain: invoke({...project state fields..., "target_ai": ...}) -> str
    """
    llm = ChatGoogleGenerativeAI(
        model=settings.GEMINI_MODEL,
        google_api_key=settings.GEMINI_API_KEY,
        temperature=0.3,
    )

    prompt = _load_prompt_template()
    chain = prompt | llm | StrOutputParser()
    return chain


def _list_to_bullets(items: list[str]) -> str:
    if not items:
        return "(none)"
    return "\n".join(f"- {item}" for item in items)


async def run_reconstruction_chain(project_state: ProjectState, target_ai: str) -> str:
    chain = build_reconstruction_chain()
    result: str = await chain.ainvoke(
        {
            "objective": project_state.objective or "(not specified)",
            "current_progress": project_state.current_progress or "(not specified)",
            "important_facts": _list_to_bullets(project_state.important_facts),
            "decisions": _list_to_bullets(project_state.decisions),
            "code_written": _list_to_bullets(project_state.code_written),
            "bugs_found": _list_to_bullets(project_state.bugs_found),
            "next_steps": _list_to_bullets(project_state.next_steps),
            "target_ai": target_ai,
        }
    )
    return result.strip()
