import React from "react";

export default function ProgressBar({ value }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
      <div className="h-2 rounded-full bg-slate-900" style={{ width: `${v}%` }} />
    </div>
  );
}
