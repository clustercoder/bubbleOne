import { useEffect, useMemo, useState } from "react";

import {
  createDraft,
  getDashboard,
  ignoreAction,
  ingestSynthetic,
  sendAction,
  toggleAutoNudge,
} from "./api";
import { ActionItem, ContactRecord, DashboardResponse, ScoreBand } from "./types";

type DraftState = {
  text: string;
  actionId: string;
  alias: string;
};

const FRIENDS = ["Alex", "Maya", "Jordan", "Priya", "Sam"];

const bandStyles: Record<
  ScoreBand,
  {
    label: string;
    badge: string;
  }
> = {
  good: {
    label: "Good",
    badge: "badge-good",
  },
  fading: {
    label: "Fading",
    badge: "badge-fading",
  },
  critical: {
    label: "Critical",
    badge: "badge-critical",
  },
};

const riskStyles: Record<
  ContactRecord["riskLevel"],
  {
    badge: string;
    label: string;
  }
> = {
  low: {
    badge: "badge-low-risk",
    label: "Low Risk",
  },
  medium: {
    badge: "badge-medium-risk",
    label: "Medium Risk",
  },
  high: {
    badge: "badge-high-risk",
    label: "High Risk",
  },
};

async function withToast<T>(promise: Promise<T>, setError: (msg: string) => void): Promise<T | null> {
  try {
    return await promise;
  } catch (error) {
    setError(error instanceof Error ? error.message : "Request failed");
    return null;
  }
}

