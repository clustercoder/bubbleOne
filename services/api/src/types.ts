export type InteractionType =
  | "text"
  | "call"
  | "ignored_message"
  | "auto_nudge"
  | "missed_call";

export type ScoreBand = "good" | "fading" | "critical";

export interface MetadataEvent {
  event_id: string;
  contact_hash: string;
  ts: string;
  interaction_type: InteractionType;
  sentiment: number;
  intent: string;
  summary: string;
  metadata: Record<string, unknown>;
}

export interface IngestPayload {
  alias: string;
  contact_hash?: string;
  events: Partial<MetadataEvent>[];
}

export interface MLOutcome {
  contact_hash: string;
  score: number;
  band: ScoreBand;
  recommended_action: string;
  action_type: string;
  priority: string;
  schedule_at: string | null;
  anomaly_detected: boolean;
}

export interface ContactRecord {
  contactHash: string;
  alias: string;
  previousScore: number;
  currentScore: number;
  band: ScoreBand;
  recommendation: string;
  actionType: string;
  priority: string;
  scheduleAt: string | null;
  anomalyDetected: boolean;
  lastUpdatedAt: string;
  lastInteractionAt: string | null;
  eventsCount: number;
  autoNudgeEnabled: boolean;
}

export interface ActionItem {
  id: string;
  contactHash: string;
  alias: string;
  type: string;
  text: string;
  status: "pending" | "completed";
  scheduledFor: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface ApiState {
  contacts: Record<string, ContactRecord>;
  actions: Record<string, ActionItem>;
  events: Record<string, MetadataEvent[]>;
}
