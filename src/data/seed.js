import { lsGet, lsSet } from "../lib/storage.js";

export const PROJECTS_KEY = "ai_heads_projects";

export function ensureSeedData() {
  if (lsGet(PROJECTS_KEY)) return;

  lsSet(PROJECTS_KEY, [
    {
      id: "p1",
      title: "Instant Report UX polish",
      vendor: "Agilisium",
      aiHeads: ["Badri", "Avisek"],
      status: "In Progress",
      progress: 60,
      approvals: [
        { id: "a1", title: "UI signoff", owner: "Rajan", dueDate: "2026-02-01", state: "Pending" }
      ],
      updatedAt: Date.now()
    },
    {
      id: "p2",
      title: "Prompt library cleanup",
      vendor: "Darsa",
      aiHeads: ["Shourya"],
      status: "Done",
      progress: 100,
      approvals: [],
      updatedAt: Date.now()
    }
  ]);
}
