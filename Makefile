.PHONY: up down test demo seed check

up:
	docker compose up --build

down:
	docker compose down

test:
	docker compose run --rm ml pytest -q

demo:
	./scripts/demo_run.sh

seed:
	docker compose run --rm ml python scripts/generate_synthetic_dataset.py --output /app/data/synthetic/chat_metadata_export.json

check:
	./scripts/verify.sh
