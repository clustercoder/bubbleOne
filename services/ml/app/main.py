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
from .scoring import band_for_score, compute_relationship_score

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
        "recent_metadata": [event.model_dump(mode="json") for event in payload.recent_metadata],
    }
    result = flow.run(state)
    return {
        "recommended_action": result.get("recommended_action", "No recommendation."),
        "action_type": result.get("action_type", "reminder"),
        "priority": result.get("priority", "medium"),
        "schedule_at": result.get("schedule_at"),
        "anomaly_detected": result.get("anomaly_detected", False),
    }


@app.post("/v1/process-contact", response_model=ProcessContactResponse)
def process_contact(payload: ProcessContactRequest) -> ProcessContactResponse:
    ingest(IngestRequest(events=payload.events))

    final_score = compute_relationship_score(
        events=payload.events,
        previous_score=payload.previous_score,
    )
    band = band_for_score(final_score)

    flow_state = {
        "contact_hash": payload.contact_hash,
        "alias": payload.alias,
        "current_score": final_score,
        "previous_score": payload.previous_score,
        "recent_metadata": [event.model_dump(mode="json") for event in payload.events[-10:]],
    }
    outcome = flow.run(flow_state)

    return ProcessContactResponse(
        contact_hash=payload.contact_hash,
        score=final_score,
        band=band,
        recommended_action=outcome.get("recommended_action", "No recommendation."),
        action_type=outcome.get("action_type", "reminder"),
        priority=outcome.get("priority", "medium"),
        schedule_at=outcome.get("schedule_at"),
        anomaly_detected=bool(outcome.get("anomaly_detected", False)),
    )
