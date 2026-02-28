from __future__ import annotations

import hashlib
from typing import Iterable

import numpy as np
from openai import OpenAI

from .config import Settings


class EmbeddingClient:
    def __init__(self, settings: Settings):
        self.settings = settings
        self._openai: OpenAI | None = None
        self._local_model = None

        if settings.embedding_provider == "openai" and settings.openai_api_key:
            self._openai = OpenAI(api_key=settings.openai_api_key)

    def _ensure_local_model(self):
        if self._local_model is not None:
            return self._local_model

        try:
            from sentence_transformers import SentenceTransformer

            self._local_model = SentenceTransformer("all-MiniLM-L6-v2")
        except Exception:
            self._local_model = None
        return self._local_model

    @staticmethod
    def _hash_embedding(text: str, dim: int = 384) -> np.ndarray:
        digest = hashlib.sha256(text.encode("utf-8")).digest()
        raw = np.frombuffer((digest * ((dim // len(digest)) + 1))[:dim], dtype=np.uint8)
        vec = (raw.astype(np.float32) / 255.0) - 0.5
        norm = np.linalg.norm(vec)
        return vec / norm if norm > 0 else vec

    def embed_texts(self, texts: Iterable[str]) -> np.ndarray:
        text_list = list(texts)
        if not text_list:
            return np.zeros((0, 384), dtype=np.float32)

        if self._openai is not None:
            try:
                response = self._openai.embeddings.create(
                    model=self.settings.openai_embed_model,
                    input=text_list,
                )
                vectors = [item.embedding for item in response.data]
                return np.array(vectors, dtype=np.float32)
            except Exception:
                # Fail open to local fallback for resilience (bad key, quota, timeout, etc.).
                self._openai = None

        local_model = self._ensure_local_model()
        if local_model is not None:
            vectors = local_model.encode(
                text_list,
                normalize_embeddings=True,
                convert_to_numpy=True,
                show_progress_bar=False,
            )
            return vectors.astype(np.float32)

        vectors = [self._hash_embedding(text) for text in text_list]
        return np.vstack(vectors).astype(np.float32)
