import React from "react";

export default function Chip({ children }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs border border-slate-200 bg-slate-50 text-slate-700">
      {children}
    </span>
  );
}
