# Manifest (MVP Scaffold)

```text
bubbleOne/
├── .env.example
├── .gitignore
├── docker-compose.yml
├── Makefile
├── README.md
├── MANIFEST.md
├── scripts/
│   ├── run_all.sh
│   ├── demo_run.sh
│   └── verify.sh
├── docs/
│   ├── scoring_algorithm.md
│   ├── rag_schema.md
│   ├── langgraph_spec.md
│   ├── pipeline_pseudocode.md
│   ├── work_breakdown_12h.md
│   ├── judge_talking_points.md
│   ├── genai_prompts.md
│   └── blockchain_stub.md
├── services/
│   ├── api/
│   │   ├── Dockerfile
│   │   ├── .dockerignore
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── types.ts
│   │       ├── routes/index.ts
│   │       ├── clients/mlClient.ts
│   │       ├── store/store.ts
│   │       ├── audit/chain.ts
│   │       └── utils/hash.ts
│   ├── ml/
│   │   ├── Dockerfile
│   │   ├── .dockerignore
│   │   ├── requirements.txt
│   │   ├── pytest.ini
│   │   ├── app/
│   │   │   ├── main.py
│   │   │   ├── config.py
│   │   │   ├── models.py
│   │   │   ├── scoring.py
│   │   │   ├── embeddings.py
│   │   │   ├── rag_store.py
│   │   │   ├── llm_clients.py
│   │   │   └── langgraph_flow.py
│   │   ├── tests/test_scoring.py
│   │   └── scripts/generate_synthetic_dataset.py
│   └── frontend/
│       ├── Dockerfile
│       ├── .dockerignore
│       ├── nginx.conf
│       ├── package.json
│       ├── tsconfig.json
│       ├── vite.config.ts
│       ├── tailwind.config.ts
│       ├── postcss.config.js
│       ├── index.html
│       └── src/
│           ├── main.tsx
│           ├── App.tsx
│           ├── api.ts
│           ├── types.ts
│           ├── styles.css
│           └── vite-env.d.ts
├── data/
│   └── synthetic/
│       └── chat_metadata_export.json
└── legacy/
    ├── prototypes/
    │   ├── main.py
    │   ├── relationship_health_scoring.py
    │   ├── relationship_health_scores.json
    │   ├── requirements.txt
    │   └── synthetic_communication_metadata.json
    └── nextjs_ui/
        └── app/page.tsx
```
