#!/usr/bin/env python3
"""Generate synthetic chat metadata + abstractive summaries (no raw message text)."""

from __future__ import annotations

import argparse
import hashlib
import json
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path

CONTACTS = ["Alex", "Maya", "Jordan", "Priya", "Sam"]
INTERACTIONS = ["text", "call", "ignored_message", "auto_nudge", "missed_call"]
INTENTS = ["check_in", "support", "plan_event", "small_talk", "follow_up"]
SUMMARY_TEMPLATES = {
    "text": "Exchanged short updates about day-to-day life.",
    "call": "Had a meaningful call and shared recent highlights.",
    "ignored_message": "An outgoing message did not receive a reply yet.",
    "auto_nudge": "System issued a gentle reminder to reconnect.",
    "missed_call": "Attempted to connect by phone but did not complete.",
}



def hash_contact(name: str) -> str:
    return hashlib.sha256(name.encode("utf-8")).hexdigest()[:16]



DEFAULT_START = datetime(2026, 1, 1, tzinfo=timezone.utc)


def parse_start(start_date: str | None) -> datetime:
    if not start_date:
        return DEFAULT_START

    parsed = datetime.fromisoformat(start_date)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def generate(days: int, seed: int, start_date: datetime):
    random.seed(seed)
    start = start_date.replace(hour=0, minute=0, second=0, microsecond=0)

    contacts = [{"alias": name, "contact_hash": hash_contact(name)} for name in CONTACTS]
    events = []

    for offset in range(days):
        day = start + timedelta(days=offset)
        for contact in contacts:
            count = random.choices([0, 1, 2, 3], weights=[0.2, 0.45, 0.25, 0.1], k=1)[0]
            for i in range(count):
                interaction = random.choices(
                    INTERACTIONS,
                    weights=[0.5, 0.22, 0.12, 0.1, 0.06],
                    k=1,
                )[0]
                ts = day + timedelta(seconds=random.randint(0, 86399))

                if interaction in {"call", "text"}:
                    sentiment = round(random.uniform(-0.2, 1.0), 3)
                elif interaction == "ignored_message":
                    sentiment = round(random.uniform(-1.0, -0.2), 3)
                else:
                    sentiment = round(random.uniform(-0.6, 0.4), 3)

                event = {
                    "event_id": f"evt_{contact['contact_hash']}_{offset}_{i}",
                    "contact_hash": contact["contact_hash"],
                    "ts": ts.isoformat(),
                    "interaction_type": interaction,
                    "sentiment": sentiment,
                    "intent": random.choice(INTENTS),
                    # Abstractive, privacy-safe summary. No raw transcript text included.
                    "summary": SUMMARY_TEMPLATES[interaction],
                    "metadata": {
                        "channel": "mobile",
                        "source": "synthetic_generator",
                    },
                }
                events.append(event)

    events.sort(key=lambda item: item["ts"])
    return {"contacts": contacts, "events": events}



def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--days", type=int, default=30)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument(
        "--start-date",
        type=str,
        default="2026-01-01T00:00:00+00:00",
        help="ISO date/time for deterministic generation (UTC if timezone omitted).",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("data/synthetic/chat_metadata_export.json"),
    )
    args = parser.parse_args()

    payload = generate(
        days=args.days,
        seed=args.seed,
        start_date=parse_start(args.start_date),
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    print(f"Wrote {len(payload['events'])} events to {args.output}")


if __name__ == "__main__":
    main()
