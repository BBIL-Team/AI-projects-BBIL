import React, { useMemo, useState } from "react";
import TopBar from "../components/TopBar.jsx";
import Card from "../components/Card.jsx";
import Chip from "../components/Chip.jsx";
import ProgressBar from "../components/ProgressBar.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import GanttChart from "../components/GanttChart.jsx";

import { lsGet } from "../lib/storage.js";
import { PROJECTS_KEY } from "../data/seed.js";
import { AI_HEADS, VENDORS } from "../data/constants.js";
import { computeStats } from "../lib/scoring.js";

// ---------- helpers ----------
function isOverdue(dateStr) {
  if (!dateStr) return false;
  const today = new Date().toISOString().slice(0, 10);
  return dateStr < today;
}
function fmt(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString(undefined, {
      month: "short",
      day: "2-digit",
    });
  } catch {
    return iso;
  }
}
function safeNum(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}
function normalizeName(x) {
  return String(x || "").trim().toLowerCase();
}

// ✅ Narrative pinned by head name (not by score)
function narrativeByHead(head) {
  const h = normalizeName(head);

  if (h === "badri") {
    return {
      badge: "🏆 Leader",
      accent: "ring-emerald-200 bg-emerald-50/70",
      line: "Keep momentum — close pending approvals fast.",
    };
  }
  if (h === "avisek") {
    return {
      badge: "🥈 Chasing",
      accent: "ring-blue-200 bg-blue-50/70",
      line: "Push a strong finish — unblock + deliver today.",
    };
  }
  return {
    badge: "📌 Focus",
    accent: "ring-slate-200 bg-slate-50/70",
    line: "Pick 1–2 items, finish clean, reduce overdue.",
  };
}

// Pin visual order for the top scoreboard cards
function reorderForScoreboard(stats) {
  const wanted = ["badri", "avisek", "shourya"];
  const map = new Map(stats.map((s) => [normalizeName(s.head), s]));
  const pinned = wanted.map((k) => map.get(k)).filter(Boolean);
  const rest = stats.filter((s) => !wanted.includes(normalizeName(s.head)));
  return [...pinned, ...rest];
}

function statusColor(status) {
  switch (status) {
    case "Done":
      return "text-emerald-700 bg-emerald-50 border-emerald-200";
    case "Blocked":
      return "text-rose-700 bg-rose-50 border-rose-200";
    case "In Progress":
      return "text-blue-700 bg-blue-50 border-blue-200";
    case "Not Started":
    default:
      return "text-slate-700 bg-slate-50 border-slate-200";
  }
}

function atRiskForProject(p) {
  const overdueTarget = p?.status !== "Done" && isOverdue(p?.targetDate);
  const overdueApproval = (p?.approvals || []).some(
    (a) => a.state === "Pending" && isOverdue(a.dueDate)
  );
  return p?.status === "Blocked" || overdueTarget || overdueApproval;
}

