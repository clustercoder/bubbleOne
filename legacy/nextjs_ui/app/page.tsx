"use client";

import { Orbitron, Space_Grotesk } from "next/font/google";
import { useMemo, useState } from "react";

type HealthBand = "good" | "fading" | "critical";

type Friend = {
  name: string;
  healthScore: number;
  daysSinceContact: number;
  preferredChannel: "text" | "call";
};

const orbitron = Orbitron({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-orbitron",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-space-grotesk",
});

const friends: Friend[] = [
  { name: "Alex", healthScore: 42, daysSinceContact: 12, preferredChannel: "text" },
  { name: "Maya", healthScore: 88, daysSinceContact: 2, preferredChannel: "call" },
  { name: "Jordan", healthScore: 71, daysSinceContact: 6, preferredChannel: "text" },
  { name: "Priya", healthScore: 59, daysSinceContact: 9, preferredChannel: "call" },
  { name: "Sam", healthScore: 27, daysSinceContact: 17, preferredChannel: "text" },
];

const bandStyles: Record<
  HealthBand,
  {
    label: string;
    chip: string;
    ring: string;
    glow: string;
    dot: string;
  }
> = {
  good: {
    label: "Good",
    chip: "bg-emerald-500/20 text-emerald-200 border border-emerald-400/50",
    ring: "ring-emerald-400/70",
    glow: "shadow-[0_0_40px_rgba(16,185,129,0.35)]",
    dot: "bg-emerald-400",
  },
  fading: {
    label: "Fading",
    chip: "bg-amber-500/20 text-amber-100 border border-amber-400/50",
    ring: "ring-amber-400/70",
    glow: "shadow-[0_0_40px_rgba(245,158,11,0.3)]",
    dot: "bg-amber-400",
  },
  critical: {
    label: "Critical",
    chip: "bg-rose-500/20 text-rose-100 border border-rose-400/50",
    ring: "ring-rose-400/70",
    glow: "shadow-[0_0_40px_rgba(244,63,94,0.35)]",
    dot: "bg-rose-400",
  },
};

function getBand(score: number): HealthBand {
  if (score >= 75) return "good";
  if (score >= 45) return "fading";
  return "critical";
}

function orbitPosition(index: number, total: number, radius: number) {
  const angle = (index / total) * Math.PI * 2 - Math.PI / 2;
  const x = Math.cos(angle) * radius;
  const y = Math.sin(angle) * radius;
  return { x, y };
}

