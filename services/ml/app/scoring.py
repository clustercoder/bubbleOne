from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Iterable, Literal

from .models import MetadataEvent

Band = Literal["good", "fading", "critical"]


@dataclass(frozen=True)
class ScoringHyperParams:
    lambda_decay: float = 0.08
    recency_gamma: float = 0.05
    sentiment_weight: float = 6.0
    interaction_multiplier: float = 1.0
    min_score: float = 0.0
    max_score: float = 100.0


INTERACTION_WEIGHTS = {
    "call": 8.0,
    "text": 4.0,
    "ignored_message": -7.0,
    "auto_nudge": 2.0,
    "missed_call": -3.0,
}

INTENT_WEIGHTS = {
    "support": 2.5,
    "check_in": 1.2,
    "plan_event": 2.0,
    "small_talk": 0.5,
    "follow_up": 1.5,
    "request_help": 1.0,
}



def clamp_score(value: float, low: float = 0.0, high: float = 100.0) -> float:
    return max(low, min(high, value))



def band_for_score(score: float) -> Band:
    if score >= 75:
        return "good"
    if score >= 45:
        return "fading"
    return "critical"


def risk_level_for_score(score: float, anomaly_detected: bool = False) -> Literal["low", "medium", "high"]:
    if anomaly_detected or score < 45:
        return "high"
    if score < 70:
        return "medium"
    return "low"



def _days_between(a: datetime, b: datetime) -> float:
    return max((a - b).total_seconds() / 86400.0, 0.0)



def interaction_impact(
    event: MetadataEvent,
    reference_time: datetime,
    hp: ScoringHyperParams,
) -> float:
    base_weight = INTERACTION_WEIGHTS[event.interaction_type]
    intent_weight = INTENT_WEIGHTS.get(event.intent, 0.5)
    sentiment_term = hp.sentiment_weight * float(event.sentiment)

    days_old = _days_between(reference_time, event.ts)
    recency_multiplier = math.exp(-hp.recency_gamma * days_old)

    return (
        (base_weight + intent_weight + sentiment_term)
        * hp.interaction_multiplier
        * recency_multiplier
    )


def train_temporal_decay(
    events: Iterable[MetadataEvent],
    base_lambda: float = 0.08,
) -> float:
    event_list = sorted(list(events), key=lambda e: e.ts)
    if len(event_list) < 2:
        return round(base_lambda, 4)

    gaps = []
    for i in range(1, len(event_list)):
        gap_days = _days_between(event_list[i].ts, event_list[i - 1].ts)
        gaps.append(gap_days)

    avg_gap = sum(gaps) / max(len(gaps), 1)
    variability = (max(gaps) - min(gaps)) if gaps else 0.0

    # Higher gap/variability => slightly faster decay. Denser cadence => slower decay.
    trained = base_lambda + (0.01 * min(avg_gap, 7.0)) + (0.003 * min(variability, 7.0))
    trained = max(0.03, min(0.2, trained))
    return round(trained, 4)



def update_score(
    old_score: float,
    event: MetadataEvent,
    delta_t_days: float,
    reference_time: datetime,
    hp: ScoringHyperParams,
) -> float:
    decayed = old_score * math.exp(-hp.lambda_decay * max(delta_t_days, 0.0))
    impact = interaction_impact(event=event, reference_time=reference_time, hp=hp)
    return clamp_score(decayed + impact, hp.min_score, hp.max_score)



def compute_relationship_score(
    events: Iterable[MetadataEvent],
    previous_score: float = 50.0,
    as_of: datetime | None = None,
    hp: ScoringHyperParams | None = None,
) -> float:
    hp = hp or ScoringHyperParams()
    event_list = sorted(list(events), key=lambda e: e.ts)

    if not event_list:
        return round(clamp_score(previous_score, hp.min_score, hp.max_score), 2)

    now = as_of or datetime.now(timezone.utc)
    score = clamp_score(previous_score, hp.min_score, hp.max_score)

    prev_ts = event_list[0].ts
    for event in event_list:
        delta_t_days = _days_between(event.ts, prev_ts)
        score = update_score(
            old_score=score,
            event=event,
            delta_t_days=delta_t_days,
            reference_time=now,
            hp=hp,
        )
        prev_ts = event.ts

    tail_days = _days_between(now, prev_ts)
    score = score * math.exp(-hp.lambda_decay * tail_days)

    return round(clamp_score(score, hp.min_score, hp.max_score), 2)