// ---------- tiny visual components ----------
function Donut({ values }) {
  // values: [{label, value, className}]
  const total = values.reduce((s, v) => s + v.value, 0) || 1;

  let acc = 0;
  const arcs = values.map((v, i) => {
    const start = (acc / total) * 360;
    acc += v.value;
    const end = (acc / total) * 360;

    // SVG arc math
    const r = 36;
    const cx = 44;
    const cy = 44;

    const polar = (angle) => {
      const rad = ((angle - 90) * Math.PI) / 180;
      return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
    };
    const p1 = polar(start);
    const p2 = polar(end);
    const largeArc = end - start > 180 ? 1 : 0;

    const d = `M ${p1.x} ${p1.y} A ${r} ${r} 0 ${largeArc} 1 ${p2.x} ${p2.y}`;
    return (
      <path
        key={i}
        d={d}
        fill="none"
        strokeWidth="10"
        className={v.className}
        strokeLinecap="round"
      />
    );
  });

  return (
    <div className="flex items-center gap-4">
      <svg width="88" height="88" viewBox="0 0 88 88" className="shrink-0">
        <circle cx="44" cy="44" r="36" fill="none" strokeWidth="10" className="stroke-slate-100" />
        {arcs}
        <circle cx="44" cy="44" r="24" className="fill-white" />
        <text x="44" y="48" textAnchor="middle" className="fill-slate-900" fontSize="14" fontWeight="700">
          {total}
        </text>
      </svg>

      <div className="space-y-2">
        {values.map((v) => (
          <div key={v.label} className="flex items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-2">
              <span className={`inline-block h-2.5 w-2.5 rounded-full ${v.dot}`} />
              <span className="text-slate-700">{v.label}</span>
            </div>
            <span className="font-semibold text-slate-900">{v.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Metric({ label, value, hint, tone = "bg-slate-50 border-slate-200" }) {
  return (
    <div className={`rounded-2xl border ${tone} p-4`}>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-2xl font-semibold text-slate-900 mt-1">{value}</div>
      {hint ? <div className="text-xs text-slate-500 mt-1">{hint}</div> : null}
    </div>
  );
}

// ---------- main ----------
export default function Landing() {
  const projects = lsGet(PROJECTS_KEY, []);
  const stats = useMemo(() => computeStats(projects), [projects]);
  const statsPinned = useMemo(() => reorderForScoreboard(stats), [stats]);

  // Filters (top tracker)
  const [head, setHead] = useState("All");
  const [vendor, setVendor] = useState("All");
  const [status, setStatus] = useState("All");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return (projects || []).filter((p) => {
      if (head !== "All" && !(p.aiHeads || []).includes(head)) return false;
      if (vendor !== "All" && p.vendor !== vendor) return false;
      if (status !== "All" && p.status !== status) return false;
      if (query) {
        const hay = `${p.title} ${p.vendor} ${(p.aiHeads || []).join(" ")} ${(p.description || "")}`.toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });
  }, [projects, head, vendor, status, q]);

  // KPIs
  const kpis = useMemo(() => {
    const total = projects.length;
    const done = projects.filter((p) => p.status === "Done").length;
    const inProgress = projects.filter((p) => p.status === "In Progress").length;
    const blocked = projects.filter((p) => p.status === "Blocked").length;
    const risk = projects.filter((p) => atRiskForProject(p)).length;

    let pending = 0;
    let overdue = 0;
    for (const p of projects) {
      for (const a of p.approvals || []) {
        if (a.state === "Pending") pending++;
        if (a.state === "Pending" && isOverdue(a.dueDate)) overdue++;
      }
    }
    return { total, done, inProgress, blocked, risk, pending, overdue };
  }, [projects]);

  // Status breakdown for donut
  const donutData = useMemo(() => {
    const done = projects.filter((p) => p.status === "Done").length;
    const prog = projects.filter((p) => p.status === "In Progress").length;
    const block = projects.filter((p) => p.status === "Blocked").length;
    const ns = projects.filter((p) => p.status === "Not Started").length;

    return [
      {
        label: "Done",
        value: done,
        className: "stroke-emerald-500",
        dot: "bg-emerald-500",
      },
      {
        label: "In Progress",
        value: prog,
        className: "stroke-blue-500",
        dot: "bg-blue-500",
      },
      {
        label: "Blocked",
        value: block,
        className: "stroke-rose-500",
        dot: "bg-rose-500",
      },
      {
        label: "Not Started",
        value: ns,
        className: "stroke-slate-400",
        dot: "bg-slate-400",
      },
    ];
  }, [projects]);

  // Vendor snapshot
  const vendorHeat = useMemo(() => {
    const grid = Object.fromEntries(VENDORS.map((v) => [v, { total: 0, blocked: 0, done: 0 }]));
    for (const p of projects) {
      if (!grid[p.vendor]) continue;
      grid[p.vendor].total += 1;
      if (p.status === "Blocked") grid[p.vendor].blocked += 1;
      if (p.status === "Done") grid[p.vendor].done += 1;
    }
    return grid;
  }, [projects]);

  // Top “message”
  const topLine = useMemo(() => {
    const leader = stats?.[0];
    if (!leader) return "Add projects to start tracking.";
    const gap = leader.score - (stats?.[1]?.score || 0);
    if (gap <= 5) return "Tight competition today — one approval can change ranking.";
    if (gap <= 25) return "Leader is ahead — still catchable by end of day.";
    return "Leader is ahead — unblock + clear overdue to close the gap.";
  }, [stats]);

  // “Today focus”
  const overdueApprovals = useMemo(() => {
    const list = [];
    for (const p of projects) {
      for (const a of p.approvals || []) {
        if (a.state === "Pending" && isOverdue(a.dueDate)) {
          list.push({ ...a, project: p.title, vendor: p.vendor, aiHeads: p.aiHeads });
        }
      }
    }
    list.sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""));
    return list.slice(0, 6);
  }, [projects]);

  const blockedList = useMemo(() => projects.filter((p) => p.status === "Blocked").slice(0, 6), [projects]);

  return (
    <div className="min-h-full bg-gradient-to-b from-slate-50 to-white">
      <TopBar />

      <div className="max-w-7xl mx-auto px-4 py-7 space-y-5">
        {/* HERO: proper web presentation */}
        <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-blue-500/10 blur-2xl" />
          <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-emerald-500/10 blur-2xl" />

          <div className="relative px-6 py-6">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 text-xs text-slate-600">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  AI Projects Command Centre
                </div>
                <div className="mt-2 text-3xl font-semibold text-slate-900">
                  Track execution. Remove blocks. Deliver.
                </div>
                <div className="mt-2 text-sm text-slate-600">{topLine}</div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Chip>Badri</Chip>
                  <Chip>Avisek</Chip>
                  <Chip>Shourya</Chip>
                  <Chip>Agilisium</Chip>
                  <Chip>Medhastra</Chip>
                  <Chip>Darsa</Chip>
                  <Chip>Vendor 4</Chip>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full lg:w-auto">
                <Metric label="Total Projects" value={kpis.total} />
                <Metric label="In Progress" value={kpis.inProgress} tone="bg-blue-50 border-blue-200" />
                <Metric label="Done" value={kpis.done} tone="bg-emerald-50 border-emerald-200" />
                <Metric label="Blocked" value={kpis.blocked} tone="bg-rose-50 border-rose-200" />
                <Metric label="At Risk" value={kpis.risk} tone="bg-amber-50 border-amber-200" />
                <Metric label="Overdue Approvals" value={kpis.overdue} tone="bg-rose-50 border-rose-200" />
              </div>
            </div>
          </div>
        </div>

        {/* TOP: Project Tracking should be on top — but in a premium way */}
        <div className="grid lg:grid-cols-3 gap-4">
          {/* Project Tracking (premium list) */}
          <Card className="p-5 lg:col-span-2">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
              <div>
                <div className="text-xl font-semibold text-slate-900">Project Tracking</div>
                <div className="text-sm text-slate-600">
                  Clean, web-style tracker (not a spreadsheet).
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 w-full md:w-auto">
                <select className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm"
                  value={head} onChange={(e) => setHead(e.target.value)}>
                  <option value="All">All Heads</option>
                  {AI_HEADS.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>

                <select className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm"
                  value={vendor} onChange={(e) => setVendor(e.target.value)}>
                  <option value="All">All Vendors</option>
                  {VENDORS.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>

                <select className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm"
                  value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="All">All Status</option>
                  {["Not Started", "In Progress", "Blocked", "Done"].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>

                <input className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm"
                  placeholder="Search..."
                  value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {filtered.slice(0, 12).map((p) => {
                const risk = atRiskForProject(p);
                const pending = (p.approvals || []).filter((a) => a.state === "Pending").length;
                const overdueTarget = p.status !== "Done" && isOverdue(p.targetDate);

                return (
                  <div key={p.id}
                    className={`rounded-2xl border p-4 bg-white transition hover:shadow-sm ${
                      risk ? "border-rose-200" : "border-slate-200"
                    }`}>
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="text-base font-semibold text-slate-900 truncate">{p.title}</div>
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-xs ${statusColor(p.status)}`}>
                            <span className={`h-2 w-2 rounded-full ${
                              p.status === "Done" ? "bg-emerald-500"
                              : p.status === "Blocked" ? "bg-rose-500"
                              : p.status === "In Progress" ? "bg-blue-500"
                              : "bg-slate-400"
                            }`} />
                            {p.status}
                          </span>
                          {risk && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full border text-xs font-semibold bg-rose-50 text-rose-700 border-rose-200">
                              At Risk
                            </span>
                          )}
                        </div>

                        <div className="mt-1 text-sm text-slate-600 flex flex-wrap gap-2">
                          <span className="inline-flex items-center gap-1">
                            <span className="text-slate-400">Vendor:</span> <span className="font-medium text-slate-800">{p.vendor}</span>
                          </span>
                          <span className="text-slate-300">•</span>
                          <span className="inline-flex items-center gap-1">
                            <span className="text-slate-400">Target:</span>
                            <span className={`${overdueTarget ? "text-rose-700 font-semibold" : "text-slate-800 font-medium"}`}>
                              {fmt(p.targetDate)}
                            </span>
                          </span>
                          <span className="text-slate-300">•</span>
                          <span className="inline-flex items-center gap-1">
                            <span className="text-slate-400">Pending approvals:</span>
                            <span className={`${pending > 0 ? "text-slate-900 font-semibold" : "text-slate-700"}`}>{pending}</span>
                          </span>
                        </div>

                        <div className="mt-2 flex flex-wrap gap-1">
                          {(p.aiHeads || []).map((h) => <Chip key={h}>{h}</Chip>)}
                        </div>
                      </div>

                      <div className="w-full md:w-64">
                        <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
                          <span>Progress</span>
                          <span className="font-semibold text-slate-900">{safeNum(p.progress)}%</span>
                        </div>
                        <ProgressBar value={safeNum(p.progress)} />
                        <div className="mt-2 text-xs text-slate-500 line-clamp-2">
                          {p.description || "—"}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {filtered.length === 0 && (
                <div className="text-sm text-slate-500 py-8 text-center border border-dashed border-slate-200 rounded-2xl">
                  No projects match your filters.
                </div>
              )}

              {filtered.length > 12 && (
                <div className="text-xs text-slate-500 pt-1">
                  Showing 12 of {filtered.length}. (We can add pagination next.)
                </div>
              )}
            </div>
          </Card>

          {/* Right panel: Donut + Vendor performance */}
          <div className="space-y-4">
            <Card className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-lg font-semibold text-slate-900">Status Breakdown</div>
                  <div className="text-sm text-slate-600">A fast visual of execution.</div>
                </div>
                <Chip>Live</Chip>
              </div>

              <div className="mt-4">
                <Donut
                  values={[
                    { label: "Done", value: donutData[0].value, className: donutData[0].className, dot: donutData[0].dot },
                    { label: "In Progress", value: donutData[1].value, className: donutData[1].className, dot: donutData[1].dot },
                    { label: "Blocked", value: donutData[2].value, className: donutData[2].className, dot: donutData[2].dot },
                    { label: "Not Started", value: donutData[3].value, className: donutData[3].className, dot: donutData[3].dot },
                  ]}
                />
              </div>
            </Card>

            <Card className="p-5">
              <div className="text-lg font-semibold text-slate-900">Vendors</div>
              <div className="text-sm text-slate-600">Blocked vs Done at a glance.</div>

              <div className="mt-4 space-y-3">
                {VENDORS.map((v) => {
                  const total = vendorHeat[v]?.total ?? 0;
                  const b = vendorHeat[v]?.blocked ?? 0;
                  const d = vendorHeat[v]?.done ?? 0;

                  return (
                    <div key={v} className="rounded-2xl border border-slate-200 bg-white p-3">
                      <div className="flex items-center justify-between">
                        <div className="font-semibold text-slate-900">{v}</div>
                        <div className="text-xs text-slate-500">Total: {total}</div>
                      </div>

                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <div className={`rounded-xl border px-3 py-2 ${b > 0 ? "bg-rose-50 border-rose-200" : "bg-slate-50 border-slate-200"}`}>
                          <div className="text-xs text-slate-500">Blocked</div>
                          <div className={`text-lg font-semibold ${b > 0 ? "text-rose-700" : "text-slate-900"}`}>{b}</div>
                        </div>
                        <div className={`rounded-xl border px-3 py-2 ${d > 0 ? "bg-emerald-50 border-emerald-200" : "bg-slate-50 border-slate-200"}`}>
                          <div className="text-xs text-slate-500">Done</div>
                          <div className={`text-lg font-semibold ${d > 0 ? "text-emerald-700" : "text-slate-900"}`}>{d}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        </div>

        {/* Scoreboard (still exists, but clean & story-driven) */}
        <div className="grid lg:grid-cols-3 gap-4">
          {statsPinned.map((h) => {
            const meta = narrativeByHead(h.head);
            return (
              <Card key={h.head} className="p-5">
                <div className={`rounded-2xl p-4 ring-1 ${meta.accent}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-lg font-semibold text-slate-900">{h.head}</div>
                      <div className="text-sm text-slate-600 mt-0.5">{meta.line}</div>
                    </div>
                    <Chip>{meta.badge}</Chip>
                  </div>

                  <div className="mt-4 flex items-end gap-2">
                    <div className="text-4xl font-semibold text-slate-900">{h.score}</div>
                    <div className="text-sm text-slate-500 pb-1">points</div>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
                    <span>✅ Done</span><span className="font-semibold">{h.done}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
                    <span>⛔ Blocked</span><span className="font-semibold">{h.blocked}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
                    <span>⏳ Pending</span><span className="font-semibold">{h.pendingApprovals}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
                    <span>🔥 Overdue</span><span className="font-semibold">{h.overdueApprovals}</span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Today Focus + Timeline */}
        <div className="grid lg:grid-cols-3 gap-4">
          <Card className="p-5">
            <div className="text-lg font-semibold text-slate-900">Today’s Focus</div>
            <div className="text-sm text-slate-600 mt-1">Clear overdue approvals first.</div>

            <div className="mt-4">
              <div className="text-sm font-medium text-slate-900">Overdue approvals</div>
              <div className="mt-2 space-y-2">
                {overdueApprovals.length === 0 ? (
                  <div className="text-sm text-slate-500">None 🎉</div>
                ) : (
                  overdueApprovals.map((a) => (
                    <div key={a.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <div className="text-sm font-medium text-slate-900">{a.title}</div>
                      <div className="text-xs text-slate-600 mt-1">{a.project} • {a.vendor}</div>
                      <div className="flex items-center justify-between mt-2 text-xs">
                        <span className="text-slate-600">Owner: {a.owner}</span>
                        <span className="text-rose-700 font-medium">Due: {fmt(a.dueDate)}</span>
                      </div>
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {(a.aiHeads || []).map((h) => <Chip key={h}>{h}</Chip>)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="mt-5">
              <div className="text-sm font-medium text-slate-900">Blocked projects</div>
              <div className="mt-2 space-y-2">
                {blockedList.length === 0 ? (
                  <div className="text-sm text-slate-500">None 🎉</div>
                ) : (
                  blockedList.map((p) => (
                    <div key={p.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium text-slate-900">{p.title}</div>
                        <StatusBadge status="Blocked" />
                      </div>
                      <div className="text-xs text-slate-600 mt-1">{p.vendor}</div>
                      <div className="mt-2">
                        <ProgressBar value={safeNum(p.progress)} />
                        <div className="flex items-center justify-between text-xs text-slate-600 mt-1">
                          <span>{safeNum(p.progress)}%</span>
                          <span className={isOverdue(p.targetDate) ? "text-rose-700 font-medium" : ""}>
                            Target: {fmt(p.targetDate)}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {(p.aiHeads || []).map((h) => <Chip key={h}>{h}</Chip>)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </Card>

          <Card className="p-5 lg:col-span-2">
            <div className="text-lg font-semibold text-slate-900">Timeline</div>
            <div className="text-sm text-slate-600 mt-1">Delivery overlap and deadlines.</div>
            <div className="mt-4">
              <GanttChart projects={projects} />
            </div>
          </Card>
        </div>

        <div className="text-xs text-slate-500 pb-10">
          Next: per-head update pages + shared backend so everyone sees the same live data.
        </div>
      </div>
    </div>
  );
}