function relativeTime(iso: string | null): string {
  if (!iso) return "No activity";
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return "No activity";

  const deltaMs = Date.now() - ts;
  const minutes = Math.floor(deltaMs / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function App() {
  const [privacyEnabled, setPrivacyEnabled] = useState(true);
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<DraftState | null>(null);

  async function refresh() {
    const result = await withToast(getDashboard(), setError);
    if (result) {
      setDashboard(result);
      setError("");
    }
  }

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 5000);
    return () => clearInterval(timer);
  }, []);

  const metrics = dashboard?.metrics ?? {
    contacts: 0,
    avgScore: 0,
    criticalCount: 0,
    pendingActions: 0,
  };

  const contacts = useMemo<ContactRecord[]>(
    () => [...(dashboard?.contacts ?? [])].sort((a, b) => a.currentScore - b.currentScore),
    [dashboard],
  );
  const actionCards = useMemo<ActionItem[]>(() => (dashboard?.actions ?? []).slice(0, 10), [dashboard]);
  const workerMeta = dashboard?.meta;

  async function onSeed(alias: string) {
    setBusy(true);
    await withToast(ingestSynthetic(alias), setError);
    await refresh();
    setBusy(false);
  }

  async function onCreateDraft(contactHash: string) {
    setBusy(true);
    const result = await withToast(createDraft(contactHash), setError);
    if (result) {
      setDraft({
        text: result.draft,
        actionId: result.action.id,
        alias: result.action.alias,
      });
      await refresh();
    }
    setBusy(false);
  }

  async function onSend(actionId: string) {
    setBusy(true);
    await withToast(sendAction(actionId), setError);
    setDraft(null);
    await refresh();
    setBusy(false);
  }

  async function onToggleAutoNudge(contact: ContactRecord) {
    setBusy(true);
    await withToast(toggleAutoNudge(contact.contactHash, !contact.autoNudgeEnabled), setError);
    await refresh();
    setBusy(false);
  }

  async function onIgnore(actionId: string) {
    setBusy(true);
    await withToast(ignoreAction(actionId), setError);
    await refresh();
    setBusy(false);
  }

  return (
    <main className="social-shell min-h-screen text-slate-100">
      <header className="topbar sticky top-0 z-40 border-b border-slate-800/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="logo-dot" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold tracking-tight text-white">bubbleOne</p>
              <p className="text-[11px] text-slate-400">Social Life on Auto-Pilot</p>
            </div>
          </div>

          <nav className="hidden items-center gap-6 text-sm text-slate-300 md:flex">
            <a className="nav-link nav-link-active" href="#">Home</a>
            <a className="nav-link" href="#">Orbit</a>
            <a className="nav-link" href="#">Actions</a>
          </nav>

          <div className="flex items-center gap-3 rounded-full border border-slate-700/80 bg-slate-900/70 px-3 py-2">
            <span className="text-xs text-slate-300">Privacy</span>
            <button
              type="button"
              role="switch"
              aria-label="Toggle Privacy Shield"
              aria-checked={privacyEnabled}
              title="Toggle Privacy Shield"
              onClick={() => setPrivacyEnabled((v) => !v)}
              className={`privacy-switch ${privacyEnabled ? "privacy-on" : "privacy-off"}`}
            >
              <span className="privacy-knob" />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-7xl gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[280px_minmax(0,1fr)_320px]">
        <aside className="social-card h-fit space-y-4 rounded-2xl p-4 lg:sticky lg:top-20">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">Overview</h2>

          <div className="space-y-2">
            <StatRow label="Tracked Contacts" value={metrics.contacts.toString()} />
            <StatRow label="Average Health" value={metrics.avgScore.toFixed(1)} />
            <StatRow label="Critical" value={metrics.criticalCount.toString()} />
            <StatRow label="Pending" value={metrics.pendingActions.toString()} />
          </div>

          <div className="rounded-xl border border-slate-700/80 bg-slate-950/70 p-3">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Worker</p>
            <p className="mt-1 text-sm text-slate-200">{workerMeta?.lastWorkerTickAt ? "Live" : "Booting"}</p>
            <p className="mt-1 text-xs text-slate-400">Tick: {relativeTime(workerMeta?.lastWorkerTickAt ?? null)}</p>
            <p className="text-xs text-slate-400">Auto runs: {workerMeta?.autoRuns ?? 0}</p>
          </div>

          <div>
            <p className="mb-2 text-xs uppercase tracking-[0.14em] text-slate-400">Quick Seed</p>
            <div className="flex flex-wrap gap-2">
              {FRIENDS.map((alias) => (
                <button
                  key={alias}
                  type="button"
                  disabled={busy}
                  onClick={() => onSeed(alias)}
                  className="btn btn-ghost"
                >
                  {alias}
                </button>
              ))}
            </div>
          </div>
        </aside>

        <section className="space-y-4">
          {error ? (
            <div className="social-card rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {error}
            </div>
          ) : null}

          {contacts.length === 0 ? (
            <div className="social-card rounded-2xl p-5 text-sm text-slate-300">
              No contacts yet. Use quick seed buttons on the left.
            </div>
          ) : null}

          {contacts.map((contact) => {
            const band = bandStyles[contact.band];
            const risk = riskStyles[contact.riskLevel];
            const scoreDelta = contact.currentScore - contact.previousScore;
            const deltaTone = scoreDelta >= 0 ? "text-emerald-300" : "text-rose-300";
            const deltaLabel = `${scoreDelta >= 0 ? "+" : ""}${scoreDelta.toFixed(1)}`;

            return (
              <article key={contact.contactHash} className="social-card post-card rounded-2xl p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="avatar-circle" aria-hidden="true">
                      {contact.alias.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-base font-semibold text-white">{contact.alias}</h3>
                        <span className={`badge ${band.badge}`}>{band.label}</span>
                        <span className={`badge ${risk.badge}`}>{risk.label}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-400">{relativeTime(contact.lastInteractionAt)}</p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-2xl font-semibold text-white">{contact.currentScore.toFixed(1)}</p>
                    <p className={`text-xs ${deltaTone}`}>{deltaLabel}</p>
                  </div>
                </div>

                <p className="mt-3 text-sm leading-relaxed text-slate-200">{contact.recommendation}</p>
                {contact.anomalyDetected ? (
                  <p className="mt-1 text-xs text-rose-300">Anomaly detected: {contact.anomalyReason}</p>
                ) : null}

                <div className="mt-3">
                  <progress
                    max={100}
                    value={Math.min(100, Math.max(0, contact.currentScore))}
                    className={`score-progress score-${contact.band}`}
                  />
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onCreateDraft(contact.contactHash)}
                    className="btn btn-primary"
                  >
                    Draft + Send
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onToggleAutoNudge(contact)}
                    className="btn btn-secondary"
                  >
                    {contact.autoNudgeEnabled ? "Disable Auto-Nudge" : "Enable Auto-Nudge"}
                  </button>
                </div>
              </article>
            );
          })}
        </section>

        <aside className="social-card h-fit rounded-2xl p-4 lg:sticky lg:top-20">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">Action Center</h2>
          <p className="mt-1 text-xs text-slate-400">Auto + user tasks waiting for execution</p>

          <div className="mt-4 space-y-3">
            {actionCards.length === 0 ? (
              <div className="rounded-xl border border-slate-700/70 bg-slate-950/65 p-4 text-sm text-slate-300">
                No pending actions.
              </div>
            ) : null}

            {actionCards.map((action) => (
              <div key={action.id} className="action-item rounded-xl border border-slate-700/70 bg-slate-950/60 p-3">
                <p className="text-sm text-slate-200">{action.text}</p>
                <p className="mt-2 text-[11px] uppercase tracking-[0.14em] text-slate-400">
                  {action.type} • {action.origin}
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onIgnore(action.id)}
                    className="btn btn-danger"
                  >
                    Ignore
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onSend(action.id)}
                    className="btn btn-primary"
                  >
                    Complete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>

      {draft ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/75 px-4 backdrop-blur-sm">
          <div className="social-card w-full max-w-xl rounded-2xl p-5 sm:p-6">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Draft Composer</p>
            <h3 className="mt-2 text-xl font-semibold text-white">Message for {draft.alias}</h3>
            <p className="mt-4 rounded-xl border border-slate-700/80 bg-slate-950/70 p-4 text-sm text-slate-200">
              {draft.text}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setDraft(null)} className="btn btn-ghost">
                Close
              </button>
              <button type="button" disabled={busy} onClick={() => onSend(draft.actionId)} className="btn btn-primary">
                Mock Send
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-700/80 bg-slate-950/65 px-3 py-2">
      <span className="text-xs text-slate-400">{label}</span>
      <span className="text-sm font-semibold text-white">{value}</span>
    </div>
  );
}
