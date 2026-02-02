import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { setUser, getUser } from "../lib/auth";

export default function Login() {
  const [name, setName] = useState("");
  const nav = useNavigate();

  // If already logged in, go to landing
  const existing = getUser();
  if (existing?.name) {
    nav("/", { replace: true });
  }

  return (
    <div className="h-full flex items-center justify-center bg-slate-100">
      <div className="bg-white p-8 rounded-2xl shadow w-96">
        <h2 className="text-xl font-semibold mb-4">AI Heads Login</h2>

        <input
          className="border w-full p-2 rounded mb-4"
          placeholder="Enter name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const ok = setUser(name);
              if (ok) nav("/", { replace: true });
            }
          }}
        />

        <button
          onClick={() => {
            const ok = setUser(name);
            if (ok) nav("/", { replace: true });
          }}
          className="w-full bg-black text-white p-2 rounded"
        >
          Enter
        </button>
      </div>
    </div>
  );
}
