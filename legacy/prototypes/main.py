from __future__ import annotations

import os
from datetime import datetime
from typing import Any, Dict, List, Literal, NotRequired, TypedDict

from fastapi import FastAPI, HTTPException
from langgraph.graph import END, START, StateGraph
from openai import AsyncOpenAI
from pydantic import BaseModel, Field


class RelationshipState(TypedDict):
    # Required state fields requested by the user.
    contact_name: str
    current_score: float
    recent_metadata: List[Dict[str, Any]]
    recommended_action: str
    # Optional fields used internally by the graph.
    previous_score: NotRequired[float]
    anomaly_detected: NotRequired[bool]
    rag_context: NotRequired[str]
    anomaly_reason: NotRequired[str]


class MetadataEvent(BaseModel):
    timestamp: datetime
    interaction_type: Literal["text", "call", "ignored_message"]
    sentiment_score: float = Field(..., ge=-1.0, le=1.0)
    intent: str | None = None


class RecommendationRequest(BaseModel):
    contact_name: str
    current_score: float = Field(..., ge=0.0, le=100.0)
    recent_metadata: List[MetadataEvent]
    previous_score: float | None = Field(None, ge=0.0, le=100.0)


class RecommendationResponse(BaseModel):
    contact_name: str
    recommended_action: str
    anomaly_detected: bool


app = FastAPI(title="bubbleOne Relationship Workflow API", version="1.0.0")
openai_client: AsyncOpenAI | None = None


def _get_openai_client() -> AsyncOpenAI:
    global openai_client
    if openai_client is None:
        openai_client = AsyncOpenAI()
    return openai_client


def _infer_previous_score(state: RelationshipState) -> float | None:
    if "previous_score" in state and state["previous_score"] is not None:
        return state["previous_score"]

    for event in reversed(state["recent_metadata"]):
        candidate = event.get("previous_score")
        if isinstance(candidate, (float, int)):
            return float(candidate)
    return None


def analyze_anomaly(state: RelationshipState) -> Dict[str, Any]:
    previous_score = _infer_previous_score(state)
    score_drop_threshold = 15.0
    significant_drop = (
        previous_score is not None
        and (previous_score - state["current_score"]) >= score_drop_threshold
    )
    negative_sentiment = any(
        float(event.get("sentiment_score", 0.0)) <= -0.35
        for event in state["recent_metadata"]
    )

    anomaly_detected = significant_drop or negative_sentiment
    if significant_drop and negative_sentiment:
        reason = "significant score drop and negative sentiment"
    elif significant_drop:
        reason = "significant score drop"
    elif negative_sentiment:
        reason = "negative sentiment trend"
    else:
        reason = "no anomaly"

    return {
        "anomaly_detected": anomaly_detected,
        "anomaly_reason": reason,
        "recommended_action": "Analyzing next best action...",
    }


def route_after_anomaly(state: RelationshipState) -> str:
    return "query_rag" if state.get("anomaly_detected", False) else "plan_action"


def query_rag(state: RelationshipState) -> Dict[str, Any]:
    mock_vector_db = {
        "Aarav": "Prefers direct check-ins during weekday evenings.",
        "Maya": "Responds well to brief voice calls and practical support.",
        "Rohan": "Engages better with concrete plans over open-ended messages.",
        "Priya": "Values empathetic language when sentiment has been negative.",
        "Zane": "Usually responds quickly to upbeat, low-pressure outreach.",
    }
    fallback = (
        "Use a short, empathetic check-in and suggest one low-effort next step."
    )
    return {"rag_context": mock_vector_db.get(state["contact_name"], fallback)}


def _fallback_action(state: RelationshipState) -> str:
    if state.get("anomaly_detected", False):
        return "Draft a quick empathetic check-in text and suggest a 10-minute call."
    if state["current_score"] >= 75:
        return "Send a positive check-in text and maintain normal cadence."
    return "Send a brief check-in text and propose a time to reconnect this week."


async def plan_action(state: RelationshipState) -> Dict[str, Any]:
    if not os.getenv("OPENAI_API_KEY"):
        return {"recommended_action": _fallback_action(state)}

    prompt = (
        "You are an assistant for a privacy-first relationship manager.\n"
        "Return exactly one concise recommendation sentence (max 20 words).\n"
        "Avoid analysis, bullets, JSON, or extra commentary.\n\n"
        f"Contact: {state['contact_name']}\n"
        f"Current score: {state['current_score']}\n"
        f"Anomaly detected: {state.get('anomaly_detected', False)}\n"
        f"Anomaly reason: {state.get('anomaly_reason', 'n/a')}\n"
        f"RAG context: {state.get('rag_context', 'No additional context')}\n"
        f"Recent metadata sample: {state['recent_metadata'][:5]}"
    )

    try:
        client = _get_openai_client()
        response = await client.responses.create(
            model="gpt-4o",
            input=[
                {
                    "role": "system",
                    "content": "You recommend next-best relationship actions.",
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0.2,
        )
        action = (response.output_text or "").strip()
        return {"recommended_action": action or _fallback_action(state)}
    except Exception as exc:  # noqa: BLE001
        return {
            "recommended_action": _fallback_action(state),
            "rag_context": f"{state.get('rag_context', '')} (OpenAI fallback: {exc})",
        }


def build_graph():
    graph_builder = StateGraph(RelationshipState)
    graph_builder.add_node("analyze_anomaly", analyze_anomaly)
    graph_builder.add_node("query_rag", query_rag)
    graph_builder.add_node("plan_action", plan_action)

    graph_builder.add_edge(START, "analyze_anomaly")
    graph_builder.add_conditional_edges(
        "analyze_anomaly",
        route_after_anomaly,
        {
            "query_rag": "query_rag",
            "plan_action": "plan_action",
        },
    )
    graph_builder.add_edge("query_rag", "plan_action")
    graph_builder.add_edge("plan_action", END)
    return graph_builder.compile()


relationship_graph = build_graph()


@app.get("/health")
async def health() -> Dict[str, str]:
    return {"status": "ok"}


@app.post("/recommend-action", response_model=RecommendationResponse)
async def recommend_action(payload: RecommendationRequest) -> RecommendationResponse:
    if not payload.recent_metadata:
        raise HTTPException(
            status_code=400, detail="recent_metadata must include at least one event."
        )

    initial_state: RelationshipState = {
        "contact_name": payload.contact_name,
        "current_score": payload.current_score,
        "recent_metadata": [
            event.model_dump(mode="json") for event in payload.recent_metadata
        ],
        "recommended_action": "",
    }
    if payload.previous_score is not None:
        initial_state["previous_score"] = payload.previous_score

    final_state = await relationship_graph.ainvoke(initial_state)
    return RecommendationResponse(
        contact_name=final_state["contact_name"],
        recommended_action=final_state["recommended_action"],
        anomaly_detected=final_state.get("anomaly_detected", False),
    )
