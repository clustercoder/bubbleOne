from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.models import MetadataEvent
from app.scoring import clamp_score, compute_relationship_score, risk_level_for_score, train_temporal_decay



def _event(
    *,
    idx: int,
    interaction_type: str,
    sentiment: float,
    ts: datetime,
    intent: str = "check_in",
) -> MetadataEvent:
    return MetadataEvent(
        event_id=f"evt_{idx}",
        contact_hash="abc123",
        ts=ts,
        interaction_type=interaction_type,
        sentiment=sentiment,
        intent=intent,
        summary="Synthetic summary text.",
        metadata={"source": "test"},
    )



def test_clamp_score_bounds() -> None:
    assert clamp_score(-5.0) == 0.0
    assert clamp_score(120.0) == 100.0
    assert clamp_score(55.5) == 55.5



def test_positive_interactions_raise_score() -> None:
    now = datetime(2026, 2, 28, tzinfo=timezone.utc)
    events = [
        _event(
            idx=1,
            interaction_type="call",
            sentiment=0.9,
            intent="support",
            ts=now - timedelta(days=2),
        ),
        _event(
            idx=2,
            interaction_type="text",
            sentiment=0.7,
            intent="follow_up",
            ts=now - timedelta(days=1),
        ),
    ]

    score = compute_relationship_score(events, previous_score=50.0, as_of=now)
    assert score > 50.0



def test_negative_interactions_reduce_score() -> None:
    now = datetime(2026, 2, 28, tzinfo=timezone.utc)
    events = [
        _event(
            idx=1,
            interaction_type="ignored_message",
            sentiment=-0.9,
            ts=now - timedelta(days=3),
        ),
        _event(
            idx=2,
            interaction_type="missed_call",
            sentiment=-0.7,
            ts=now - timedelta(days=1),
        ),
    ]

    score = compute_relationship_score(events, previous_score=70.0, as_of=now)
    assert score < 70.0



def test_score_always_stays_between_zero_and_hundred() -> None:
    now = datetime(2026, 2, 28, tzinfo=timezone.utc)
    events = []

    for i in range(40):
        events.append(
            _event(
                idx=i,
                interaction_type="ignored_message",
                sentiment=-1.0,
                ts=now - timedelta(hours=40 - i),
            )
        )

    score = compute_relationship_score(events, previous_score=95.0, as_of=now)
    assert 0.0 <= score <= 100.0


def test_temporal_decay_training_stays_in_bounds() -> None:
    now = datetime(2026, 2, 28, tzinfo=timezone.utc)
    events = [
        _event(idx=1, interaction_type="text", sentiment=0.3, ts=now - timedelta(days=10)),
        _event(idx=2, interaction_type="call", sentiment=0.4, ts=now - timedelta(days=7)),
        _event(idx=3, interaction_type="ignored_message", sentiment=-0.2, ts=now - timedelta(days=1)),
    ]

    trained = train_temporal_decay(events, base_lambda=0.08)
    assert 0.03 <= trained <= 0.2


def test_risk_level_escalates_with_anomaly() -> None:
    assert risk_level_for_score(82.0, anomaly_detected=False) == "low"
    assert risk_level_for_score(60.0, anomaly_detected=False) == "medium"
    assert risk_level_for_score(82.0, anomaly_detected=True) == "high"
