# bubbleOne Judge Presentation Guide

This document is a practical playbook for presenting bubbleOne to judges.

It includes:
- a concise pitch narrative,
- live demo sequence,
- what to emphasize for scoring,
- backup plans,
- mock questions and strong sample answers.

---

## 1) 60-Second Elevator Pitch

"bubbleOne is a privacy-first autonomous relationship copilot. Instead of storing raw chats, it ingests communication metadata, computes an interpretable relationship health score with temporal decay, detects anomalies like frequency drops, retrieves historical context through RAG, and uses a LangGraph workflow to recommend or auto-trigger actions. It also learns from outcomes: if a draft is sent, the model gets more confident; if ignored, it backs off. The result is a self-evolving relationship management engine that runs locally with optional cloud models for speed."

---

## 2) 3-Minute Technical Pitch (Structured)

## Part A - Problem
- Relationships fail from neglect, not intent.
- Reminder apps are static and context-poor.
- Privacy concerns prevent many users from using AI tools that need raw chat logs.

## Part B - Approach
- Use metadata-only ingestion.
- Score each relationship using decay-based math and interaction impact.
- Detect anomalies and route through LangGraph + RAG.
- Trigger actions automatically with a worker.
- Learn from feedback signals (`send` vs `ignore`).

## Part C - Why it works
- Interpretable math.
- Structured orchestration around LLM.
- Practical autonomous loop.
- Strong privacy posture.

---

## 3) Judge-Focused Value Mapping

Most hackathons evaluate versions of the following.

## 3.1 Innovation
- Not just chatbot Q&A: autonomous loop + adaptive tuning + anomaly triggering.
- Clear modular architecture with real decision pipeline.

## 3.2 Technical Depth
- ML scoring with temporal decay.
- LangGraph flow with conditional RAG retrieval.
- Feedback-driven parameter adaptation.
- Background worker for continuous behavior.

## 3.3 User Impact
- Prevents social relationship drift.
- Action-oriented outputs, not just analytics.
- Friendly workflow: draft generation and one-click completion.

## 3.4 Feasibility
- Reproducible local stack with Docker.
- Clear fallback modes (OpenAI and local providers).
- Runnable demo script.

## 3.5 Responsible AI / Privacy
- Metadata-only persistence.
- Raw text filtering at ingest.
- Hashed contact identifiers.
- Hash-chain audit trail option.

---

## 4) Recommended Live Demo Script (5-7 Minutes)

## Step 1 - Open Dashboard
- Show 3-column social-style layout.
- Explain left rail (metrics + worker), center feed (contacts), right rail (actions).

What to say:
- "This is live state from the API store. The worker is ticking in the background."

## Step 2 - Seed Data
Run:
```bash
./scripts/demo_run.sh
```

What to say:
- "I’m injecting synthetic metadata events only; no raw chats are used."

## Step 3 - Show Score + Risk + Anomaly
- Pick one contact in critical or fading state.
- Point to band, risk badge, anomaly reason.

What to say:
- "The score is bounded 0-100 and updates via temporal decay and interaction impact."

## Step 4 - Show Draft Flow
- Click `Draft + Send`.
- Open modal and show message.
- Click `Mock Send`.

What to say:
- "This draft comes from ML `draft_message`, not a static template."

## Step 5 - Show Feedback Loop
- Ignore a different action from right rail.
- Refresh/observe changed behavior over subsequent cycles.

What to say:
- "Send actions reward this contact’s tuning; ignored actions penalize it."

## Step 6 - Show Ledger Endpoint
Open:
```bash
curl http://localhost:8000/api/audit/chain
```

What to say:
- "Every key automation event gets hashed and appended for auditability."

---

## 5) If Demo Goes Wrong (Recovery Plan)

## Scenario A - API down
- Run `docker compose ps`
- Restart `docker compose up -d --build`
- Show health endpoints.

## Scenario B - OpenAI key issue
- Switch to local fallback configuration (`LLM_PROVIDER=local`, `EMBEDDING_PROVIDER=local`).
- Mention resilient embedding fallback behavior.

## Scenario C - Empty dashboard
- Run `./scripts/demo_run.sh` again.
- Explain that state is persisted and can be reset by clearing `data/`.

## Scenario D - UI lag or stale browser
- hard refresh browser
- confirm API `/api/dashboard` output directly.

---

## 6) Strong Talking Points (Short and Memorable)

- "Autonomy, not just suggestions."
- "Metadata in, action out."
- "Explainable by design, not opaque."
- "Feedback closes the loop."
- "Privacy is a first-class architecture decision."

---

## 7) Mock Judge Questions and Sample Answers

## 7.1 Product and Problem

