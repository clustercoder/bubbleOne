from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    data_dir: Path
    openai_api_key: str
    openai_model: str
    openai_embed_model: str
    llm_provider: str
    embedding_provider: str
    local_llm_url: str



def get_settings() -> Settings:
    data_dir = Path(os.getenv("DATA_DIR", "./data")).resolve()
    data_dir.mkdir(parents=True, exist_ok=True)

    return Settings(
        data_dir=data_dir,
        openai_api_key=os.getenv("OPENAI_API_KEY", ""),
        openai_model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
        openai_embed_model=os.getenv("OPENAI_EMBED_MODEL", "text-embedding-3-small"),
        llm_provider=os.getenv("LLM_PROVIDER", "openai").lower(),
        embedding_provider=os.getenv("EMBEDDING_PROVIDER", "openai").lower(),
        local_llm_url=os.getenv("LOCAL_LLM_URL", "http://localhost:11434/api/generate"),
    )
