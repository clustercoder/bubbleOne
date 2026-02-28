# RAG Store Schema (Privacy-first)

## Stored artifacts
- Embeddings vectors (`FAISS IndexFlatIP`)
- Metadata and short abstractive summaries (`SQLite` table `rag_chunks`)
- ID map (`rag.index.ids.json`)

## SQLite table: `rag_chunks`
- `id INTEGER PRIMARY KEY`
- `event_id TEXT` (synthetic/hashed identifier)
- `contact_hash TEXT` (hashed user/contact ID)
- `summary TEXT` (abstractive summary, max ~280 chars)
- `metadata_json TEXT` (interaction type, sentiment, timestamp, source)
- `created_at TEXT`

## What is NOT stored
- Raw chat text
- Full transcript
- Message attachments
- Unhashed personal IDs

## Why this schema
- Enables retrieval of relationship context by semantic similarity.
- Keeps persisted data privacy-safe and compact.
- Supports local/offline retrieval path with FAISS + sentence-transformers.
