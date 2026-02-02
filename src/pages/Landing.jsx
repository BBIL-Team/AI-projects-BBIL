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

function rankMeta(i) {
  if (i === 0)
    return { badge: "🏆 Leader", line: "Keep the lead — clear approvals fast." };
  if (i === 1)
    return { badge: "🥈 Chasing", line: "One strong finish can flip the table." };
  return {
    badge: "🔥 Comeback Mode",
    line: "Unblock + clear overdue = fastest climb.",
  };
}

export default function Landing() {
  const projects = lsGet(PROJECTS_KEY, []);
  const stats = useMemo(() => computeStats(projects), [projects]);

  // Filters for project tracking
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
        const hay = `${p.title} ${p.vendor} ${(p.aiHeads || []).join(" ")}`.toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });
  }, [projects, head, vendor, status, q]);

  // Vendor heatmap model
  const vendorHeat = useMemo(() => {
    const grid = Object.fromEntries(
      VENDORS.map((v) => [v, { total: 0, blocked: 0, done: 0 }])
    );
    for (const p of projects) {
      if (!grid[p.vendor]) continue;
      grid[p.vendor].total += 1;
      if (p.status === "Blocked") grid[p.vendor].blocked += 1;
      if (p.status === "Done") grid[p.vendor].done += 1;
    }
    return grid;
  }, [projects]);

  // Insights panels
  const overdueApprovals = useMemo(() => {
    const list = [];
    for (const p of projects) {
      for (const a of p.approvals || []) {
        if (a.state === "Pending" && isOverdue(a.dueDate)) {
          list.push({
            ...a,
            project: p.title,
            vendor: p.vendor,
            aiHeads: p.aiHeads,
          });
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

  const topLine = useMemo(() => {
    const leader = stats?.[0];
    if (!leader) return "No data yet.";
    const gap = leader.score - (stats?.[1]?.score || 0);
    if (gap <= 5)
      return "Tight race today. One approval can change the leader.";
    if (gap <= 25)
      return "Leader is ahead — but still catchable by end of day.";
    return "Leader is dominating — others need a comeback play (unblock + close approvals).";
  }, [stats]);

  return (
    <div className="min-h-full bg-slate-50">
      <TopBar />

      <div className="max-w-6xl mx-auto px-4 py-7 space-y-5">
        {/* Hero */}
        <div className="rounded-3xl bg-gradient-to-br from-slate-900 to-slate-700 text-white p-6 shadow-sm border border-white/10">
          <div className="text-sm opacity-80">AI Heads Command Centre</div>
          <div className="text-2xl font-semibold mt-1">
            Win the week: ship projects, clear approvals.
          </div>
          <div className="text-sm opacity-85 mt-2">{topLine}</div>
        </div>

        {/* ✅ Project Tracking + Vendor Heatmap on top */}
        <div className="grid lg:grid-cols-3 gap-4">
          {/* Project Tracking (wide) */}
          <Card className="p-5 lg:col-span-2">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="text-lg font-semibold text-slate-900">
                  Project Tracking
                </div>
                <div className="text-sm text-slate-600">
                  Filter and compare workload instantly.
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
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>

                <select
                  className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm"
                  value={vendor}
                  onChange={(e) => setVendor(e.target.value)}
                >
                  <option value="All">All Vendors</option>
                  {VENDORS.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>

                <select
                  className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="All">All Status</option>
                  {["Not Started", "In Progress", "Blocked", "Done"].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
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

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500">
                    <th className="py-2 pr-3">Project</th>
                    <th className="py-2 pr-3">Vendor</th>
                    <th className="py-2 pr-3">Heads</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Progress</th>
                    <th className="py-2 pr-3">Target</th>
                    <th className="py-2 pr-3">Pending</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => {
                    const pending = (p.approvals || []).filter(
                      (a) => a.state === "Pending"
                    ).length;
                    const hasOverdue = (p.approvals || []).some(
                      (a) => a.state === "Pending" && isOverdue(a.dueDate)
                    );

                    return (
                      <tr key={p.id} className="border-t border-slate-100">
                        <td className="py-3 pr-3">
                          <div className="font-medium text-slate-900">
                            {p.title}
                          </div>
                          <div className="text-xs text-slate-500">
                            {fmt(p.startDate)} → {fmt(p.targetDate)}
                          </div>
                        </td>

                        <td className="py-3 pr-3">
                          <Chip>{p.vendor}</Chip>
                        </td>

                        <td className="py-3 pr-3">
                          <div className="flex flex-wrap gap-1">
                            {(p.aiHeads || []).map((h) => (
                              <Chip key={h}>{h}</Chip>
                            ))}
                          </div>
                        </td>

                        <td className="py-3 pr-3">
                          <StatusBadge status={p.status} />
                        </td>

                        <td className="py-3 pr-3 min-w-[180px]">
                          <ProgressBar value={p.progress} />
                          <div className="text-xs text-slate-600 mt-1">
                            {p.progress}%
                          </div>
                        </td>

                        <td
                          className={`py-3 pr-3 ${
                            p.status !== "Done" && isOverdue(p.targetDate)
                              ? "text-rose-700 font-medium"
                              : ""
                          }`}
                        >
                          {fmt(p.targetDate)}
                        </td>

                        <td
                          className={`py-3 pr-3 ${
                            hasOverdue
                              ? "text-rose-700 font-semibold"
                              : "text-slate-900 font-medium"
                          }`}
                        >
                          {pending}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {filtered.length === 0 && (
                <div className="text-sm text-slate-500 mt-4">
                  No projects match the filters.
                </div>
              )}
            </div>
          </Card>

          {/* Vendor Heatmap (right) */}
          <Card className="p-5">
            <div className="text-lg font-semibold text-slate-900">
              Vendor Heatmap
            </div>
            <div className="text-sm text-slate-600 mt-1">
              Totals, blocked, and done by vendor.
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500">
                    <th className="py-2 pr-3">Vendor</th>
                    <th className="py-2 pr-3">Total</th>
                    <th className="py-2 pr-3">Blocked</th>
                    <th className="py-2 pr-3">Done</th>
                  </tr>
                </thead>
                <tbody>
                  {VENDORS.map((v) => (
                    <tr key={v} className="border-t border-slate-100">
                      <td className="py-3 pr-3 font-medium text-slate-900">
                        {v}
                      </td>
                      <td className="py-3 pr-3">{vendorHeat[v]?.total ?? 0}</td>
                      <td
                        className={`py-3 pr-3 ${
                          (vendorHeat[v]?.blocked ?? 0) > 0
                            ? "text-rose-700 font-semibold"
                            : ""
                        }`}
                      >
                        {vendorHeat[v]?.blocked ?? 0}
                      </td>
                      <td
                        className={`py-3 pr-3 ${
                          (vendorHeat[v]?.done ?? 0) > 0
                            ? "text-emerald-700 font-semibold"
                            : ""
                        }`}
                      >
                        {vendorHeat[v]?.done ?? 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 text-xs text-slate-500">
              Tip: Blocked items kill momentum — follow up vendors daily.
            </div>
          </Card>
        </div>

        {/* Scoreboard */}
        <div className="grid lg:grid-cols-3 gap-4">
          {stats.map((h, i) => {
            const meta = rankMeta(i);
            return (
              <Card key={h.head} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold text-slate-900">
                      {h.head}
                    </div>
                    <div className="text-sm text-slate-600 mt-0.5">
                      {meta.line}
                    </div>
                  </div>
                  <Chip>{meta.badge}</Chip>
                </div>

                <div className="mt-4 flex items-end gap-2">
                  <div className="text-4xl font-semibold text-slate-900">
                    {h.score}
                  </div>
                  <div className="text-sm text-slate-500 pb-1">points</div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
                    <span>✅ Done</span>
                    <span className="font-semibold">{h.done}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
                    <span>⛔ Blocked</span>
                    <span className="font-semibold">{h.blocked}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
                    <span>⏳ Pending</span>
                    <span className="font-semibold">{h.pendingApprovals}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
                    <span>🔥 Overdue</span>
                    <span className="font-semibold">{h.overdueApprovals}</span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Leaderboard + Today Focus */}
        <div className="grid lg:grid-cols-3 gap-4">
          <Card className="p-5 lg:col-span-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold text-slate-900">
                  Leaderboard
                </div>
                <div className="text-sm text-slate-600">
                  Score is driven by done + speed − approvals − overdue.
                </div>
              </div>
              <div className="text-xs text-slate-500">v1</div>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500">
                    <th className="py-2 pr-3">Rank</th>
                    <th className="py-2 pr-3">Head</th>
                    <th className="py-2 pr-3">Score</th>
                    <th className="py-2 pr-3">Done</th>
                    <th className="py-2 pr-3">Blocked</th>
                    <th className="py-2 pr-3">Overdue</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.map((h, i) => (
                    <tr key={h.head} className="border-t border-slate-100">
                      <td className="py-3 pr-3 font-semibold text-slate-900">
                        #{i + 1}
                      </td>
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-900">
                            {h.head}
                          </span>
                          <Chip>{rankMeta(i).badge}</Chip>
                        </div>
                      </td>
                      <td className="py-3 pr-3 font-semibold">{h.score}</td>
                      <td className="py-3 pr-3">{h.done}</td>
                      <td className="py-3 pr-3">{h.blocked}</td>
                      <td className="py-3 pr-3">{h.overdueApprovals}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="p-5">
            <div className="text-lg font-semibold text-slate-900">
              Today’s Focus
            </div>
            <div className="text-sm text-slate-600 mt-1">
              Clear overdue approvals first. They destroy points.
            </div>

            <div className="mt-4">
              <div className="text-sm font-medium text-slate-900">
                Overdue approvals
              </div>
              <div className="mt-2 space-y-2">
                {overdueApprovals.length === 0 ? (
                  <div className="text-sm text-slate-500">None 🎉</div>
                ) : (
                  overdueApprovals.map((a) => (
                    <div
                      key={a.id}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                    >
                      <div className="text-sm font-medium text-slate-900">
                        {a.title}
                      </div>
                      <div className="text-xs text-slate-600 mt-1">
                        {a.project} • {a.vendor}
                      </div>
                      <div className="flex items-center justify-between mt-2 text-xs">
                        <span className="text-slate-600">
                          Owner: {a.owner}
                        </span>
                        <span className="text-rose-700 font-medium">
                          Due: {fmt(a.dueDate)}
                        </span>
                      </div>
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {(a.aiHeads || []).map((h) => (
                          <Chip key={h}>{h}</Chip>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="mt-5">
              <div className="text-sm font-medium text-slate-900">
                Blocked projects
              </div>
              <div className="mt-2 space-y-2">
                {blocked.length === 0 ? (
                  <div className="text-sm text-slate-500">None 🎉</div>
                ) : (
                  blocked.map((p) => (
                    <div
                      key={p.id}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium text-slate-900">
                          {p.title}
                        </div>
                        <StatusBadge status="Blocked" />
                      </div>
                      <div className="text-xs text-slate-600 mt-1">
                        {p.vendor}
                      </div>
                      <div className="mt-2">
                        <ProgressBar value={p.progress} />
                        <div className="flex items-center justify-between text-xs text-slate-600 mt-1">
                          <span>{p.progress}%</span>
                          <span
                            className={
                              isOverdue(p.targetDate)
                                ? "text-rose-700 font-medium"
                                : ""
                            }
                          >
                            Target: {fmt(p.targetDate)}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {(p.aiHeads || []).map((h) => (
                          <Chip key={h}>{h}</Chip>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* Gantt */}
        <div className="space-y-2">
          <div className="text-lg font-semibold text-slate-900">Timeline</div>
          <div className="text-sm text-slate-600">
            A single glance view of delivery dates and overlap.
          </div>
          <GanttChart projects={projects} />
        </div>

        <div className="text-xs text-slate-500 pb-10">
          Next upgrade: per-head update pages + shared backend so everyone sees
          the same scoreboard.
        </div>
      </div>
    </div>
  );
}
