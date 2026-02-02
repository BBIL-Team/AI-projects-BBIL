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
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

// ✅ Force the narrative by head name (not by rank)
function rankMetaByHead(head) {
  const h = String(head || "").toLowerCase();

  if (h === "badri") {
    return {
      badge: "🏆 Leader",
      tone: "from-emerald-600/15 to-slate-900/0",
      line: "Set the pace — close pending approvals fast.",
    };
  }

  if (h === "avisek") {
    return {
      badge: "🥈 Chasing",
      tone: "from-blue-600/15 to-slate-900/0",
      line: "Strong finishes win — unblock and deliver today.",
    };
  }

  // Shourya neutral
  return {
    badge: "📌 Focus",
    tone: "from-slate-600/10 to-slate-900/0",
    line: "Pick 1–2 items, finish clean, reduce overdue.",
  };
}

function normalizeName(x) {
  return String(x || "").trim().toLowerCase();
}

function reorderForScoreboard(stats) {
  const wanted = ["badri", "avisek", "shourya"];
  const map = new Map(stats.map((s) => [normalizeName(s.head), s]));
  const pinned = wanted.map((k) => map.get(k)).filter(Boolean);
  const rest = stats.filter((s) => !wanted.includes(normalizeName(s.head)));
  return [...pinned, ...rest];
}

function statusPillClass(status) {
  switch (status) {
    case "Done":
      return "bg-emerald-50 text-emerald-800 border-emerald-200";
    case "Blocked":
      return "bg-rose-50 text-rose-800 border-rose-200";
    case "In Progress":
      return "bg-blue-50 text-blue-800 border-blue-200";
    case "Not Started":
      return "bg-slate-50 text-slate-700 border-slate-200";
    default:
      return "bg-slate-50 text-slate-700 border-slate-200";
  }
}

function priorityForProject(p) {
  // If your data already has p.priority, we respect it
  if (p?.priority) return p.priority;

  const overdueTarget = p?.status !== "Done" && isOverdue(p?.targetDate);
  if (p?.status === "Blocked" || overdueTarget) return "High";
  if (p?.status === "In Progress") return "Medium";
  return "Low";
}

function priorityClass(priority) {
  switch (priority) {
    case "High":
      return "text-rose-700 font-semibold";
    case "Medium":
      return "text-amber-700 font-semibold";
    default:
      return "text-emerald-700 font-semibold";
  }
}

function atRiskForProject(p) {
  // Risk if blocked OR overdue target OR has overdue approvals
  const overdueTarget = p?.status !== "Done" && isOverdue(p?.targetDate);
  const overdueApproval = (p?.approvals || []).some(
    (a) => a.state === "Pending" && isOverdue(a.dueDate)
  );
  return p?.status === "Blocked" || overdueTarget || overdueApproval;
}

