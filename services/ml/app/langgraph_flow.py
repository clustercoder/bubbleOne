from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, TypedDict

from langgraph.graph import END, START, StateGraph

from .embeddings import EmbeddingClient
from .llm_clients import PlannerLLM
from .rag_store import RagStore


class FlowState(TypedDict, total=False):
    contact_hash: str
    alias: str
    current_score: float
    previous_score: float
    recent_metadata: List[Dict[str, Any]]
    rag_context: str
    anomaly_detected: bool
    anomaly_reason: str
    recommended_action: str
    action_type: str
    priority: str
    schedule_in_hours: int
    schedule_at: str | None


class RelationshipFlow:
    def __init__(self, rag_store: RagStore, embedder: EmbeddingClient, planner: PlannerLLM):
        self.rag_store = rag_store
        self.embedder = embedder
        self.planner = planner
        self.graph = self._build_graph()

    def _analyze_anomaly(self, state: FlowState) -> Dict[str, Any]:
        score_drop = float(state.get("previous_score", 50.0)) - float(
            state.get("current_score", 50.0)
        )
        negative_signal = any(
            float(item.get("sentiment", 0.0)) <= -0.35
            for item in state.get("recent_metadata", [])
        )
        anomaly = score_drop >= 15.0 or negative_signal

        reason = "none"
        if score_drop >= 15.0 and negative_signal:
            reason = "drop_and_negative_sentiment"
        elif score_drop >= 15.0:
            reason = "score_drop"
        elif negative_signal:
            reason = "negative_sentiment"

        return {
            "anomaly_detected": anomaly,
            "anomaly_reason": reason,
        }

    @staticmethod
    def _route_after_anomaly(state: FlowState) -> str:
        return "query_rag" if state.get("anomaly_detected") else "plan_action"

    def _query_rag(self, state: FlowState) -> Dict[str, Any]:
        summaries = [
            str(item.get("summary", ""))
            for item in state.get("recent_metadata", [])
            if item.get("summary")
        ]
        if not summaries:
            return {"rag_context": "No historical context found."}

        query_vector = self.embedder.embed_texts([" ".join(summaries[-3:])])[0]
        neighbors = self.rag_store.query(
            contact_hash=state["contact_hash"],
            query_embedding=query_vector,
            k=4,
        )
        if not neighbors:
            return {"rag_context": "No similar past summaries in vector memory."}

        snippets = [f"- {item.summary}" for item in neighbors]
        context = "\n".join(snippets)
        return {"rag_context": context}

    def _plan_action(self, state: FlowState) -> Dict[str, Any]:
        llm_input = {
            "contact_hash": state.get("contact_hash"),
            "alias": state.get("alias"),
            "current_score": state.get("current_score"),
            "previous_score": state.get("previous_score"),
            "anomaly_detected": state.get("anomaly_detected"),
            "anomaly_reason": state.get("anomaly_reason"),
            "rag_context": state.get("rag_context", ""),
            "recent_metadata": state.get("recent_metadata", [])[-5:],
        }
        return self.planner.recommend(llm_input)

    def _schedule_action(self, state: FlowState) -> Dict[str, Any]:
        hours = int(state.get("schedule_in_hours", 24))
        schedule_time = datetime.now(timezone.utc) + timedelta(hours=hours)
        return {"schedule_at": schedule_time.isoformat()}

    def _build_graph(self):
        graph = StateGraph(FlowState)

        graph.add_node("analyze_anomaly", self._analyze_anomaly)
        graph.add_node("query_rag", self._query_rag)
        graph.add_node("plan_action", self._plan_action)
        graph.add_node("schedule_action", self._schedule_action)

        graph.add_edge(START, "analyze_anomaly")
        graph.add_conditional_edges(
            "analyze_anomaly",
            self._route_after_anomaly,
            {
                "query_rag": "query_rag",
                "plan_action": "plan_action",
            },
        )
        graph.add_edge("query_rag", "plan_action")
        graph.add_edge("plan_action", "schedule_action")
        graph.add_edge("schedule_action", END)

        return graph.compile()

    def run(self, state: FlowState) -> FlowState:
        return self.graph.invoke(state)
