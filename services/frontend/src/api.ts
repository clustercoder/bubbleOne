import { ActionItem, DashboardResponse } from "./types";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || `HTTP ${res.status}`);
  }

  return (await res.json()) as T;
}

export function getDashboard(): Promise<DashboardResponse> {
  return apiFetch<DashboardResponse>("/api/dashboard");
}

export async function ingestSynthetic(alias: string): Promise<void> {
  const now = new Date();
  const payload = {
    alias,
    events: [
      {
        interaction_type: "text",
        sentiment: 0.2,
        intent: "check_in",
        ts: new Date(now.getTime() - 1000 * 60 * 60 * 3).toISOString(),
        summary: "Exchanged quick updates and acknowledged recent schedule constraints.",
        metadata: { source: "ui_demo" },
      },
      {
        interaction_type: "ignored_message",
        sentiment: -0.6,
        intent: "follow_up",
        ts: now.toISOString(),
        summary: "A follow-up was sent but has not received a reply yet.",
        metadata: { source: "ui_demo" },
      },
    ],
  };

  await apiFetch("/api/ingest", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createDraft(contactHash: string): Promise<{ draft: string; action: ActionItem }> {
  return apiFetch<{ draft: string; action: ActionItem }>("/api/actions/draft", {
    method: "POST",
    body: JSON.stringify({ contactHash }),
  });
}

export async function sendAction(actionId: string): Promise<void> {
  await apiFetch("/api/actions/send", {
    method: "POST",
    body: JSON.stringify({ actionId }),
  });
}

export async function ignoreAction(actionId: string): Promise<void> {
  await apiFetch("/api/actions/ignore", {
    method: "POST",
    body: JSON.stringify({ actionId }),
  });
}

export async function toggleAutoNudge(contactHash: string, enabled: boolean): Promise<void> {
  await apiFetch("/api/actions/auto-nudge", {
    method: "POST",
    body: JSON.stringify({ contactHash, enabled }),
  });
}
