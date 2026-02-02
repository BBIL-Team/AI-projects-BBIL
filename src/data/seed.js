import { lsGet, lsSet } from "../lib/storage.js";

export const PROJECTS_KEY = "ai_heads_projects";

function isoFromToday(deltaDays) {
  const d = new Date();
  d.setDate(d.getDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

export function ensureSeedData() {
  const existing = lsGet(PROJECTS_KEY, null);
  if (Array.isArray(existing) && existing.length > 0) return;

  lsSet(PROJECTS_KEY, [
    {
      id: "p1",
      title: "Instant Report UX polish",
      vendor: "Agilisium",
      aiHeads: ["Badri", "Avisek"],
      status: "In Progress",
      progress: 62,
      priority: "High",
      startDate: isoFromToday(-6),
      targetDate: isoFromToday(5),
      approvals: [
        { id: "a1", title: "Final UI sign-off", owner: "Rajan", dueDate: isoFromToday(-1), state: "Pending" },
        { id: "a2", title: "Payment flow check", owner: "Finance", dueDate: isoFromToday(2), state: "Pending" },
      ],
      updatedAt: Date.now(),
    },
    {
      id: "p2",
      title: "Vendor data ingestion pipeline",
      vendor: "Medhastra",
      aiHeads: ["Avisek"],
      status: "Blocked",
      progress: 35,
      priority: "High",
      startDate: isoFromToday(-10),
      targetDate: isoFromToday(8),
      approvals: [
        { id: "a3", title: "S3 access approval", owner: "IT", dueDate: isoFromToday(-3), state: "Pending" },
      ],
      updatedAt: Date.now(),
    },
    {
      id: "p3",
      title: "Prompt library cleanup",
      vendor: "Darsa",
      aiHeads: ["Shourya"],
      status: "In Progress",
      progress: 74,
      priority: "Medium",
      startDate: isoFromToday(-4),
      targetDate: isoFromToday(3),
      approvals: [
        { id: "a4", title: "Approve new prompt taxonomy", owner: "Badri", dueDate: isoFromToday(1), state: "Pending" },
      ],
      updatedAt: Date.now(),
    },
    {
      id: "p4",
      title: "Weekly KPI dashboard",
      vendor: "Vendor 4",
      aiHeads: ["Badri", "Shourya"],
      status: "Done",
      progress: 100,
      priority: "Low",
      startDate: isoFromToday(-14),
      targetDate: isoFromToday(-2),
      approvals: [],
      updatedAt: Date.now(),
    },
    {
      id: "p5",
      title: "Search relevance tuning",
      vendor: "Agilisium",
      aiHeads: ["Badri"],
      status: "Not Started",
      progress: 0,
      priority: "Medium",
      startDate: isoFromToday(1),
      targetDate: isoFromToday(10),
      approvals: [
        { id: "a5", title: "Confirm stopwords list", owner: "Avisek", dueDate: isoFromToday(6), state: "Pending" },
      ],
      updatedAt: Date.now(),
    },
    {
      id: "p6",
      title: "Agent evaluation harness",
      vendor: "Darsa",
      aiHeads: ["Avisek", "Shourya"],
      status: "In Progress",
      progress: 48,
      priority: "High",
      startDate: isoFromToday(-3),
      targetDate: isoFromToday(12),
      approvals: [],
      updatedAt: Date.now(),
    },
  ]);
}
