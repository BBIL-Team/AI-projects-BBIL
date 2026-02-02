import React from "react";

function styleFor(status) {
  switch (status) {
    case "Done":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "Blocked":
      return "bg-rose-50 text-rose-700 border-rose-200";
    case "In Progress":
      return "bg-blue-50 text-blue-700 border-blue-200";
    default:
      return "bg-slate-50 text-slate-700 border-slate-200";
  }
}

export default function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${styleFor(status)}`}>
      {status}
    </span>
  );
}
