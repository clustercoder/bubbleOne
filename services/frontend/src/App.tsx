import { useEffect, useMemo, useState } from "react";

import { createDraft, getDashboard, ingestSynthetic, sendAction, toggleAutoNudge } from "./api";
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
    badge: string;
    rail: string;
    label: string;
  }
> = {
  good: {
    badge: "bg-emerald-500/20 text-emerald-200 border border-emerald-400/50",
    rail: "from-emerald-500/50 to-emerald-300/20",
    label: "Good",
  },
  fading: {
    badge: "bg-amber-500/20 text-amber-200 border border-amber-400/50",
    rail: "from-amber-500/50 to-amber-300/20",
    label: "Fading",
  },
  critical: {
    badge: "bg-rose-500/20 text-rose-200 border border-rose-400/50",
    rail: "from-rose-500/50 to-rose-300/20",
    label: "Critical",
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
    const t = setInterval(refresh, 8000);
    return () => clearInterval(t);
  }, []);

  const metrics = dashboard?.metrics ?? {
    contacts: 0,
    avgScore: 0,
    criticalCount: 0,
    pendingActions: 0,
  };

  const sortedContacts = useMemo<ContactRecord[]>(() => {
    return dashboard?.contacts ?? [];
  }, [dashboard]);

  const actionCards = useMemo<ActionItem[]>(() => dashboard?.actions ?? [], [dashboard]);

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

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="bg-grid min-h-screen">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8">
          <header className="glass rounded-2xl p-5 shadow-neon">
            <div className="flex flex-wrap items-center justify-between gap-6">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-sky-300">Social Life on Auto-Pilot</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-wide text-slate-100">bubbleOne Dashboard</h1>
                <p className="mt-1 text-sm text-slate-300">
                  Privacy-first relationship orchestration using metadata, summaries, and local-first automation.
                </p>
              </div>

              <div className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.14em] text-emerald-200">Privacy Shield</p>
                <div className="mt-2 flex items-center gap-3">
                  <button
                    type="button"
                    role="switch"
                    aria-label="Toggle Privacy Shield"
                    aria-checked={privacyEnabled}
                    title="Toggle Privacy Shield"
                    onClick={() => setPrivacyEnabled((v) => !v)}
                    className={`relative h-8 w-16 rounded-full border transition ${
                      privacyEnabled
                        ? "border-emerald-300/70 bg-emerald-400/30"
                        : "border-slate-500/80 bg-slate-700/70"
                    }`}
                  >
                    <span
                      className={`absolute top-1 h-6 w-6 rounded-full bg-white transition ${
                        privacyEnabled ? "left-9" : "left-1"
                      }`}
                    />
                  </button>
                  <p className="text-sm text-emerald-100">
                    {privacyEnabled ? "Local metadata mode" : "Cloud assist enabled"}
                  </p>
                </div>
              </div>
            </div>
          </header>

          {error ? (
            <div className="rounded-xl border border-rose-400/50 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {error}
            </div>
          ) : null}

          <section className="grid gap-4 md:grid-cols-4">
            <MetricCard label="Contacts" value={metrics.contacts.toString()} tone="sky" />
            <MetricCard label="Average Score" value={metrics.avgScore.toString()} tone="amber" />
            <MetricCard label="Critical" value={metrics.criticalCount.toString()} tone="rose" />
            <MetricCard label="Pending Actions" value={metrics.pendingActions.toString()} tone="emerald" />
          </section>

          <section className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
            <article className="glass rounded-3xl p-6">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-sky-200">Relationship Orbit (List Mode)</h2>
                <span className="text-xs uppercase tracking-[0.12em] text-slate-400">0-100 health score</span>
              </div>

              <div className="space-y-3">
                {sortedContacts.length === 0 ? (
                  <p className="rounded-xl border border-slate-700/60 bg-slate-900/70 p-4 text-sm text-slate-300">
                    No contacts yet. Use demo ingest controls to populate the dashboard.
                  </p>
                ) : null}

                {sortedContacts.map((contact) => {
                  const style = bandStyles[contact.band];
                  return (
                    <div key={contact.contactHash} className="rounded-2xl border border-slate-700/70 bg-slate-900/75 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-3">
                            <h3 className="text-lg font-medium text-slate-100">{contact.alias}</h3>
                            <span className={`rounded-full px-2 py-1 text-xs ${style.badge}`}>{style.label}</span>
                          </div>
                          <p className="mt-1 text-sm text-slate-300">{contact.recommendation}</p>
                        </div>

                        <div className="text-right">
                          <p className="text-2xl font-semibold text-slate-100">{contact.currentScore.toFixed(1)}</p>
                          <p className="text-xs text-slate-400">prev {contact.previousScore.toFixed(1)}</p>
                        </div>
                      </div>

                      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-700">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r ${style.rail}`}
                          style={{ width: `${Math.min(100, Math.max(0, contact.currentScore))}%` }}
                        />
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => onCreateDraft(contact.contactHash)}
                          className="rounded-lg border border-sky-300/40 bg-sky-400/10 px-3 py-1.5 text-xs font-medium text-sky-200 hover:bg-sky-300/20 disabled:opacity-50"
                        >
                          Draft + Send
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => onToggleAutoNudge(contact)}
                          className="rounded-lg border border-amber-300/40 bg-amber-400/10 px-3 py-1.5 text-xs font-medium text-amber-100 hover:bg-amber-300/20 disabled:opacity-50"
                        >
                          {contact.autoNudgeEnabled ? "Disable Auto-Nudge" : "Enable Auto-Nudge"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>

            <aside className="glass rounded-3xl p-6">
              <h2 className="text-xl font-semibold text-amber-200">Action Center</h2>
              <p className="mt-1 text-sm text-slate-300">
                Suggestions generated by LangGraph workflow and RAG memory.
              </p>

              <div className="mt-4 space-y-3">
                {actionCards.length === 0 ? (
                  <p className="rounded-xl border border-slate-700/70 bg-slate-950/60 p-4 text-sm text-slate-300">
                    No pending actions yet.
                  </p>
                ) : null}

                {actionCards.map((action) => (
                  <div key={action.id} className="rounded-xl border border-slate-700/70 bg-slate-950/70 p-4">
                    <p className="text-sm text-slate-100">{action.text}</p>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className="text-xs uppercase tracking-[0.12em] text-slate-400">{action.type}</span>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onSend(action.id)}
                        className="rounded-md border border-emerald-300/40 bg-emerald-500/15 px-2.5 py-1 text-xs text-emerald-200 hover:bg-emerald-400/25 disabled:opacity-50"
                      >
                        Mark Completed
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-2xl border border-sky-400/40 bg-sky-500/10 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-sky-200">Demo Ingest</p>
                <p className="mt-1 text-sm text-sky-100/90">Inject synthetic metadata for quick scoring/recommendation demos.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {FRIENDS.map((alias) => (
                    <button
                      key={alias}
                      type="button"
                      disabled={busy}
                      onClick={() => onSeed(alias)}
                      className="rounded-md border border-slate-600/80 bg-slate-900/80 px-3 py-1 text-xs text-slate-200 hover:border-sky-300/60 disabled:opacity-50"
                    >
                      Ingest {alias}
                    </button>
                  ))}
                </div>
              </div>
            </aside>
          </section>
        </div>
      </div>

      {draft ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/80 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-700/80 bg-slate-900 p-5">
            <h3 className="text-lg font-semibold text-slate-100">Draft for {draft.alias}</h3>
            <p className="mt-3 rounded-lg border border-slate-700/70 bg-slate-950/70 p-3 text-sm text-slate-200">
              {draft.text}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDraft(null)}
                className="rounded-md border border-slate-600 px-3 py-1.5 text-sm text-slate-300"
              >
                Close
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => onSend(draft.actionId)}
                className="rounded-md border border-emerald-300/50 bg-emerald-500/20 px-3 py-1.5 text-sm text-emerald-200 disabled:opacity-50"
              >
                Mock Send
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "sky" | "amber" | "rose" | "emerald";
}) {
  const toneMap = {
    sky: "text-sky-200 border-sky-300/30",
    amber: "text-amber-200 border-amber-300/30",
    rose: "text-rose-200 border-rose-300/30",
    emerald: "text-emerald-200 border-emerald-300/30",
  } as const;

  return (
    <div className={`glass rounded-xl border p-4 ${toneMap[tone]}`}>
      <p className="text-xs uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-100">{value}</p>
    </div>
  );
}
