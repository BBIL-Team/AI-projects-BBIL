import { AI_HEADS, SCORE_RULES } from "../data/constants.js";

function isOverdue(dateStr) {
  if (!dateStr) return false;
  const today = new Date().toISOString().slice(0, 10);
  return dateStr < today;
}

export function computeStats(projects) {
  const byHead = Object.fromEntries(
    AI_HEADS.map(h => [h, {
      head: h,
      score: 0,
      done: 0,
      inProgress: 0,
      blocked: 0,
      pendingApprovals: 0,
      overdueApprovals: 0
    }])
  );

  for (const p of projects) {
    const approvals = p.approvals || [];
    const pending = approvals.filter(a => a.state === "Pending");
    const overdue = pending.filter(a => isOverdue(a.dueDate));

    for (const h of p.aiHeads || []) {
      const s = byHead[h];
      if (!s) continue;

      if (p.status === "Done") s.done++;
      if (p.status === "In Progress") s.inProgress++;
      if (p.status === "Blocked") s.blocked++;

      s.pendingApprovals += pending.length;
      s.overdueApprovals += overdue.length;

      let score = 0;
      if (p.status === "Done") score += SCORE_RULES.done;
      if (p.status === "Blocked") score += SCORE_RULES.blocked;
      if (p.progress > 0 && p.status !== "Done") score += SCORE_RULES.inProgress;
      score += pending.length * SCORE_RULES.pendingApproval;
      score += overdue.length * SCORE_RULES.overdueApproval;

      s.score += score;
    }
  }

  return Object.values(byHead).sort((a, b) => b.score - a.score);
}
