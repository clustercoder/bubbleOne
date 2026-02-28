#!/usr/bin/env python3
"""
Generate synthetic communication metadata and compute relationship health scores.
"""

from __future__ import annotations

import json
import math
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, List

CONTACTS = ["Aarav", "Maya", "Rohan", "Priya", "Zane"]
INTERACTION_TYPES = ["text", "call", "ignored_message"]
INTENTS = [
    "check_in",
    "support",
    "plan_event",
    "small_talk",
    "request_help",
    "follow_up",
]


def clamp(value: float, low: float = 0.0, high: float = 100.0) -> float:
    return max(low, min(high, value))


def generate_synthetic_dataset(
    contacts: List[str],
    days: int = 30,
    seed: int = 42,
) -> List[dict]:
    random.seed(seed)
    start_date = (datetime.now(timezone.utc) - timedelta(days=days)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )

    data: List[dict] = []
    for day_offset in range(days):
        day_base = start_date + timedelta(days=day_offset)
        for contact in contacts:
            interactions_today = random.choices(
                population=[0, 1, 2, 3], weights=[0.25, 0.4, 0.25, 0.1], k=1
            )[0]

            for _ in range(interactions_today):
                timestamp = day_base + timedelta(seconds=random.randint(0, 86399))
                interaction_type = random.choices(
                    population=INTERACTION_TYPES, weights=[0.6, 0.25, 0.15], k=1
                )[0]

                if interaction_type == "call":
                    sentiment = round(random.uniform(0.1, 1.0), 3)
                elif interaction_type == "text":
                    sentiment = round(random.uniform(-0.4, 0.9), 3)
                else:
                    sentiment = round(random.uniform(-1.0, -0.1), 3)

                data.append(
                    {
                        "timestamp": timestamp.isoformat(),
                        "contact_name": contact,
                        "interaction_type": interaction_type,
                        "sentiment_score": sentiment,
                        "intent": random.choice(INTENTS),
                    }
                )

    data.sort(key=lambda row: row["timestamp"])
    return data


def interaction_impact(record: dict) -> float:
    base_impact = {
        "text": 3.5,
        "call": 6.5,
        "ignored_message": -7.0,
    }[record["interaction_type"]]

    intent_bonus = {
        "check_in": 1.0,
        "support": 2.5,
        "plan_event": 1.8,
        "small_talk": 0.4,
        "request_help": 1.2,
        "follow_up": 1.0,
    }[record["intent"]]

    return base_impact + (record["sentiment_score"] * 8.0) + intent_bonus


def compute_relationship_scores(
    records: List[dict],
    contacts: List[str],
    lambda_decay: float = 0.06,
    starting_score: float = 50.0,
) -> Dict[str, float]:
    if not records:
        return {contact: starting_score for contact in contacts}

    records = sorted(records, key=lambda row: row["timestamp"])
    all_times = [datetime.fromisoformat(row["timestamp"]) for row in records]
    start_time = min(all_times)
    end_time = max(all_times)

    scores = {contact: starting_score for contact in contacts}
    last_seen = {contact: start_time for contact in contacts}

    for record in records:
        contact = record["contact_name"]
        timestamp = datetime.fromisoformat(record["timestamp"])
        delta_t_days = (timestamp - last_seen[contact]).total_seconds() / 86400.0

        decayed = scores[contact] * math.exp(-lambda_decay * delta_t_days)
        updated = decayed + interaction_impact(record)
        scores[contact] = clamp(updated, 0.0, 100.0)
        last_seen[contact] = timestamp

    for contact in contacts:
        delta_t_days = (end_time - last_seen[contact]).total_seconds() / 86400.0
        decayed = scores[contact] * math.exp(-lambda_decay * delta_t_days)
        scores[contact] = round(clamp(decayed, 0.0, 100.0), 2)

    return scores


def write_json(path: Path, payload: dict | List[dict]) -> None:
    with path.open("w", encoding="utf-8") as file:
        json.dump(payload, file, indent=2)


def main() -> None:
    records = generate_synthetic_dataset(CONTACTS, days=30, seed=42)
    dataset_path = Path("synthetic_communication_metadata.json")
    write_json(dataset_path, records)

    scores = compute_relationship_scores(records, CONTACTS)
    scores_path = Path("relationship_health_scores.json")
    write_json(scores_path, scores)

    print(f"Generated {len(records)} metadata rows in {dataset_path}")
    print("Final Relationship Health Scores (0-100):")
    for name in CONTACTS:
        print(f"  {name}: {scores[name]}")
    print(f"Saved score report to {scores_path}")


if __name__ == "__main__":
    main()
