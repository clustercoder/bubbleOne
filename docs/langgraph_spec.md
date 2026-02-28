# LangGraph Orchestration Spec

## State
`FlowState`
- `contact_hash: str`
- `alias: str`
- `current_score: float`
- `previous_score: float`
- `recent_metadata: list[dict]`
- `rag_context: str`
- `anomaly_detected: bool`
- `anomaly_reason: str`
- `recommended_action: str`
- `action_type: str`
- `priority: str`
- `schedule_in_hours: int`
- `schedule_at: str | None`

## Nodes
1. `analyze_anomaly`
   - Input: score delta + recent sentiment metadata
   - Output: `anomaly_detected`, `anomaly_reason`
   - Trigger: every scoring cycle

2. `query_rag`
   - Input: recent summaries + contact hash
   - Action: embedding query against FAISS/SQLite memory
   - Output: `rag_context`
   - Trigger: anomaly path only (default)

3. `plan_action`
   - Input: score, anomaly flags, recent metadata, rag context
   - Action: LLM plan generation (OpenAI default, local fallback)
   - Output: `recommended_action`, `action_type`, `priority`, `schedule_in_hours`

4. `schedule_action`
   - Input: `schedule_in_hours`
   - Output: `schedule_at` UTC timestamp

## Graph routing
- `START -> analyze_anomaly`
- If anomaly: `analyze_anomaly -> query_rag -> plan_action -> schedule_action -> END`
- Else: `analyze_anomaly -> plan_action -> schedule_action -> END`
