# Pipeline Pseudocode

```text
ingest(events):
  reject raw_message/message_text/full_text fields
  normalize metadata events + summaries
  persist to API metadata store

for each contact:
  embeddings = embed(summaries)
  upsert embeddings + summaries + metadata into RAG (FAISS + SQLite)

  score = previous_score
  for event in chronological_events:
    score = clamp(score * exp(-lambda * delta_t) + impact(event), 0, 100)

  flow_state = {
    contact_hash,
    current_score=score,
    previous_score,
    recent_metadata=tail(events),
  }

  recommendation = langgraph(flow_state)

  if recommendation.action_type == "draft_and_schedule":
    create draft card + schedule follow-up
  elif recommendation.action_type == "draft":
    create draft card
  elif recommendation.action_type == "reminder":
    create reminder task
  else:
    deprioritize in queue

  expose dashboard data + action queue via API
```
