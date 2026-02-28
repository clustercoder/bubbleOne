# Relationship Health Scoring

## Formula
For each event in chronological order:

R_new = clamp((R_old * exp(-lambda * delta_t_days)) + interaction_impact, 0, 100)

Where:
- `R_old`: prior score (0..100)
- `lambda`: temporal decay factor
- `delta_t_days`: elapsed days since previous event
- `interaction_impact`: weighted effect of interaction type, intent, sentiment, and recency

### Interaction impact
interaction_impact = (w_type + w_intent + w_sentiment * sentiment) * exp(-gamma * days_old)

## Hyperparameters (MVP defaults)
- `lambda = 0.08` (daily decay)
- `gamma = 0.05` (older events contribute less)
- `w_sentiment = 6.0`
- interaction weights:
  - `call: +8.0`
  - `text: +4.0`
  - `ignored_message: -7.0`
  - `auto_nudge: +2.0`
  - `missed_call: -3.0`
- intent weights:
  - `support: +2.5`
  - `plan_event: +2.0`
  - `follow_up: +1.5`
  - `check_in: +1.2`
  - `small_talk: +0.5`

## Bands
- `good`: score >= 75
- `fading`: 45 <= score < 75
- `critical`: score < 45

## Privacy constraints
- Input events must contain only metadata + short abstractive summary.
- No raw message body is accepted or stored.
