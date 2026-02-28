# GenAI Prompts Per Module

## Backend API prompt
"Create a TypeScript Express API with endpoints for /api/ingest, /api/dashboard, /api/actions/draft, /api/actions/send, /api/actions/auto-nudge, and /api/audit/chain. Enforce privacy: strip raw chat text fields and store only metadata + summaries + hashed IDs. Integrate with an ML FastAPI service for score + recommendation."

## ML service prompt
"Create a Python FastAPI ML service with modules: scoring.py (exponential decay score), embeddings.py (OpenAI default + sentence-transformers fallback), rag_store.py (SQLite + FAISS), langgraph_flow.py (anomaly -> query_rag -> plan_action -> schedule), and tests for scoring guardrails."

## Frontend prompt
"Build a React+TypeScript+Tailwind dashboard with contact score list, suggestion cards, draft + send modal flow, and privacy toggle. Integrate with API endpoints and show pending actions + metrics. Keep style modern and futuristic."

## Docker/infra prompt
"Generate Dockerfiles for React frontend (build + nginx), Node API, and Python ML service plus docker-compose for one-command startup. Include .env example, run scripts, and README instructions for OpenAI defaults and local fallback mode."

## Fine-tuning/system prompt seed
"You are bubbleOne's planner model. Input is privacy-safe metadata and summaries. Output only compact JSON with recommendation, action_type, priority, and schedule_in_hours. Never request or retain raw chat text."
