# Judge Talking Points

1. Privacy-first by design
- No raw chat content persisted anywhere.
- Stored records are hashed IDs + metadata + short summaries + embeddings only.

2. Automation depth
- End-to-end cycle: ingest -> score -> anomaly detection -> RAG context -> LLM planning -> action scheduling.
- Supports draft generation, mock send, and auto-nudge scheduling.

3. Multi-engine resilience
- OpenAI path for speed during hackathon demos.
- Local fallback path (sentence-transformers + FAISS + local LLM endpoint) for privacy/offline mode.

4. Explainable scoring
- Mathematical exponential decay model with transparent hyperparameters.
- Color-coded score bands map directly to recommendation urgency.

5. Deployability
- One command startup via docker-compose.
- Service separation (frontend, API, ML) allows incremental production hardening.