function safeNum(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

export default function Landing() {
  const projects = lsGet(PROJECTS_KEY, []);
  const stats = useMemo(() => computeStats(projects), [projects]);
  const statsPinned = useMemo(() => reorderForScoreboard(stats), [stats]);

  // Filters for the tracker table
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
        const hay = `${p.title} ${p.vendor} ${(p.aiHeads || []).join(" ")} ${(p.description || "")} ${(p.assignedTo || "")}`.toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });
  }, [projects, head, vendor, status, q]);

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

  const blocked = useMemo(
    () => projects.filter((p) => p.status === "Blocked").slice(0, 6),
    [projects]
  );

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
    if (!leader) return "No data yet.";
    const gap = leader.score - (stats?.[1]?.score || 0);
    if (gap <= 5) return "Tight competition today — one approval can change ranking.";
    if (gap <= 25) return "Leader is ahead — still catchable by end of day.";
    return "Leader is ahead — unblock + clear overdue to close the gap.";
  }, [stats]);

  const kpis = useMemo(() => {
    const total = projects.length;
    const done = projects.filter((p) => p.status === "Done").length;
    const inProgress = projects.filter((p) => p.status === "In Progress").length;
    const blockedCount = projects.filter((p) => p.status === "Blocked").length;

    let pendingApprovals = 0;
    let overdue = 0;
    for (const p of projects) {
      for (const a of p.approvals || []) {
        if (a.state === "Pending") pendingApprovals += 1;
        if (a.state === "Pending" && isOverdue(a.dueDate)) overdue += 1;
      }
    }
    return { total, done, inProgress, blockedCount, pendingApprovals, overdue };
  }, [projects]);

  return (
    <div className="min-h-full bg-slate-50">
      <TopBar />

      <div className="max-w-6xl mx-auto px-4 py-7 space-y-5">
        {/* HERO */}
        <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-5 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 text-white">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-wider opacity-80">
                  AI Projects Dashboard
                </div>
                <div className="text-2xl font-semibold mt-1">
                  Ship fast. Clear approvals. Stay ahead.
                </div>
                <div className="text-sm opacity-85 mt-2">{topLine}</div>
              </div>
              <div className="flex gap-2 flex-wrap justify-start md:justify-end">
                <Chip>Badri</Chip>
                <Chip>Avisek</Chip>
                <Chip>Shourya</Chip>
                <Chip>Agilisium</Chip>
                <Chip>Medhastra</Chip>
                <Chip>Darsa</Chip>
                <Chip>Vendor 4</Chip>
              </div>
            </div>
          </div>

          {/* KPI Strip */}
          <div className="px-6 py-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="text-xs text-slate-500">Total</div>
              <div className="text-lg font-semibold text-slate-900">{kpis.total}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="text-xs text-slate-500">In Progress</div>
              <div className="text-lg font-semibold text-slate-900">{kpis.inProgress}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="text-xs text-slate-500">Done</div>
              <div className="text-lg font-semibold text-emerald-700">{kpis.done}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="text-xs text-slate-500">Blocked</div>
              <div className="text-lg font-semibold text-rose-700">{kpis.blockedCount}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="text-xs text-slate-500">Pending</div>
              <div className="text-lg font-semibold text-slate-900">{kpis.pendingApprovals}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="text-xs text-slate-500">Overdue</div>
              <div className="text-lg font-semibold text-rose-700">{kpis.overdue}</div>
            </div>
          </div>
        </div>

        {/* ✅ Proper “Project Tracking Template” table on TOP */}
        <Card className="p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-xl font-semibold text-slate-900">
                Project Tracking
              </div>
              <div className="text-sm text-slate-600">
                Spreadsheet-style tracker (Projects • Deliverables • Cost/Hours)
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 w-full lg:w-auto">
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

          <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="min-w-[1100px] w-full text-sm">
              {/* GROUP HEADER ROW */}
              <thead>
                <tr className="bg-slate-100 text-slate-700">
                  <th className="px-3 py-3 border-b border-slate-200" rowSpan={2}>At Risk</th>
                  <th className="px-3 py-3 border-b border-slate-200" rowSpan={2}>Status</th>
                  <th className="px-3 py-3 border-b border-slate-200" rowSpan={2}>Priority</th>
                  <th className="px-3 py-3 border-b border-slate-200" rowSpan={2}>Deadline</th>

                  <th className="px-3 py-3 border-b border-slate-200 text-center" colSpan={3}>
                    Projects
                  </th>

                  <th className="px-3 py-3 border-b border-slate-200 text-center" colSpan={2}>
                    Deliverable(s)
                  </th>

                  <th className="px-3 py-3 border-b border-slate-200 text-center" colSpan={3}>
                    Cost / Hours
                  </th>
                </tr>

                {/* COLUMN HEADER ROW */}
                <tr className="bg-slate-50 text-slate-600">
                  <th className="px-3 py-3 border-b border-slate-200">Task</th>
                  <th className="px-3 py-3 border-b border-slate-200">Description</th>
                  <th className="px-3 py-3 border-b border-slate-200">Assigned to</th>

                  <th className="px-3 py-3 border-b border-slate-200">Deliverable</th>
                  <th className="px-3 py-3 border-b border-slate-200">% Done</th>

                  <th className="px-3 py-3 border-b border-slate-200">Fixed Cost</th>
                  <th className="px-3 py-3 border-b border-slate-200">Est. Hours</th>
                  <th className="px-3 py-3 border-b border-slate-200">Actual Hours</th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((p) => {
                  const atRisk = atRiskForProject(p);
                  const priority = priorityForProject(p);
                  const deliverable =
                    p.deliverable ||
                    (Array.isArray(p.deliverables) ? p.deliverables[0] : "") ||
                    "—";
                  const assigned =
                    p.assignedTo ||
                    p.owner ||
                    (Array.isArray(p.aiHeads) ? p.aiHeads.join(", ") : "") ||
                    "—";

                  // These are optional fields; show blanks if you don’t have them yet
                  const fixedCost = p.fixedCost ?? "";
                  const estHours = p.estimatedHours ?? "";
                  const actualHours = p.actualHours ?? "";

                  return (
                    <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50/70">
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex items-center justify-center w-10 rounded-lg border text-xs font-semibold ${
                            atRisk
                              ? "bg-rose-50 border-rose-200 text-rose-800"
                              : "bg-emerald-50 border-emerald-200 text-emerald-800"
                          }`}
                        >
                          {atRisk ? "Yes" : "No"}
                        </span>
                      </td>

                      <td className="px-3 py-3">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-medium ${statusPillClass(p.status)}`}>
                          {p.status}
                        </span>
                      </td>

                      <td className={`px-3 py-3 ${priorityClass(priority)}`}>{priority}</td>

                      <td className={`px-3 py-3 ${p.status !== "Done" && isOverdue(p.targetDate) ? "text-rose-700 font-semibold" : "text-slate-700"}`}>
                        {fmt(p.targetDate)}
                      </td>

                      <td className="px-3 py-3">
                        <div className="font-medium text-slate-900">{p.title}</div>
                        <div className="text-xs text-slate-500">{p.vendor}</div>
                      </td>

                      <td className="px-3 py-3 text-slate-700">
                        {p.description || "—"}
                      </td>

                      <td className="px-3 py-3">
                        <div className="text-slate-900 font-medium">{assigned}</div>
                        <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-1">
                          {(p.aiHeads || []).slice(0, 3).map((h) => (
                            <Chip key={h}>{h}</Chip>
                          ))}
                        </div>
                      </td>

                      <td className="px-3 py-3 text-slate-700">{deliverable}</td>

                      <td className="px-3 py-3 min-w-[170px]">
                        <div className="flex items-center gap-2">
                          <div className="flex-1">
                            <ProgressBar value={safeNum(p.progress)} />
                          </div>
                          <div className="w-10 text-right text-xs font-semibold text-slate-700">
                            {safeNum(p.progress)}%
                          </div>
                        </div>
                      </td>

                      <td className="px-3 py-3 text-slate-700">
                        {fixedCost !== "" ? fixedCost : "—"}
                      </td>

                      <td className="px-3 py-3 text-slate-700">
                        {estHours !== "" ? estHours : "—"}
                      </td>

                      <td className="px-3 py-3 text-slate-700">
                        {actualHours !== "" ? actualHours : "—"}
                      </td>
                    </tr>
                  );
                })}

                {filtered.length === 0 && (
                  <tr>
                    <td className="px-3 py-8 text-center text-slate-500" colSpan={12}>
                      No projects match the filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* SCOREBOARD (Pinned narrative order) */}
        <div className="grid lg:grid-cols-3 gap-4">
          {statsPinned.map((h) => {
            const meta = rankMetaByHead(h.head);
            return (
              <Card key={h.head} className="p-0 overflow-hidden">
                <div className={`px-5 py-4 bg-gradient-to-br ${meta.tone}`}>
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

                <div className="px-5 py-4 grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center justify-between rounded-xl bg-white border border-slate-200 px-3 py-2">
                    <span>✅ Done</span><span className="font-semibold">{h.done}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-white border border-slate-200 px-3 py-2">
                    <span>⛔ Blocked</span><span className="font-semibold">{h.blocked}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-white border border-slate-200 px-3 py-2">
                    <span>⏳ Pending</span><span className="font-semibold">{h.pendingApprovals}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-white border border-slate-200 px-3 py-2">
                    <span>🔥 Overdue</span><span className="font-semibold">{h.overdueApprovals}</span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Vendor Snapshot (kept, compact) */}
        <Card className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-lg font-semibold text-slate-900">Vendor Snapshot</div>
              <div className="text-sm text-slate-600">Totals, blocked, and done by vendor.</div>
            </div>
            <Chip>Live</Chip>
          </div>

          <div className="mt-4 grid md:grid-cols-2 lg:grid-cols-4 gap-3">
            {VENDORS.map((v) => {
              const total = vendorHeat[v]?.total ?? 0;
              const blockedN = vendorHeat[v]?.blocked ?? 0;
              const doneN = vendorHeat[v]?.done ?? 0;

              return (
                <div key={v} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="font-semibold text-slate-900">{v}</div>
                  <div className="text-xs text-slate-500 mt-1">Total: {total}</div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className={`rounded-xl border bg-white px-3 py-2 ${blockedN > 0 ? "border-rose-200" : "border-slate-200"}`}>
                      <div className="text-xs text-slate-500">Blocked</div>
                      <div className={`text-lg font-semibold ${blockedN > 0 ? "text-rose-700" : "text-slate-900"}`}>{blockedN}</div>
                    </div>
                    <div className={`rounded-xl border bg-white px-3 py-2 ${doneN > 0 ? "border-emerald-200" : "border-slate-200"}`}>
                      <div className="text-xs text-slate-500">Done</div>
                      <div className={`text-lg font-semibold ${doneN > 0 ? "text-emerald-700" : "text-slate-900"}`}>{doneN}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Leaderboard + Today’s Focus */}
        <div className="grid lg:grid-cols-3 gap-4">
          <Card className="p-5 lg:col-span-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold text-slate-900">Leaderboard</div>
                <div className="text-sm text-slate-600">Ranked by computed score.</div>
              </div>
              <div className="text-xs text-slate-500">v1</div>
            </div>

            <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr className="text-left">
                    <th className="py-3 px-3">Rank</th>
                    <th className="py-3 px-3">Head</th>
                    <th className="py-3 px-3">Score</th>
                    <th className="py-3 px-3">Done</th>
                    <th className="py-3 px-3">Blocked</th>
                    <th className="py-3 px-3">Overdue</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.map((h, i) => (
                    <tr key={h.head} className="border-t border-slate-100 hover:bg-slate-50/60">
                      <td className="py-3 px-3 font-semibold text-slate-900">#{i + 1}</td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-900">{h.head}</span>
                          <Chip>{rankMetaByHead(h.head).badge}</Chip>
                        </div>
                      </td>
                      <td className="py-3 px-3 font-semibold">{h.score}</td>
                      <td className="py-3 px-3">{h.done}</td>
                      <td className="py-3 px-3">{h.blocked}</td>
                      <td className="py-3 px-3">{h.overdueApprovals}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

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
                {blocked.length === 0 ? (
                  <div className="text-sm text-slate-500">None 🎉</div>
                ) : (
                  blocked.map((p) => (
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
        </div>

        {/* Timeline */}
        <Card className="p-5">
          <div className="text-lg font-semibold text-slate-900">Timeline</div>
          <div className="text-sm text-slate-600 mt-1">Delivery overlap and deadlines.</div>
          <div className="mt-4">
            <GanttChart projects={projects} />
          </div>
        </Card>

        <div className="text-xs text-slate-500 pb-10">
          Next upgrade: per-head update pages + shared backend so everyone sees the same data.
        </div>
      </div>
    </div>
  );
}
