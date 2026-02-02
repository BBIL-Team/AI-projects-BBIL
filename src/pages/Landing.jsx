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

// ---------------- helpers ----------------
function normalizeName(x) {
  return String(x || "").trim().toLowerCase();
}

function safeNum(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

function parseISO(dateStr) {
  // expects YYYY-MM-DD
  if (!dateStr) return null;
  const d = new Date(dateStr + "T00:00:00");
  return Number.isFinite(d.getTime()) ? d : null;
}

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

function reorderForScoreboard(stats) {
  const wanted = ["badri", "avisek", "shourya"];
  const map = new Map(stats.map((s) => [normalizeName(s.head), s]));
  const pinned = wanted.map((k) => map.get(k)).filter(Boolean);
  const rest = stats.filter((s) => !wanted.includes(normalizeName(s.head)));
  return [...pinned, ...rest];
}

function statusTone(status) {
  switch (status) {
    case "Done":
      return {
        pill: "text-emerald-700 bg-emerald-50 border-emerald-200",
        dot: "bg-emerald-500",
        bar: "bg-emerald-500",
      };
    case "Blocked":
      return {
        pill: "text-rose-700 bg-rose-50 border-rose-200",
        dot: "bg-rose-500",
        bar: "bg-rose-500",
      };
    case "In Progress":
      return {
        pill: "text-blue-700 bg-blue-50 border-blue-200",
        dot: "bg-blue-500",
        bar: "bg-blue-500",
      };
    case "Not Started":
    default:
      return {
        pill: "text-slate-700 bg-slate-50 border-slate-200",
        dot: "bg-slate-400",
        bar: "bg-slate-400",
      };
  }
}

function atRiskForProject(p) {
  const overdueTarget = p?.status !== "Done" && isOverdue(p?.targetDate);
  const overdueApproval = (p?.approvals || []).some(
    (a) => a.state === "Pending" && isOverdue(a.dueDate)
  );
  return p?.status === "Blocked" || overdueTarget || overdueApproval;
}

// Build a nice time range for the timeline rows
function computeTimelineRange(items) {
  let min = null;
  let max = null;

  for (const p of items) {
    const s = parseISO(p.startDate) || null;
    const e = parseISO(p.targetDate) || null;

    // fallback: if no startDate, assume 30 days before target
    const start =
      s ||
      (e ? new Date(e.getTime() - 30 * 24 * 3600 * 1000) : null);
    const end = e || s || null;

    if (start) {
      if (!min || start < min) min = start;
      if (!max || start > max) max = start;
    }
    if (end) {
      if (!min || end < min) min = end;
      if (!max || end > max) max = end;
    }
  }

  // if still empty, use "this month"
  if (!min || !max) {
    const now = new Date();
    min = new Date(now.getFullYear(), now.getMonth(), 1);
    max = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  }

  // pad a little so bars don’t touch edges
  const padDays = 7;
  const minP = new Date(min.getTime() - padDays * 24 * 3600 * 1000);
  const maxP = new Date(max.getTime() + padDays * 24 * 3600 * 1000);

  return { min: minP, max: maxP };
}

function pctInRange(date, min, max) {
  const t = date.getTime();
  const a = min.getTime();
  const b = max.getTime();
  if (b <= a) return 0;
  const p = ((t - a) / (b - a)) * 100;
  return Math.max(0, Math.min(100, p));
}

function monthTicks(min, max) {
  // build month labels between min and max (up to 12 labels)
  const out = [];
  const start = new Date(min.getFullYear(), min.getMonth(), 1);
  const end = new Date(max.getFullYear(), max.getMonth(), 1);

  let cur = start;
  while (cur <= end && out.length < 12) {
    out.push(new Date(cur.getFullYear(), cur.getMonth(), 1));
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
  }
  return out;
}

// ---------------- small UI bits ----------------
function Metric({ label, value, tone = "bg-slate-50 border-slate-200" }) {
  return (
    <div className={`rounded-2xl border ${tone} p-4`}>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-2xl font-semibold text-slate-900 mt-1">{value}</div>
    </div>
  );
}

function Donut({ values }) {
  const total = values.reduce((s, v) => s + v.value, 0) || 1;

  let acc = 0;
  const arcs = values.map((v, i) => {
    const start = (acc / total) * 360;
    acc += v.value;
    const end = (acc / total) * 360;

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
        <circle
          cx="44"
          cy="44"
          r="36"
          fill="none"
          strokeWidth="10"
          className="stroke-slate-100"
        />
        {arcs}
        <circle cx="44" cy="44" r="24" className="fill-white" />
        <text
          x="44"
          y="48"
          textAnchor="middle"
          className="fill-slate-900"
          fontSize="14"
          fontWeight="700"
        >
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

// ---------------- main ----------------
export default function Landing() {
  const projects = lsGet(PROJECTS_KEY, []);
  const stats = useMemo(() => computeStats(projects), [projects]);
  const statsPinned = useMemo(() => reorderForScoreboard(stats), [stats]);

  // Filters
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

  const range = useMemo(() => computeTimelineRange(filtered.length ? filtered : projects), [filtered, projects]);
  const ticks = useMemo(() => monthTicks(range.min, range.max), [range]);

  const kpis = useMemo(() => {
    const total = projects.length;
    const done = projects.filter((p) => p.status === "Done").length;
    const inProgress = projects.filter((p) => p.status === "In Progress").length;
    const blocked = projects.filter((p) => p.status === "Blocked").length;
    const risk = projects.filter((p) => atRiskForProject(p)).length;

    let overdue = 0;
    for (const p of projects) {
      for (const a of p.approvals || []) {
        if (a.state === "Pending" && isOverdue(a.dueDate)) overdue++;
      }
    }
    return { total, done, inProgress, blocked, risk, overdue };
  }, [projects]);

  const donutData = useMemo(() => {
    const done = projects.filter((p) => p.status === "Done").length;
    const prog = projects.filter((p) => p.status === "In Progress").length;
    const block = projects.filter((p) => p.status === "Blocked").length;
    const ns = projects.filter((p) => p.status === "Not Started").length;

    return [
      { label: "Done", value: done, className: "stroke-emerald-500", dot: "bg-emerald-500" },
      { label: "In Progress", value: prog, className: "stroke-blue-500", dot: "bg-blue-500" },
      { label: "Blocked", value: block, className: "stroke-rose-500", dot: "bg-rose-500" },
      { label: "Not Started", value: ns, className: "stroke-slate-400", dot: "bg-slate-400" },
    ];
  }, [projects]);

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

  const topLine = useMemo(() => {
    const leader = stats?.[0];
    if (!leader) return "Add projects to start tracking.";
    const gap = leader.score - (stats?.[1]?.score || 0);
    if (gap <= 5) return "Tight competition today — one approval can change ranking.";
    if (gap <= 25) return "Leader is ahead — still catchable by end of day.";
    return "Leader is ahead — unblock + clear overdue to close the gap.";
  }, [stats]);

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

  const blockedList = useMemo(
    () => projects.filter((p) => p.status === "Blocked").slice(0, 6),
    [projects]
  );

  return (
    <div className="min-h-full bg-gradient-to-b from-slate-50 to-white">
      <TopBar />

      <div className="max-w-7xl mx-auto px-4 py-7 space-y-5">
        {/* HERO */}
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

        {/* ✅ TOP GRID: Project Tracking gets ~2/3 width */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
          {/* Project Tracking (8/12 = 2/3) */}
          <Card className="p-5 w-full xl:col-span-8">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
              <div>
                <div className="text-xl font-semibold text-slate-900">Project Tracking</div>
                <div className="text-sm text-slate-600">
                  Timeline-style tracker (like a status report slide).
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 w-full md:w-auto">
                <select
                  className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm"
                  value={head}
                  onChange={(e) => setHead(e.target.value)}
                >
                  <option value="All">All Heads</option>
                  {AI_HEADS.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>

                <select
                  className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm"
                  value={vendor}
                  onChange={(e) => setVendor(e.target.value)}
                >
                  <option value="All">All Vendors</option>
                  {VENDORS.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>

                <select
                  className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="All">All Status</option>
                  {["Not Started", "In Progress", "Blocked", "Done"].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>

                <input
                  className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm"
                  placeholder="Search..."
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
            </div>

            {/* Timeline header ticks */}
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white overflow-hidden">
              <div className="overflow-x-auto">
                <div className="min-w-[900px]">
              <div className="grid grid-cols-12 gap-0 border-b border-slate-200 bg-slate-50">
                <div className="col-span-4 px-4 py-3 text-xs font-semibold text-slate-600">
                  PROJECT
                </div>
                <div className="col-span-8 px-4 py-3">
                  <div className="grid grid-cols-12 gap-0 text-[11px] text-slate-500">
                    {ticks.map((d, idx) => (
                      <div key={idx} className="col-span-1 text-center">
                        {d.toLocaleDateString(undefined, { month: "short" })}
                      </div>
                    ))}
                    {/* if fewer than 12 ticks, fill */}
                    {Array.from({ length: Math.max(0, 12 - ticks.length) }).map((_, i) => (
                      <div key={"f" + i} className="col-span-1 text-center opacity-40">—</div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Rows */}
              <div className="divide-y divide-slate-100">
                {(filtered.length ? filtered : projects).slice(0, 10).map((p) => {
                  const tone = statusTone(p.status);
                  const risk = atRiskForProject(p);

                  const end = parseISO(p.targetDate) || parseISO(p.startDate) || null;
                  const start =
                    parseISO(p.startDate) ||
                    (end ? new Date(end.getTime() - 30 * 24 * 3600 * 1000) : null);

                  const startPct = start ? pctInRange(start, range.min, range.max) : 0;
                  const endPct = end ? pctInRange(end, range.min, range.max) : Math.min(100, startPct + 10);

                  const prog = safeNum(p.progress);
                  const progPct = startPct + ((endPct - startPct) * prog) / 100;

                  return (
                    <div key={p.id} className="grid grid-cols-12 gap-0 items-center bg-white">
                      {/* Left info */}
                      <div className="col-span-4 px-4 py-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`h-2 w-2 rounded-full ${tone.dot}`} />
                              <div className="font-semibold text-slate-900 truncate">{p.title}</div>
                            </div>

                            <div className="mt-1 text-xs text-slate-500 flex flex-wrap gap-2">
                              <span className="font-medium text-slate-700">{p.vendor}</span>
                              <span className="text-slate-300">•</span>
                              <span className={`${isOverdue(p.targetDate) && p.status !== "Done" ? "text-rose-700 font-semibold" : ""}`}>
                                End: {fmt(p.targetDate)}
                              </span>
                            </div>

                            <div className="mt-2 flex flex-wrap gap-1">
                              {(p.aiHeads || []).slice(0, 3).map((h) => (
                                <Chip key={h}>{h}</Chip>
                              ))}
                            </div>
                          </div>

                          <div className="shrink-0 flex flex-col items-end gap-2">
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-xs ${tone.pill}`}>
                              <span className={`h-2 w-2 rounded-full ${tone.dot}`} />
                              {p.status}
                            </span>
                            {risk && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full border text-xs font-semibold bg-rose-50 text-rose-700 border-rose-200">
                                At Risk
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Timeline */}
                      <div className="col-span-8 px-4 py-4">
                        <div className="relative h-10 rounded-xl bg-slate-50 border border-slate-200 overflow-hidden">
                          {/* vertical grid lines (12 columns feel) */}
                          <div className="absolute inset-0 grid grid-cols-12">
                            {Array.from({ length: 12 }).map((_, i) => (
                              <div
                                key={i}
                                className={`border-r ${i === 11 ? "border-r-0" : "border-slate-200/70"}`}
                              />
                            ))}
                          </div>

                          {/* project bar */}
                          <div
                            className="absolute top-1/2 -translate-y-1/2 h-2 rounded-full bg-slate-300"
                            style={{
                              left: `${Math.min(startPct, endPct)}%`,
                              width: `${Math.max(2, Math.abs(endPct - startPct))}%`,
                            }}
                          />
                          <div
                            className={`absolute top-1/2 -translate-y-1/2 h-2 rounded-full ${tone.bar}`}
                            style={{
                              left: `${Math.min(startPct, endPct)}%`,
                              width: `${Math.max(2, (Math.abs(endPct - startPct) * prog) / 100)}%`,
                            }}
                          />

                          {/* start marker */}
                          <div
                            className="absolute top-1/2 -translate-y-1/2"
                            style={{ left: `calc(${startPct}% - 6px)` }}
                            title={`Start: ${p.startDate || "—"}`}
                          >
                            <div className="w-0 h-0 border-t-[6px] border-b-[6px] border-l-[10px] border-t-transparent border-b-transparent border-l-slate-700" />
                          </div>

                          {/* progress marker */}
                          <div
                            className="absolute top-1/2 -translate-y-1/2"
                            style={{ left: `calc(${progPct}% - 6px)` }}
                            title={`Progress: ${prog}%`}
                          >
                            <div className="h-3 w-3 rounded-full bg-white border-2 border-slate-900 shadow-sm" />
                          </div>

                          {/* end marker */}
                          <div
                            className="absolute top-1/2 -translate-y-1/2"
                            style={{ left: `calc(${endPct}% - 7px)` }}
                            title={`End: ${p.targetDate || "—"}`}
                          >
                            <div className={`h-3 w-3 rounded-full border-2 ${p.status === "Done" ? "bg-emerald-500 border-emerald-700" : "bg-white border-slate-700"}`} />
                          </div>

                          {/* right side % label */}
                          <div className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-700">
                            {prog}%
                          </div>
                        </div>

                        {/* tiny details row under bar */}
                        <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                          <span>Start: {fmt(p.startDate)}</span>
                          <span>End: {fmt(p.targetDate)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {(filtered.length ? filtered : projects).length === 0 && (
                  <div className="px-4 py-10 text-center text-sm text-slate-500">
                    No projects yet.
                  </div>
                )}
              </div>
            </div>

            <div className="mt-3 text-xs text-slate-500">
              Tip: This timeline auto-scales based on the earliest start and latest end in your data.
            </div>
          </div>
        </div>

          </Card>

          {/* Right panel (4/12) */}
          <div className="w-full xl:col-span-4 space-y-4">
            <Card className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-lg font-semibold text-slate-900">Status Breakdown</div>
                  <div className="text-sm text-slate-600">Execution at a glance.</div>
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
              <div className="text-sm text-slate-600">Blocked vs Done.</div>

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

        {/* Scoreboard */}
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

        {/* Focus + Timeline */}
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



