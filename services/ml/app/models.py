from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Literal

from pydantic import BaseModel, Field, model_validator


InteractionType = Literal[
    "text",
    "call",
    "ignored_message",
    "auto_nudge",
    "missed_call",
]


class MetadataEvent(BaseModel):
    event_id: str
    contact_hash: str
    ts: datetime
    interaction_type: InteractionType
    sentiment: float = Field(..., ge=-1.0, le=1.0)
    intent: str = Field(default="check_in")
    summary: str = Field(..., min_length=8, max_length=280)
    metadata: Dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def validate_privacy(self) -> "MetadataEvent":
        forbidden_keys = {"raw_message", "message_text", "full_text", "chat_text"}
        present = forbidden_keys.intersection(set(self.metadata.keys()))
        if present:
            raise ValueError(f"Forbidden raw-text keys in metadata: {sorted(present)}")
        return self


class IngestRequest(BaseModel):
    events: List[MetadataEvent]


class ScoreRequest(BaseModel):
    contact_hash: str
    events: List[MetadataEvent]
    previous_score: float = Field(default=50.0, ge=0.0, le=100.0)


class RecommendRequest(BaseModel):
    contact_hash: str
    alias: str
    current_score: float = Field(..., ge=0.0, le=100.0)
    previous_score: float = Field(default=50.0, ge=0.0, le=100.0)
    recent_metadata: List[MetadataEvent]


class ProcessContactRequest(BaseModel):
    contact_hash: str
    alias: str
    events: List[MetadataEvent]
    previous_score: float = Field(default=50.0, ge=0.0, le=100.0)
    interaction_multiplier: float = Field(default=1.0, ge=0.5, le=2.0)
    lambda_decay_override: float | None = Field(default=None, ge=0.01, le=0.4)
    recent_event_count_7d: int = Field(default=0, ge=0)
    prior_event_count_7d: int = Field(default=0, ge=0)
    temporal_training_enabled: bool = True


class ProcessContactResponse(BaseModel):
    contact_hash: str
    score: float
    band: Literal["good", "fading", "critical"]
    risk_level: Literal["low", "medium", "high"]
    recommended_action: str
    draft_message: str
    action_type: str
    priority: str
    schedule_at: str | None
    anomaly_detected: bool
    anomaly_reason: str
    lambda_decay_used: float
