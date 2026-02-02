import React, { useMemo } from "react";
import Chip from "./Chip.jsx";
import StatusBadge from "./StatusBadge.jsx";

function toDate(iso) {
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00");
  return Number.isNaN(d.getTime()) ? null : d;
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function daysBetween(a, b) {
  const ms = 24 * 60 * 60 * 1000;
  return Math.round((b.getTime() - a.getTime()) / ms);
}

function formatShort(iso) {
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString(undefined, {
      month: "short",
      day: "2-digit",
    });
  } catch {
    return iso || "—";
  }
}

export default function GanttChart({ projects }) {
  const model = useMemo(() => {
    const items = (projects || [])
      .filter((p) => p.startDate && p.targetDate)
      .map((p) => ({
        ...p,
        start: toDate(p.startDate),
        end: toDate(p.targetDate),
      }))
      .filter((p) => p.start && p.end)
      .sort((a, b) => (a.start.getTime() - b.start.getTime()));

    if (items.length === 0) return null;

    const min = new Date(
      Math.min(...items.map((p) => p.start.getTime()))
    );
    const max = new Date(
      Math.max(...items.map((p) => p.end.getTime()))
    );

    // Add padding so bars don't hug edges
    min.setDate(min.getDate() - 2);
    max.setDate(max.getDate() + 2);

    const totalDays = Math.max(1, daysBetween(min, max));
    const ticks = [];
    const tickCount = 8;
    for (let i = 0; i <= tickCount; i++) {
      const t = new Date(min);
      t.setDate(min.getDate() + Math.round((totalDays * i) / tickCount));
      ticks.push(t);
    }

    return { items, min, max, totalDays, ticks };
  }, [projects]);

  if (!model) {
    return (
      <div className="text-sm text-slate-500">
        Add start/target dates to projects to see the Gantt timeline.
      </div>
    );
  }

  const { items, min, totalDays, ticks } = model;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      {/* Header timeline */}
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div className="text-sm font-medium text-slate-900">Gantt Timeline</div>
        <div className="mt-2 grid" style={{ gridTemplateColumns: "280px 1fr" }}>
          <div className="text-xs text-slate-500">Project</div>
          <div className="flex justify-between text-xs text-slate-500">
            {ticks.map((t, i) => (
              <span key={i}>
                {t.toLocaleDateString(undefined, { month: "short", day: "2-digit" })}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Rows */}
      <div className="max-h-[420px] overflow-auto">
        {items.map((p) => {
          const start = toDate(p.startDate);
          const end = toDate(p.targetDate);
          const leftDays = clamp(daysBetween(min, start), 0, totalDays);
          const widthDays = clamp(daysBetween(start, end), 1, totalDays);
          const leftPct = (leftDays / totalDays) * 100;
          const widthPct = (widthDays / totalDays) * 100;

          const isOverdue =
            p.status !== "Done" &&
            p.targetDate &&
            p.targetDate < new Date().toISOString().slice(0, 10);

          return (
            <div
              key={p.id}
              className="px-4 py-3 border-b border-slate-100"
              style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: "12px" }}
            >
              <div className="min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900 truncate">
                      {p.title}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <Chip>{p.vendor}</Chip>
                      {(p.aiHeads || []).map((h) => (
                        <Chip key={h}>{h}</Chip>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <StatusBadge status={p.status} />
                    <div className={`text-xs ${isOverdue ? "text-rose-700 font-medium" : "text-slate-500"}`}>
                      {formatShort(p.startDate)} → {formatShort(p.targetDate)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="relative h-10 rounded-xl bg-slate-50 border border-slate-200 overflow-hidden">
                {/* Today marker */}
                {(() => {
                  const today = new Date();
                  const todayIso = today.toISOString().slice(0, 10);
                  const t = toDate(todayIso);
                  const td = clamp(daysBetween(min, t), 0, totalDays);
                  const tPct = (td / totalDays) * 100;
                  return (
                    <div
                      className="absolute top-0 bottom-0 w-[2px] bg-slate-300"
                      style={{ left: `${tPct}%` }}
                      title="Today"
                    />
                  );
                })()}

                {/* Bar */}
                <div
                  className={`absolute top-1.5 bottom-1.5 rounded-lg ${
                    p.status === "Done"
                      ? "bg-emerald-600"
                      : p.status === "Blocked"
                      ? "bg-rose-600"
                      : "bg-slate-900"
                  }`}
                  style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                  title={`${p.title}\n${p.startDate} → ${p.targetDate}`}
                />

                {/* Progress overlay */}
                <div
                  className="absolute top-1.5 bottom-1.5 rounded-lg bg-white/25"
                  style={{
                    left: `${leftPct}%`,
                    width: `${(widthPct * (100 - (p.progress || 0))) / 100}%`,
                    transform: "translateX(" + `${(widthPct * (p.progress || 0)) / 100}%` + ")",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
