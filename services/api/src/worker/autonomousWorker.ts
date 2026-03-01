import crypto from "crypto";

import { AuditChain } from "../audit/chain";
import { MLClient } from "../clients/mlClient";
import { ApiStore } from "../store/store";
import { ContactRecord } from "../types";

function envNumber(name: string, fallback: number): number {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(value)) return fallback;
  return value;
}

function shouldRunDaily(lastRunIso: string | null, now: Date): boolean {
  if (!lastRunIso) return true;
  const lastRun = new Date(lastRunIso);
  if (Number.isNaN(lastRun.getTime())) return true;
  return (
    lastRun.getUTCFullYear() !== now.getUTCFullYear() ||
    lastRun.getUTCMonth() !== now.getUTCMonth() ||
    lastRun.getUTCDate() !== now.getUTCDate()
  );
}

function isAutoActionDue(contact: ContactRecord, threshold: number): boolean {
  return (
    contact.currentScore <= threshold ||
    contact.riskLevel === "high" ||
    contact.anomalyReason === "frequency_drop" ||
    (contact.autoNudgeEnabled && contact.currentScore < 72)
  );
}

export function startAutonomousWorker(store: ApiStore, mlClient: MLClient, audit: AuditChain): () => void {
  const tickMs = envNumber("WORKER_TICK_MS", 15000);
  const autoDraftThreshold = envNumber("AUTO_DRAFT_THRESHOLD", 45);
  const autoCooldownHours = envNumber("AUTO_ACTION_COOLDOWN_HOURS", 6);
  const overdueIgnoreHours = envNumber("AUTO_IGNORE_HOURS", 24);

  let running = false;

  const runDailyRecompute = async (now: Date): Promise<void> => {
    const contacts = store.listContacts();
    for (const contact of contacts) {
      const events = store.getRecentEvents(contact.contactHash, 60);
      if (events.length === 0) continue;

      try {
        const counts = store.getInteractionCounts(contact.contactHash, 7);
        const mlOutcome = await mlClient.processContact({
          contact_hash: contact.contactHash,
          alias: contact.alias,
          events,
          previous_score: contact.currentScore,
          interaction_multiplier: contact.tuning.interactionMultiplier,
          lambda_decay_override: contact.tuning.lambdaDecay,
          recent_event_count_7d: counts.recent,
          prior_event_count_7d: counts.prior,
          temporal_training_enabled: true,
        });
        store.applyMLOutcome(contact.contactHash, contact.alias, mlOutcome);
        audit.append("daily_recompute_contact", {
          contactHash: contact.contactHash,
          score: mlOutcome.score,
          riskLevel: mlOutcome.risk_level,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Worker recompute failed for ${contact.alias}: ${message}`);
      }
    }

    store.markDailyRecompute(now.toISOString());
    audit.append("daily_recompute_complete", { contactCount: contacts.length });
  };

  const runAutoTriggers = (now: Date): void => {
    const contacts = store.listContacts();
    const nowIso = now.toISOString();
    const cooldownMs = autoCooldownHours * 3600000;

    for (const contact of contacts) {
      if (!isAutoActionDue(contact, autoDraftThreshold)) continue;

      const lastAutoTs = contact.lastAutoActionAt ? new Date(contact.lastAutoActionAt).getTime() : 0;
      if (lastAutoTs > 0 && now.getTime() - lastAutoTs < cooldownMs) continue;

      const hasPendingAuto = store.hasPendingAction(contact.contactHash, {
        origin: "auto",
        types: ["draft", "draft_and_schedule", "reminder"],
      });
      if (hasPendingAuto) continue;

      const type =
        contact.currentScore <= autoDraftThreshold || contact.anomalyReason === "frequency_drop"
          ? "draft"
          : "reminder";
      const text =
        type === "draft"
          ? (contact.draftMessage || `Hey ${contact.alias}, checking in on you. Want to catch up this week?`)
          : `Auto-nudge: schedule a light follow-up with ${contact.alias}.`;

      const action = store.addAction({
        id: crypto.randomUUID(),
        contactHash: contact.contactHash,
        alias: contact.alias,
        type,
        text,
        status: "pending",
        origin: "auto",
        scheduledFor: nowIso,
        createdAt: nowIso,
        completedAt: null,
        ignoredAt: null,
      });
      store.setContactAutoActionTimestamp(contact.contactHash, nowIso);
      store.incrementAutoRuns();
      audit.append("auto_trigger_action", {
        contactHash: contact.contactHash,
        score: contact.currentScore,
        riskLevel: contact.riskLevel,
        anomalyReason: contact.anomalyReason,
        actionId: action.id,
      });
    }
  };

  const runOverdueSweep = (): void => {
    const overdue = store.listOverduePendingActions(overdueIgnoreHours);
    for (const action of overdue) {
      const ignored = store.ignoreAction(action.id);
      if (!ignored) continue;
      if (ignored.type.includes("draft")) {
        store.applyFeedback(ignored.contactHash, false);
      }
      audit.append("action_auto_ignored", {
        actionId: ignored.id,
        contactHash: ignored.contactHash,
        origin: ignored.origin,
      });
    }
  };

  const tick = async (): Promise<void> => {
    if (running) return;
    running = true;
    const now = new Date();

    try {
      store.updateWorkerTick(now.toISOString());
      const changed = store.applyRealtimeDecay(now);
      if (changed.length > 0) {
        audit.append("realtime_decay_tick", { contactsChanged: changed.length });
      }

      runOverdueSweep();

      if (shouldRunDaily(store.getMeta().lastDailyRecomputeAt, now)) {
        await runDailyRecompute(now);
      }

      runAutoTriggers(now);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Autonomous worker tick failed: ${message}`);
    } finally {
      running = false;
    }
  };

  const timer = setInterval(() => {
    void tick();
  }, tickMs);
  void tick();

  return () => clearInterval(timer);
}
