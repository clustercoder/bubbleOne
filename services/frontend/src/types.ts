export type ScoreBand = "good" | "fading" | "critical";

export interface ContactRecord {
  contactHash: string;
  alias: string;
  currentScore: number;
  previousScore: number;
  band: ScoreBand;
  recommendation: string;
  actionType: string;
  priority: string;
  scheduleAt: string | null;
  anomalyDetected: boolean;
  autoNudgeEnabled: boolean;
  lastUpdatedAt: string;
  eventsCount: number;
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

export interface DashboardResponse {
  contacts: ContactRecord[];
  actions: ActionItem[];
  metrics: {
    contacts: number;
    avgScore: number;
    criticalCount: number;
    pendingActions: number;
  };
}
