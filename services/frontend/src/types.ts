export type ScoreBand = "good" | "fading" | "critical";

export interface ContactRecord {
  contactHash: string;
  alias: string;
  currentScore: number;
  previousScore: number;
  band: ScoreBand;
  riskLevel: "low" | "medium" | "high";
  recommendation: string;
  actionType: string;
  priority: string;
  scheduleAt: string | null;
  anomalyDetected: boolean;
  anomalyReason: string;
  draftMessage: string;
  autoNudgeEnabled: boolean;
  lastUpdatedAt: string;
  lastInteractionAt: string | null;
  lastAutoActionAt: string | null;
  eventsCount: number;
}

export interface ActionItem {
  id: string;
  contactHash: string;
  alias: string;
  type: string;
  text: string;
  status: "pending" | "completed" | "ignored";
  origin: "user" | "auto";
  scheduledFor: string | null;
  createdAt: string;
  completedAt: string | null;
  ignoredAt: string | null;
}

export interface WorkerMeta {
  lastDailyRecomputeAt: string | null;
  lastWorkerTickAt: string | null;
  autoRuns: number;
}

export interface DashboardResponse {
  contacts: ContactRecord[];
  actions: ActionItem[];
  metrics: {
    contacts: number;
    avgScore: number;
    criticalCount: number;
    pendingActions: number;
  };
  meta: WorkerMeta;
}
