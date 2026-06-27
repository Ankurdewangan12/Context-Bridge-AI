"""
Core data models for ContextBridge AI.

ProjectState is the structured "memory" extracted from a conversation.
This is the schema LangChain must produce, and the schema the reconstruction
chain consumes to build a continuation prompt for the target AI.
"""

from pydantic import BaseModel, Field


class ProjectState(BaseModel):
    schema_version: int = Field(
        default=1,
        description="Bump this if the shape of ProjectState changes in the future.",
    )
    objective: str = Field(
        default="",
        description="The overall goal of the conversation/project.",
    )
    current_progress: str = Field(
        default="",
        description="A short summary of what has been completed so far.",
    )
    important_facts: list[str] = Field(
        default_factory=list,
        description="Key facts, constraints, or context the next AI must know.",
    )
    decisions: list[str] = Field(
        default_factory=list,
        description="Decisions that were made and should not be re-litigated.",
    )
    code_written: list[str] = Field(
        default_factory=list,
        description="Snippets, filenames, or descriptions of code already produced.",
    )
    bugs_found: list[str] = Field(
        default_factory=list,
        description="Known issues or bugs surfaced during the conversation.",
    )
    next_steps: list[str] = Field(
        default_factory=list,
        description="What should happen next, in order if possible.",
    )


class SummarizeRequest(BaseModel):
    """Incoming payload for POST /summarize"""
    source_ai: str = Field(description="Name of the AI the conversation came from, e.g. 'claude'")
    conversation: str = Field(description="Raw extracted conversation text")


class SummarizeResponse(BaseModel):
    """Outgoing payload for POST /summarize"""
    project_state: ProjectState


class ReconstructRequest(BaseModel):
    """Incoming payload for POST /reconstruct"""
    project_state: ProjectState
    target_ai: str = Field(description="Name of the AI the prompt is being built for, e.g. 'chatgpt'")


class ReconstructResponse(BaseModel):
    """Outgoing payload for POST /reconstruct"""
    prompt: str
