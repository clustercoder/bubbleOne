from __future__ import annotations

import json
from typing import Any, Dict

import httpx
from openai import OpenAI

from .config import Settings


class PlannerLLM:
    def __init__(self, settings: Settings):
        self.settings = settings
        self._openai = None
        if settings.llm_provider == "openai" and settings.openai_api_key:
            self._openai = OpenAI(api_key=settings.openai_api_key)

    @staticmethod
    def _fallback_plan(state: Dict[str, Any]) -> Dict[str, Any]:
        score = float(state.get("current_score", 50.0))
        anomaly = bool(state.get("anomaly_detected", False))
        alias = state.get("alias", "friend")

        if anomaly or score < 45:
            return {
                "recommended_action": f"Draft a gentle check-in text to {alias} and schedule a call reminder tomorrow.",
                "action_type": "draft_and_schedule",
                "priority": "high",
                "schedule_in_hours": 24,
            }
        if score < 75:
            return {
                "recommended_action": f"Send {alias} a short update and ask one meaningful question this evening.",
                "action_type": "draft",
                "priority": "medium",
                "schedule_in_hours": 8,
            }
        return {
            "recommended_action": f"Maintain momentum with a light touchpoint for {alias} this week.",
            "action_type": "deprioritize",
            "priority": "low",
            "schedule_in_hours": 72,
        }

    def _prompt(self, state: Dict[str, Any]) -> str:
        return (
            "You are bubbleOne's relationship copilot. Return compact JSON only with keys: "
            "recommended_action, action_type(draft|draft_and_schedule|deprioritize|reminder), "
            "priority(low|medium|high), schedule_in_hours(integer).\n"
            "Constraints: no raw message text persistence, metadata only.\n"
            f"Input state: {json.dumps(state, default=str)}"
        )

    def _openai_plan(self, state: Dict[str, Any]) -> Dict[str, Any]:
        if self._openai is None:
            raise RuntimeError("OpenAI client unavailable")

        response = self._openai.responses.create(
            model=self.settings.openai_model,
            input=[
                {
                    "role": "system",
                    "content": "Return strict JSON only. No markdown.",
                },
                {"role": "user", "content": self._prompt(state)},
            ],
            temperature=0.2,
        )

        text = (response.output_text or "").strip()
        return json.loads(text)

    def _local_plan(self, state: Dict[str, Any]) -> Dict[str, Any]:
        payload = {
            "model": "llama3.1:8b",
            "stream": False,
            "prompt": self._prompt(state),
        }
        with httpx.Client(timeout=30.0) as client:
            resp = client.post(self.settings.local_llm_url, json=payload)
            resp.raise_for_status()
            data = resp.json()

        candidate = data.get("response", "{}").strip()
        return json.loads(candidate)

    def recommend(self, state: Dict[str, Any]) -> Dict[str, Any]:
        try:
            if self._openai is not None:
                return self._openai_plan(state)

            if self.settings.llm_provider == "local":
                return self._local_plan(state)
        except Exception:
            pass

        return self._fallback_plan(state)
