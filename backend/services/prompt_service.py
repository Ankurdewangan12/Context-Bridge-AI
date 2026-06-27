"""
Prompt Service — fallback prompt builder.

If the LLM-based reconstruction chain fails (no API key set, network issue,
quota exceeded, etc.), we still want /reconstruct to return something usable
rather than a hard 500. This builds a simple deterministic template directly
from the ProjectState fields.
"""

from models.project_state import ProjectState


def build_fallback_prompt(project_state: ProjectState, target_ai: str) -> str:
    def bullets(items: list[str]) -> str:
        if not items:
            return "  (none)"
        return "\n".join(f"  - {item}" for item in items)

    return f"""Continue this conversation on {target_ai}. Here is the full context from a previous session — please do not repeat work that is already done.

Objective:
{project_state.objective or "(not specified)"}

Current Progress:
{project_state.current_progress or "(not specified)"}

Important Facts:
{bullets(project_state.important_facts)}

Decisions Already Made (do not re-open these):
{bullets(project_state.decisions)}

Code / Artifacts Already Written:
{bullets(project_state.code_written)}

Known Bugs / Issues:
{bullets(project_state.bugs_found)}

Next Steps:
{bullets(project_state.next_steps)}

Please continue from here without repeating previous work."""
