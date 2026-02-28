from __future__ import annotations

import json
import sqlite3
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

import numpy as np

try:
    import faiss  # type: ignore
except Exception:  # pragma: no cover
    faiss = None


@dataclass
class RagResult:
    event_id: str
    contact_hash: str
    summary: str
    metadata: Dict[str, Any]
    created_at: str
    score: float


class RagStore:
    def __init__(self, data_dir: Path):
        self.db_path = data_dir / "rag.sqlite"
        self.index_path = data_dir / "rag.index"
        self.id_map_path = data_dir / "rag.index.ids.json"
        self.fallback_matrix_path = data_dir / "rag.matrix.npy"

        self._index = None
        self._id_map: List[int] = []
        self._matrix = np.zeros((0, 384), dtype=np.float32)

        self._init_db()
        self._load_state()

    def _connect(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS rag_chunks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    event_id TEXT NOT NULL,
                    contact_hash TEXT NOT NULL,
                    summary TEXT NOT NULL,
                    metadata_json TEXT NOT NULL,
                    created_at TEXT NOT NULL
                )
                """
            )
            conn.commit()

    def _load_state(self) -> None:
        if self.id_map_path.exists():
            self._id_map = json.loads(self.id_map_path.read_text(encoding="utf-8"))

        if faiss is not None and self.index_path.exists():
            self._index = faiss.read_index(str(self.index_path))
            return

        if self.fallback_matrix_path.exists():
            self._matrix = np.load(self.fallback_matrix_path)

    def _persist_state(self) -> None:
        self.id_map_path.write_text(json.dumps(self._id_map), encoding="utf-8")

        if faiss is not None and self._index is not None:
            faiss.write_index(self._index, str(self.index_path))
            return

        np.save(self.fallback_matrix_path, self._matrix)

    def _ensure_index(self, dim: int) -> None:
        if faiss is None:
            return
        if self._index is None:
            self._index = faiss.IndexFlatIP(dim)

    @staticmethod
    def _normalize(vec: np.ndarray) -> np.ndarray:
        norm = np.linalg.norm(vec)
        if norm <= 0:
            return vec
        return vec / norm

    def add_record(
        self,
        *,
        event_id: str,
        contact_hash: str,
        summary: str,
        metadata: Dict[str, Any],
        embedding: np.ndarray,
    ) -> int:
        created_at = datetime.now(timezone.utc).isoformat()
        with self._connect() as conn:
            cur = conn.execute(
                """
                INSERT INTO rag_chunks(event_id, contact_hash, summary, metadata_json, created_at)
                VALUES(?, ?, ?, ?, ?)
                """,
                (event_id, contact_hash, summary, json.dumps(metadata), created_at),
            )
            conn.commit()
            row_id = int(cur.lastrowid)

        vec = self._normalize(embedding.astype(np.float32))

        if faiss is not None:
            self._ensure_index(vec.shape[0])
            self._index.add(vec.reshape(1, -1))
        else:
            if self._matrix.size == 0:
                self._matrix = vec.reshape(1, -1)
            else:
                self._matrix = np.vstack([self._matrix, vec.reshape(1, -1)])

        self._id_map.append(row_id)
        self._persist_state()
        return row_id

    def query(self, *, contact_hash: str, query_embedding: np.ndarray, k: int = 4) -> List[RagResult]:
        if not self._id_map:
            return []

        query = self._normalize(query_embedding.astype(np.float32)).reshape(1, -1)
        candidate_pairs: List[tuple[int, float]] = []

        if faiss is not None and self._index is not None and self._index.ntotal > 0:
            limit = min(max(k * 4, k), len(self._id_map))
            scores, idxs = self._index.search(query, limit)
            for score, idx in zip(scores[0].tolist(), idxs[0].tolist()):
                if idx < 0:
                    continue
                candidate_pairs.append((self._id_map[idx], float(score)))
        else:
            sims = np.dot(self._matrix, query[0]) if self._matrix.size else np.array([])
            order = np.argsort(-sims)[: max(k * 4, k)]
            for idx in order.tolist():
                candidate_pairs.append((self._id_map[idx], float(sims[idx])))

        results: List[RagResult] = []
        with self._connect() as conn:
            for row_id, score in candidate_pairs:
                row = conn.execute(
                    "SELECT * FROM rag_chunks WHERE id = ?",
                    (row_id,),
                ).fetchone()
                if row is None or row["contact_hash"] != contact_hash:
                    continue

                results.append(
                    RagResult(
                        event_id=row["event_id"],
                        contact_hash=row["contact_hash"],
                        summary=row["summary"],
                        metadata=json.loads(row["metadata_json"]),
                        created_at=row["created_at"],
                        score=round(score, 4),
                    )
                )
                if len(results) >= k:
                    break

        return results