**Q1: Why is this better than reminders in a calendar app?**  
A: Calendar reminders are static and context-free. bubbleOne combines metadata scoring, anomaly detection, historical retrieval, and adaptive action generation so interventions are prioritized and personalized rather than fixed-time generic nudges.

**Q2: What user pain is most immediate here?**  
A: Relationship drift due to silent neglect. Users often care, but they forget timing and context. bubbleOne surfaces exactly who needs attention and what to do next.

**Q3: Who is the first target user?**  
A: Busy professionals and students managing multiple close relationships with limited cognitive bandwidth.

---

## 7.2 ML and Decision Logic

**Q4: Is this a black-box model?**  
A: No. Core relationship scoring is interpretable math with transparent parameters and bounds. LLM is used for action phrasing and planning inside a structured graph.

**Q5: How do you prevent score explosions or negative values?**  
A: Scores are clamped to `[0,100]` at every update.

**Q6: Why exponential decay?**  
A: It naturally models recency effects and allows stable, continuous fading without abrupt drops.

**Q7: How does the model adapt over time?**  
A: Through lightweight reinforcement: send events increase interaction weight and reduce decay; ignore events do the opposite, bounded by safe limits.

**Q8: How do you handle sparse data?**  
A: Defaults are robust (midpoint start, bounded params, fallback plans). RAG and planner still operate with limited summaries.

---

## 7.3 RAG and LangGraph

**Q9: Why add RAG if data is small?**  
A: Even in MVP scale, retrieval improves continuity and reduces generic outputs by grounding planning in prior summaries.

**Q10: Why LangGraph over one large prompt?**  
A: Node-based orchestration provides deterministic control, easier debugging, and clean insertion points for checks/policies.

**Q11: What if LLM fails?**  
A: Fallback planning returns deterministic recommendation/draft/action fields so system remains operational.

---

## 7.4 Privacy, Security, and Ethics

**Q12: Are raw messages stored anywhere?**  
A: No. Ingest sanitization strips raw-text-like keys, and persistence is metadata/summaries/embeddings only.

**Q13: Can users audit what happened?**  
A: Yes. Optional hash-chain ledger captures immutable event hashes and verification state.

**Q14: What is the risk of over-automation?**  
A: We keep user-in-the-loop actions visible in the UI, apply cooldowns, avoid duplicate pending actions, and allow easy ignore/disable controls.

---

## 7.5 Engineering and Scale

**Q15: How production-ready is this?**  
A: Architecture is production-shaped (service split, modular, reproducible) but still MVP-grade on auth, observability, and external integrations.

**Q16: How would you scale this?**  
A: Move from JSON local store to managed DB, add job queue for worker tasks, vector DB optimization, and tenant isolation/auth.

**Q17: What are likely bottlenecks?**  
A: High-frequency worker scans and retrieval at scale; both are manageable with partitioned stores and queue-based execution.

---

## 7.6 Business and Adoption

**Q18: What is defensible here?**  
A: Defensibility comes from privacy posture + behavior adaptation + orchestration graph + product UX around real relationship workflows.

**Q19: What KPI would you track first?**  
A: Action acceptance rate (`completed / pending`) and retention of active healthy contacts over time.

**Q20: What’s your moat vs generic AI chat tools?**  
A: Structured autonomous decisioning and domain-specific lifecycle logic, not just generic generation.

---

## 8) Judge Objection Handling Playbook

Objection: "This seems like a reminder app with LLM lipstick."  
Response: Show anomaly trigger, adaptive tuning deltas, and worker auto-actions in real time.

Objection: "How do I trust the recommendations?"  
Response: Explain interpretable score math, anomaly labels, and audit chain entries.

Objection: "What about privacy?"  
Response: Walk through sanitization, hashed IDs, no raw text persistence, and local fallback mode.

Objection: "What if API key fails?"  
Response: Mention local model + local embedding fallback and fail-open behavior in embedding client.

---

## 9) Evaluation Checklist Before You Present

- Docker services healthy.
- `./scripts/demo_run.sh` works.
- Dashboard populated.
- At least one critical and one fading contact visible.
- Draft modal works.
- Send and ignore both demonstrated.
- Audit chain endpoint returns `valid: true`.
- Backup screenshots prepared.

---

## 10) Presentation Closing Script

"bubbleOne demonstrates a practical path to autonomous social support: metadata-only ingestion, explainable scoring, anomaly-triggered interventions, RAG-grounded planning, and feedback-driven adaptation. It is privacy-first, technically deep, and deployable today as a local-first web product."

---

## 11) Optional 30-Second Add-On if Time Allows

- Mention local-only mode for privacy-conscious users.
- Mention future integrations (calendar/messaging) and consent controls.
- Mention measurable outcomes (reduced critical contacts, higher completion rate).
