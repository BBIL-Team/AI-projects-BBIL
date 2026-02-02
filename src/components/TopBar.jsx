import { useNavigate } from "react-router-dom";
import { clearUser, getUser } from "../lib/auth";

export default function TopBar() {
  const nav = useNavigate();
  const user = getUser();

  return (
    <div className="bg-white border-b px-6 py-4 flex justify-between items-center">
      <h1 className="text-xl font-semibold">AI Heads Command Centre</h1>

      <div className="flex items-center gap-3">
        <div className="text-sm text-slate-600">
          Logged in as <span className="font-medium text-slate-900">{user?.name || "—"}</span>
        </div>

        <button
          onClick={() => {
            clearUser();
            nav("/login", { replace: true });
          }}
          className="text-sm px-3 py-1.5 rounded-xl border hover:bg-slate-50"
        >
          Logout
        </button>
      </div>
    </div>
  );
}
