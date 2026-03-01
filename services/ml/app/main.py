from __future__ import annotations

from typing import Any, Dict

from fastapi import FastAPI

from .config import get_settings
from .embeddings import EmbeddingClient
from .langgraph_flow import RelationshipFlow
from .llm_clients import PlannerLLM
from .models import (
    IngestRequest,
    ProcessContactRequest,
    ProcessContactResponse,
    RecommendRequest,
    ScoreRequest,
)
from .rag_store import RagStore
from .scoring import ScoringHyperParams, band_for_score, compute_relationship_score, risk_level_for_score, train_temporal_decay

settings = get_settings()
embedder = EmbeddingClient(settings)
rag_store = RagStore(settings.data_dir)
planner = PlannerLLM(settings)
flow = RelationshipFlow(rag_store=rag_store, embedder=embedder, planner=planner)

app = FastAPI(title="bubbleOne ML Service", version="0.1.0")


@app.get("/health")
def health() -> Dict[str, str]:
    return {
        "status": "ok",
        "embedding_provider": settings.embedding_provider,
        "llm_provider": settings.llm_provider,
    }


@app.post("/v1/ingest")
def ingest(payload: IngestRequest) -> Dict[str, Any]:
    summaries = [event.summary for event in payload.events]
    vectors = embedder.embed_texts(summaries)

    inserted = 0
    for event, vector in zip(payload.events, vectors):
        safe_metadata = {
            "ts": event.ts.isoformat(),
            "interaction_type": event.interaction_type,
            "sentiment": event.sentiment,
            "intent": event.intent,
            **event.metadata,
        }
        rag_store.add_record(
            event_id=event.event_id,
            contact_hash=event.contact_hash,
            summary=event.summary,
            metadata=safe_metadata,
            embedding=vector,
        )
        inserted += 1

    return {"inserted": inserted}


@app.post("/v1/score")
def score(payload: ScoreRequest) -> Dict[str, Any]:
    final_score = compute_relationship_score(
        events=payload.events,
        previous_score=payload.previous_score,
    )
    return {
        "contact_hash": payload.contact_hash,
        "score": final_score,
        "band": band_for_score(final_score),
    }


@app.post("/v1/recommend")
def recommend(payload: RecommendRequest) -> Dict[str, Any]:
    state = {
        "contact_hash": payload.contact_hash,
        "alias": payload.alias,
        "current_score": payload.current_score,
        "previous_score": payload.previous_score,
        "recent_event_count_7d": len(payload.recent_metadata),
        "prior_event_count_7d": max(len(payload.recent_metadata) - 2, 0),
        "recent_metadata": [event.model_dump(mode="json") for event in payload.recent_metadata],
    }
    result = flow.run(state)
    return {
        "recommended_action": result.get("recommended_action", "No recommendation."),
        "draft_message": result.get("draft_message", "Hey there, checking in. How are you doing this week?"),
        "action_type": result.get("action_type", "reminder"),
        "priority": result.get("priority", "medium"),
        "schedule_at": result.get("schedule_at"),
        "anomaly_detected": result.get("anomaly_detected", False),
        "anomaly_reason": result.get("anomaly_reason", "none"),
    }


@app.post("/v1/process-contact", response_model=ProcessContactResponse)
def process_contact(payload: ProcessContactRequest) -> ProcessContactResponse:
    ingest(IngestRequest(events=payload.events))

    base_lambda = payload.lambda_decay_override if payload.lambda_decay_override is not None else 0.08
    lambda_used = (
        train_temporal_decay(payload.events, base_lambda=base_lambda)
        if payload.temporal_training_enabled
        else base_lambda
    )
    hp = ScoringHyperParams(
        lambda_decay=lambda_used,
        interaction_multiplier=payload.interaction_multiplier,
    )

    final_score = compute_relationship_score(
        events=payload.events,
        previous_score=payload.previous_score,
        hp=hp,
    )
    band = band_for_score(final_score)

    flow_state = {
        "contact_hash": payload.contact_hash,
        "alias": payload.alias,
        "current_score": final_score,
        "previous_score": payload.previous_score,
        "recent_event_count_7d": payload.recent_event_count_7d,
        "prior_event_count_7d": payload.prior_event_count_7d,
        "recent_metadata": [event.model_dump(mode="json") for event in payload.events[-10:]],
    }
    outcome = flow.run(flow_state)
    anomaly_detected = bool(outcome.get("anomaly_detected", False))

    return ProcessContactResponse(
        contact_hash=payload.contact_hash,
        score=final_score,
        band=band,
        risk_level=risk_level_for_score(final_score, anomaly_detected=anomaly_detected),
        recommended_action=outcome.get("recommended_action", "No recommendation."),
        draft_message=outcome.get(
            "draft_message",
            f"Hey {payload.alias}, just checking in. Want to catch up this week?",
        ),
        action_type=outcome.get("action_type", "reminder"),
        priority=outcome.get("priority", "medium"),
        schedule_at=outcome.get("schedule_at"),
        anomaly_detected=anomaly_detected,
        anomaly_reason=outcome.get("anomaly_reason", "none"),
        lambda_decay_used=lambda_used,
    )
