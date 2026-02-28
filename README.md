# bubbleOne MVP - Social Life on Auto-Pilot

Privacy-first relationship management AI hackathon scaffold.

## What this MVP does
- Ingests synthetic communication metadata + abstractive summaries (no raw chat text).
- Computes relationship health scores with exponential decay.
- Uses RAG memory (FAISS + SQLite) and LangGraph orchestration.
- Produces actionable suggestions (draft, reminder, deprioritize, schedule).
- Shows a web dashboard with score bands, action center, draft+send flow, and privacy toggle.

## Architecture
- `services/frontend`: React + TypeScript + Tailwind dashboard
- `services/api`: Node + Express orchestration API + privacy guards + audit hash chain stub
- `services/ml`: Python FastAPI ML pipeline (scoring, embeddings, RAG, LangGraph)

## One-click local run

```bash
./scripts/run_all.sh
```

Or directly:

```bash
docker compose up --build
```

If you want to use OpenAI providers, create `.env` from `.env.example` and set `OPENAI_API_KEY`.

Open:
- Frontend: `http://localhost:3000`
- API: `http://localhost:8000/health`
- ML: `http://localhost:8001/health`

## Demo flow
1. Start stack.
2. Run demo seed script:

```bash
./scripts/demo_run.sh
```

3. Refresh frontend dashboard and show action queue.
4. Use **Draft + Send** and **Auto-Nudge** buttons.
5. Show audit chain endpoint: `GET /api/audit/chain`.

## API keys and providers
Put keys in `.env`:

```bash
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4o-mini
OPENAI_EMBED_MODEL=text-embedding-3-small
LLM_PROVIDER=openai
EMBEDDING_PROVIDER=openai
```

### Local privacy fallback (no remote LLM/embeddings)
Set:

```bash
LLM_PROVIDER=local
EMBEDDING_PROVIDER=local
LOCAL_LLM_URL=http://host.docker.internal:11434/api/generate
```

Then run local services on host:
- LLM endpoint (e.g. llama.cpp server or Ollama)
- Local embeddings are handled in ML service via `sentence-transformers` fallback.

## Synthetic dataset generator
Generate exportable privacy-safe metadata:

```bash
docker compose run --rm ml python scripts/generate_synthetic_dataset.py --output /app/data/synthetic/chat_metadata_export.json
```

Output includes:
- hashed contact IDs
- timestamps
- interaction type
- sentiment
- intent
- abstractive summary
- metadata

No raw message text is generated.

## Tests
Scoring unit tests:

```bash
docker compose run --rm ml pytest -q
```

Quick local verification (compose config + ML compile/tests + dataset smoke):

```bash
./scripts/verify.sh
```

## Important privacy guarantees in this scaffold
- Raw message fields are rejected/stripped at ingest.
- Persistent stores keep only hashed IDs, metadata, summaries, and embeddings.
- Audit chain stores payload hashes, not plaintext payloads.

## Docs
- `docs/scoring_algorithm.md`
- `docs/rag_schema.md`
- `docs/langgraph_spec.md`
- `docs/pipeline_pseudocode.md`
- `docs/work_breakdown_12h.md`
- `docs/judge_talking_points.md`
- `docs/genai_prompts.md`
- `docs/blockchain_stub.md`

## Repo structure note
- Active MVP stack lives under `services/` plus root infra/docs.
- Older prototype files were moved to `legacy/` to keep the scaffold clean.
