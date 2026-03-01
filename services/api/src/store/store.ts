import fs from "fs";
import path from "path";

import { ActionItem, ApiState, ContactRecord, MetadataEvent, MLOutcome } from "../types";

const INITIAL_STATE: ApiState = {
  contacts: {},
  actions: {},
  events: {},
  meta: {
    lastDailyRecomputeAt: null,
    lastWorkerTickAt: null,
    autoRuns: 0,
  },
};

const SCORE_BOUNDS = { min: 0, max: 100 };

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function bandForScore(score: number): ContactRecord["band"] {
  if (score >= 75) return "good";
  if (score >= 45) return "fading";
  return "critical";
}

function riskLevelForScore(score: number, anomalyDetected: boolean): ContactRecord["riskLevel"] {
  if (anomalyDetected || score < 45) return "high";
  if (score < 70) return "medium";
  return "low";
}

function ensureIso(ts: string | null | undefined): string | null {
  if (!ts) return null;
  const parsed = new Date(ts);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function defaultContact(contactHash: string, alias: string): ContactRecord {
  return {
    contactHash,
    alias,
    previousScore: 50,
    currentScore: 50,
    band: "fading",
    recommendation: "No recommendation yet",
    actionType: "reminder",
    priority: "medium",
    scheduleAt: null,
    anomalyDetected: false,
    anomalyReason: "none",
    riskLevel: "medium",
    draftMessage: `Hey ${alias}, just checking in. How have you been lately?`,
    lastUpdatedAt: new Date().toISOString(),
    lastInteractionAt: null,
    eventsCount: 0,
    autoNudgeEnabled: false,
    lastAutoActionAt: null,
    tuning: {
      interactionMultiplier: 1.0,
      lambdaDecay: 0.08,
      positiveFeedback: 0,
      negativeFeedback: 0,
    },
  };
}

function normalizeContactRecord(contactHash: string, input: Partial<ContactRecord> | undefined): ContactRecord {
  const base = defaultContact(contactHash, input?.alias ?? "Friend");
  const currentScore = clamp(Number(input?.currentScore ?? base.currentScore), SCORE_BOUNDS.min, SCORE_BOUNDS.max);
  const anomalyDetected = Boolean(input?.anomalyDetected ?? base.anomalyDetected);
  return {
    ...base,
    ...input,
    contactHash,
    alias: input?.alias ?? base.alias,
    previousScore: clamp(Number(input?.previousScore ?? currentScore), SCORE_BOUNDS.min, SCORE_BOUNDS.max),
    currentScore,
    band: input?.band ?? bandForScore(currentScore),
    anomalyDetected,
    anomalyReason: input?.anomalyReason ?? "none",
    riskLevel: input?.riskLevel ?? riskLevelForScore(currentScore, anomalyDetected),
    draftMessage: input?.draftMessage ?? base.draftMessage,
    scheduleAt: ensureIso(input?.scheduleAt ?? null),
    lastUpdatedAt: ensureIso(input?.lastUpdatedAt) ?? new Date().toISOString(),
    lastInteractionAt: ensureIso(input?.lastInteractionAt),
    eventsCount: Math.max(0, Number(input?.eventsCount ?? 0)),
    autoNudgeEnabled: Boolean(input?.autoNudgeEnabled ?? false),
    lastAutoActionAt: ensureIso(input?.lastAutoActionAt),
    tuning: {
      interactionMultiplier: clamp(
        Number(input?.tuning?.interactionMultiplier ?? 1.0),
        0.5,
        2.0,
      ),
      lambdaDecay: clamp(Number(input?.tuning?.lambdaDecay ?? 0.08), 0.03, 0.2),
      positiveFeedback: Math.max(0, Number(input?.tuning?.positiveFeedback ?? 0)),
      negativeFeedback: Math.max(0, Number(input?.tuning?.negativeFeedback ?? 0)),
    },
  };
}

function normalizeAction(input: Partial<ActionItem>): ActionItem | null {
  if (!input.id || !input.contactHash || !input.alias || !input.type || !input.text || !input.createdAt) {
    return null;
  }
  return {
    id: input.id,
    contactHash: input.contactHash,
    alias: input.alias,
    type: input.type,
    text: input.text,
    status: input.status ?? "pending",
    origin: input.origin ?? "user",
    scheduledFor: ensureIso(input.scheduledFor ?? null),
    createdAt: ensureIso(input.createdAt) ?? new Date().toISOString(),
    completedAt: ensureIso(input.completedAt ?? null),
    ignoredAt: ensureIso(input.ignoredAt ?? null),
  };
}

export class ApiStore {
  private readonly dataPath: string;
  private state: ApiState;

  constructor(dataPath: string) {
    this.dataPath = dataPath;
    this.state = this.load();
  }

  private load(): ApiState {
    try {
      if (!fs.existsSync(this.dataPath)) {
        this.ensureParentDir();
        fs.writeFileSync(this.dataPath, JSON.stringify(INITIAL_STATE, null, 2));
        return structuredClone(INITIAL_STATE);
      }

      const content = fs.readFileSync(this.dataPath, "utf-8");
      const parsed = JSON.parse(content) as ApiState;

      const contacts: ApiState["contacts"] = {};
      for (const [contactHash, contact] of Object.entries(parsed.contacts ?? {})) {
        contacts[contactHash] = normalizeContactRecord(contactHash, contact);
      }

      const actions: ApiState["actions"] = {};
      for (const [actionId, action] of Object.entries(parsed.actions ?? {})) {
        const normalized = normalizeAction({ ...action, id: actionId });
        if (normalized) {
          actions[actionId] = normalized;
        }
      }

      return {
        contacts,
        actions,
        events: parsed.events ?? {},
        meta: {
          lastDailyRecomputeAt: ensureIso(parsed.meta?.lastDailyRecomputeAt),
          lastWorkerTickAt: ensureIso(parsed.meta?.lastWorkerTickAt),
          autoRuns: Math.max(0, Number(parsed.meta?.autoRuns ?? 0)),
        },
      };
    } catch {
      return structuredClone(INITIAL_STATE);
    }
  }

  private ensureParentDir(): void {
    const dir = path.dirname(this.dataPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private persist(): void {
    this.ensureParentDir();
    fs.writeFileSync(this.dataPath, JSON.stringify(this.state, null, 2));
  }

  appendEvents(contactHash: string, alias: string, events: MetadataEvent[]): void {
    if (!this.state.events[contactHash]) {
      this.state.events[contactHash] = [];
    }

    this.state.events[contactHash].push(...events);
    this.state.events[contactHash].sort((a, b) => (a.ts < b.ts ? -1 : 1));

    const existing = this.state.contacts[contactHash] ?? defaultContact(contactHash, alias);
    const lastInteraction = events[events.length - 1]?.ts ?? existing.lastInteractionAt;
    const updated = normalizeContactRecord(contactHash, {
      ...existing,
      alias,
      lastInteractionAt: lastInteraction,
      eventsCount: this.state.events[contactHash].length,
      lastUpdatedAt: new Date().toISOString(),
    });
    this.state.contacts[contactHash] = updated;

    this.persist();
  }

  applyMLOutcome(contactHash: string, alias: string, ml: MLOutcome): ContactRecord {
    const existing = this.state.contacts[contactHash];

    const updated: ContactRecord = {
      contactHash,
      alias,
      previousScore: existing?.currentScore ?? 50,
      currentScore: ml.score,
      band: ml.band,
      recommendation: ml.recommended_action,
      actionType: ml.action_type,
      priority: ml.priority,
      scheduleAt: ml.schedule_at,
      anomalyDetected: ml.anomaly_detected,
      anomalyReason: ml.anomaly_reason,
      riskLevel: ml.risk_level,
      draftMessage: ml.draft_message,
      lastUpdatedAt: new Date().toISOString(),
      lastInteractionAt: existing?.lastInteractionAt ?? null,
      eventsCount: this.state.events[contactHash]?.length ?? existing?.eventsCount ?? 0,
      autoNudgeEnabled: existing?.autoNudgeEnabled ?? false,
      lastAutoActionAt: existing?.lastAutoActionAt ?? null,
      tuning: {
        interactionMultiplier: existing?.tuning?.interactionMultiplier ?? 1.0,
        lambdaDecay: clamp(
          Number(ml.lambda_decay_used ?? existing?.tuning?.lambdaDecay ?? 0.08),
          0.03,
          0.2,
        ),
        positiveFeedback: existing?.tuning?.positiveFeedback ?? 0,
        negativeFeedback: existing?.tuning?.negativeFeedback ?? 0,
      },
    };

    this.state.contacts[contactHash] = normalizeContactRecord(contactHash, updated);
    this.persist();
    return this.state.contacts[contactHash];
  }

  setAutoNudge(contactHash: string, enabled: boolean): ContactRecord | null {
    const contact = this.state.contacts[contactHash];
    if (!contact) return null;

    contact.autoNudgeEnabled = enabled;
    contact.lastUpdatedAt = new Date().toISOString();
    this.state.contacts[contactHash] = contact;
    this.persist();
    return contact;
  }

  setContactAutoActionTimestamp(contactHash: string, atIso: string): ContactRecord | null {
    const contact = this.state.contacts[contactHash];
    if (!contact) return null;
    contact.lastAutoActionAt = atIso;
    contact.lastUpdatedAt = atIso;
    this.state.contacts[contactHash] = contact;
    this.persist();
    return contact;
  }

  addAction(action: ActionItem): ActionItem {
    this.state.actions[action.id] = action;
    this.persist();
    return action;
  }

  completeAction(actionId: string): ActionItem | null {
    const action = this.state.actions[actionId];
    if (!action) return null;

    action.status = "completed";
    action.completedAt = new Date().toISOString();
    this.state.actions[actionId] = action;
    this.persist();
    return action;
  }

  ignoreAction(actionId: string): ActionItem | null {
    const action = this.state.actions[actionId];
    if (!action) return null;

    action.status = "ignored";
    action.ignoredAt = new Date().toISOString();
    this.state.actions[actionId] = action;
    this.persist();
    return action;
  }

  applyFeedback(contactHash: string, positive: boolean): ContactRecord | null {
    const contact = this.state.contacts[contactHash];
    if (!contact) return null;

    const interactionStep = 0.05;
    const decayStep = 0.005;

    if (positive) {
      contact.tuning.interactionMultiplier = clamp(
        contact.tuning.interactionMultiplier + interactionStep,
        0.5,
        2.0,
      );
      contact.tuning.lambdaDecay = clamp(contact.tuning.lambdaDecay - decayStep, 0.03, 0.2);
      contact.tuning.positiveFeedback += 1;
    } else {
      contact.tuning.interactionMultiplier = clamp(
        contact.tuning.interactionMultiplier - interactionStep,
        0.5,
        2.0,
      );
      contact.tuning.lambdaDecay = clamp(contact.tuning.lambdaDecay + decayStep, 0.03, 0.2);
      contact.tuning.negativeFeedback += 1;
    }

    contact.lastUpdatedAt = new Date().toISOString();
    this.state.contacts[contactHash] = contact;
    this.persist();
    return contact;
  }

  getContact(contactHash: string): ContactRecord | null {
    return this.state.contacts[contactHash] ?? null;
  }

  listContacts(): ContactRecord[] {
    return Object.values(this.state.contacts).sort((a, b) => a.currentScore - b.currentScore);
  }

  listActions(status?: "pending" | "completed" | "ignored"): ActionItem[] {
    const all = Object.values(this.state.actions).sort((a, b) =>
      a.createdAt < b.createdAt ? 1 : -1,
    );
    if (!status) return all;
    return all.filter((item) => item.status === status);
  }

  getRecentEvents(contactHash: string, limit = 20): MetadataEvent[] {
    const events = this.state.events[contactHash] ?? [];
    return events.slice(Math.max(0, events.length - limit));
  }

  getInteractionCounts(contactHash: string, windowDays = 7): { recent: number; prior: number } {
    const events = this.state.events[contactHash] ?? [];
    if (!events.length) {
      return { recent: 0, prior: 0 };
    }

    const now = Date.now();
    const windowMs = windowDays * 86400000;

    let recent = 0;
    let prior = 0;
    for (const event of events) {
      const ts = new Date(event.ts).getTime();
      if (Number.isNaN(ts)) continue;
      const age = now - ts;
      if (age <= windowMs) {
        recent += 1;
      } else if (age <= 2 * windowMs) {
        prior += 1;
      }
    }
    return { recent, prior };
  }

  hasPendingAction(
    contactHash: string,
    options?: { origin?: "user" | "auto"; types?: string[] },
  ): boolean {
    const types = options?.types;
    return Object.values(this.state.actions).some((action) => {
      if (action.contactHash !== contactHash) return false;
      if (action.status !== "pending") return false;
      if (options?.origin && action.origin !== options.origin) return false;
      if (types && types.length > 0 && !types.includes(action.type)) return false;
      return true;
    });
  }

  listOverduePendingActions(olderThanHours = 24): ActionItem[] {
    const now = Date.now();
    const threshold = olderThanHours * 3600000;
    return this.listActions("pending").filter((action) => {
      const anchor = action.scheduledFor ?? action.createdAt;
      const ts = new Date(anchor).getTime();
      if (Number.isNaN(ts)) return false;
      return now - ts >= threshold;
    });
  }

  applyRealtimeDecay(now = new Date()): ContactRecord[] {
    const changed: ContactRecord[] = [];
    const nowIso = now.toISOString();

    for (const contact of Object.values(this.state.contacts)) {
      const lastTs = new Date(contact.lastUpdatedAt).getTime();
      const nowTs = now.getTime();
      if (Number.isNaN(lastTs) || nowTs <= lastTs) continue;

      const deltaDays = (nowTs - lastTs) / 86400000;
      if (deltaDays <= 0) continue;

      const decayed = clamp(
        contact.currentScore * Math.exp(-contact.tuning.lambdaDecay * deltaDays),
        SCORE_BOUNDS.min,
        SCORE_BOUNDS.max,
      );

      if (Math.abs(decayed - contact.currentScore) >= 0.005) {
        contact.previousScore = contact.currentScore;
        contact.currentScore = Number(decayed.toFixed(4));
        contact.band = bandForScore(contact.currentScore);
        contact.riskLevel = riskLevelForScore(contact.currentScore, contact.anomalyDetected);
        contact.lastUpdatedAt = nowIso;
        changed.push(contact);
      }
    }

    if (changed.length > 0) {
      this.persist();
    }

    return changed;
  }

  updateWorkerTick(nowIso: string): void {
    this.state.meta.lastWorkerTickAt = nowIso;
    this.persist();
  }

  markDailyRecompute(nowIso: string): void {
    this.state.meta.lastDailyRecomputeAt = nowIso;
    this.persist();
  }

  incrementAutoRuns(): void {
    this.state.meta.autoRuns += 1;
    this.persist();
  }

  getMeta(): ApiState["meta"] {
    return { ...this.state.meta };
  }
}
