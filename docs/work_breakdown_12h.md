# 12-Hour Single-Developer Work Breakdown

1. Hour 0-1: Repo setup, docker-compose, service contracts.
2. Hour 1-3: ML core (scoring module, dataset generator, tests).
3. Hour 3-5: RAG implementation (embeddings abstraction + FAISS/SQLite).
4. Hour 5-6: LangGraph orchestration + planner fallback logic.
5. Hour 6-8: Backend API + privacy guards + audit stub.
6. Hour 8-10: Frontend dashboard, action center, draft/send flow.
7. Hour 10-11: Demo scripts, synthetic data seeding, README polish.
8. Hour 11-12: End-to-end smoke test + bug fixes.

## Scope guardrails
- Keep persistence local and minimal.
- Do not build direct messaging integrations; mock send only.
- Prioritize reliable pipeline over advanced UX edge cases.