export default function Page() {
  const [privacyShieldEnabled, setPrivacyShieldEnabled] = useState(true);

  const avgScore = useMemo(
    () => Math.round(friends.reduce((sum, f) => sum + f.healthScore, 0) / friends.length),
    []
  );

  const actionSuggestions = useMemo(() => {
    return friends
      .slice()
      .sort((a, b) => a.healthScore - b.healthScore)
      .map((friend) => {
        if (friend.daysSinceContact >= 10) {
          return `You haven't spoken to ${friend.name} in ${friend.daysSinceContact} days. Send a meme?`;
        }
        if (friend.healthScore < 45) {
          return `${friend.name} is in critical range. ${friend.preferredChannel === "call" ? "Schedule a short call" : "Draft a gentle text"} today.`;
        }
        if (friend.healthScore < 75) {
          return `${friend.name} is fading. Share a quick life update and ask one thoughtful question.`;
        }
        return `${friend.name} is stable. Keep momentum with a light ${friend.preferredChannel} touchpoint this week.`;
      });
  }, []);

  return (
    <main
      className={`${orbitron.variable} ${spaceGrotesk.variable} min-h-screen overflow-hidden bg-slate-950 text-slate-100`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.18),transparent_52%),radial-gradient(circle_at_bottom_right,rgba(249,115,22,0.12),transparent_42%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.09)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.09)_1px,transparent_1px)] bg-[size:34px_34px] opacity-20" />

      <div className="relative mx-auto max-w-7xl px-6 py-8 md:px-10">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-6 rounded-2xl border border-sky-300/25 bg-slate-900/70 p-5 backdrop-blur-xl">
          <div>
            <p className="font-[var(--font-orbitron)] text-xl tracking-[0.25em] text-sky-300">BUBBLEONE</p>
            <p className="font-[var(--font-space-grotesk)] text-sm text-slate-300">
              Relationship intelligence from local metadata only
            </p>
          </div>

          <div className="flex items-center gap-4 rounded-xl border border-emerald-300/30 bg-emerald-500/10 px-4 py-3">
            <div>
              <p className="font-[var(--font-space-grotesk)] text-xs uppercase tracking-[0.16em] text-emerald-200">
                Privacy Shield
              </p>
              <p className="font-[var(--font-space-grotesk)] text-sm text-emerald-100/90">
                {privacyShieldEnabled
                  ? "Local mode active: metadata processing only"
                  : "Shield paused: cloud actions may be enabled"}
              </p>
            </div>

            <button
              type="button"
              role="switch"
              aria-label="Toggle Privacy Shield"
              aria-checked={privacyShieldEnabled}
              title="Toggle Privacy Shield"
              onClick={() => setPrivacyShieldEnabled((v) => !v)}
              className={`relative h-8 w-16 rounded-full border transition ${
                privacyShieldEnabled
                  ? "border-emerald-300/60 bg-emerald-400/25"
                  : "border-slate-500/80 bg-slate-600/60"
              }`}
            >
              <span
                className={`absolute top-1 h-6 w-6 rounded-full bg-white transition ${
                  privacyShieldEnabled ? "left-9" : "left-1"
                }`}
              />
            </button>
          </div>
        </header>

        <section className="mb-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-700/70 bg-slate-900/70 p-4">
            <p className="font-[var(--font-space-grotesk)] text-xs uppercase tracking-[0.14em] text-slate-400">
              Active Relationships
            </p>
            <p className="mt-2 font-[var(--font-orbitron)] text-3xl text-sky-300">{friends.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-700/70 bg-slate-900/70 p-4">
            <p className="font-[var(--font-space-grotesk)] text-xs uppercase tracking-[0.14em] text-slate-400">
              Average Health Score
            </p>
            <p className="mt-2 font-[var(--font-orbitron)] text-3xl text-amber-300">{avgScore}</p>
          </div>
          <div className="rounded-2xl border border-slate-700/70 bg-slate-900/70 p-4">
            <p className="font-[var(--font-space-grotesk)] text-xs uppercase tracking-[0.14em] text-slate-400">
              Critical Contacts
            </p>
            <p className="mt-2 font-[var(--font-orbitron)] text-3xl text-rose-300">
              {friends.filter((f) => getBand(f.healthScore) === "critical").length}
            </p>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
          <article className="rounded-3xl border border-sky-300/30 bg-slate-900/70 p-6 backdrop-blur-xl">
            <div className="mb-4 flex items-center justify-between">
              <h1 className="font-[var(--font-orbitron)] text-2xl tracking-wide text-sky-200">
                Relationship Orbit
              </h1>
              <p className="font-[var(--font-space-grotesk)] text-sm text-slate-300">
                30-day health snapshot
              </p>
            </div>

            <div className="relative mx-auto mb-8 h-[420px] w-full max-w-[560px] rounded-3xl border border-slate-700/60 bg-slate-950/70">
              <div className="absolute inset-5 rounded-full border border-dashed border-slate-700/70" />
              <div className="absolute inset-14 rounded-full border border-dashed border-slate-700/50" />
              <div className="absolute inset-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-sky-300/40 bg-sky-400/10 shadow-[0_0_40px_rgba(56,189,248,0.45)]">
                <div className="flex h-full items-center justify-center text-center">
                  <p className="font-[var(--font-orbitron)] text-xs tracking-[0.2em] text-sky-200">YOU</p>
                </div>
              </div>

              {friends.map((friend, index) => {
                const band = getBand(friend.healthScore);
                const style = bandStyles[band];
                const { x, y } = orbitPosition(index, friends.length, 160);

                return (
                  <div
                    key={friend.name}
                    className="absolute left-1/2 top-1/2"
                    style={{ transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))` }}
                  >
                    <div
                      className={`w-32 rounded-2xl border border-slate-700/60 bg-slate-900/95 p-3 ring-1 ${style.ring} ${style.glow}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate font-[var(--font-space-grotesk)] text-sm font-medium text-slate-100">
                          {friend.name}
                        </p>
                        <span className={`h-2.5 w-2.5 rounded-full ${style.dot} animate-pulse`} />
                      </div>
                      <p className="mt-2 font-[var(--font-orbitron)] text-xl text-white">{friend.healthScore}</p>
                      <p className="mt-1 text-xs text-slate-400">{friend.daysSinceContact}d since contact</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <ul className="space-y-3">
              {friends.map((friend) => {
                const band = getBand(friend.healthScore);
                return (
                  <li
                    key={`${friend.name}-row`}
                    className="flex items-center justify-between rounded-xl border border-slate-700/60 bg-slate-900/70 px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`h-2.5 w-2.5 rounded-full ${bandStyles[band].dot}`} />
                      <p className="font-[var(--font-space-grotesk)] text-sm text-slate-100">{friend.name}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`rounded-full px-2 py-1 text-xs ${bandStyles[band].chip}`}>
                        {bandStyles[band].label}
                      </span>
                      <span className="font-[var(--font-orbitron)] text-sm text-slate-100">{friend.healthScore}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </article>

          <aside className="rounded-3xl border border-amber-300/30 bg-slate-900/70 p-6 backdrop-blur-xl">
            <div className="mb-5">
              <h2 className="font-[var(--font-orbitron)] text-2xl tracking-wide text-amber-200">Action Center</h2>
              <p className="mt-1 font-[var(--font-space-grotesk)] text-sm text-slate-300">
                AI-generated nudges based on relationship metadata patterns
              </p>
            </div>

            <ul className="space-y-3">
              {actionSuggestions.map((suggestion, idx) => (
                <li
                  key={`${suggestion}-${idx}`}
                  className="rounded-xl border border-slate-700/70 bg-slate-950/70 p-4 transition hover:border-sky-300/40"
                >
                  <p className="font-[var(--font-space-grotesk)] text-sm leading-relaxed text-slate-100">
                    {suggestion}
                  </p>
                  <button
                    type="button"
                    className="mt-3 rounded-lg border border-sky-300/40 bg-sky-400/10 px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-sky-200 transition hover:bg-sky-300/20"
                  >
                    Queue action
                  </button>
                </li>
              ))}
            </ul>

            <div className="mt-6 rounded-2xl border border-emerald-300/35 bg-emerald-400/10 p-4">
              <p className="font-[var(--font-space-grotesk)] text-xs uppercase tracking-[0.14em] text-emerald-200">
                Privacy Note
              </p>
              <p className="mt-2 font-[var(--font-space-grotesk)] text-sm text-emerald-100/95">
                bubbleOne analyzes timestamps, interaction type, and sentiment metadata locally. Raw message content is not required.
              </p>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
