import fs from "fs";
import path from "path";

import { ActionItem, ApiState, ContactRecord, MetadataEvent, MLOutcome } from "../types";

const INITIAL_STATE: ApiState = {
  contacts: {},
  actions: {},
  events: {},
};

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
      return {
        contacts: parsed.contacts ?? {},
        actions: parsed.actions ?? {},
        events: parsed.events ?? {},
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

    const existing = this.state.contacts[contactHash];
    this.state.contacts[contactHash] = {
      contactHash,
      alias,
      previousScore: existing?.currentScore ?? 50,
      currentScore: existing?.currentScore ?? 50,
      band: existing?.band ?? "fading",
      recommendation: existing?.recommendation ?? "No recommendation yet",
      actionType: existing?.actionType ?? "reminder",
      priority: existing?.priority ?? "medium",
      scheduleAt: existing?.scheduleAt ?? null,
      anomalyDetected: existing?.anomalyDetected ?? false,
      lastUpdatedAt: existing?.lastUpdatedAt ?? new Date().toISOString(),
      lastInteractionAt: events[events.length - 1]?.ts ?? existing?.lastInteractionAt ?? null,
      eventsCount: (existing?.eventsCount ?? 0) + events.length,
      autoNudgeEnabled: existing?.autoNudgeEnabled ?? false,
    };

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
      lastUpdatedAt: new Date().toISOString(),
      lastInteractionAt: existing?.lastInteractionAt ?? null,
      eventsCount: existing?.eventsCount ?? 0,
      autoNudgeEnabled: existing?.autoNudgeEnabled ?? false,
    };

    this.state.contacts[contactHash] = updated;
    this.persist();
    return updated;
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

  getContact(contactHash: string): ContactRecord | null {
    return this.state.contacts[contactHash] ?? null;
  }

  listContacts(): ContactRecord[] {
    return Object.values(this.state.contacts).sort((a, b) => a.currentScore - b.currentScore);
  }

  listActions(status?: "pending" | "completed"): ActionItem[] {
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
}
