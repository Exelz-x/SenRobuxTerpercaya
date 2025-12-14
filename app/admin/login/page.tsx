"use client";

import { useState } from "react";

export default function AdminLoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function login() {
    setLoading(true);
    setMsg("");

    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const json = await res.json().catch(() => ({}));

    if (!res.ok || !json.ok) {
      setMsg(json.message ?? "Login gagal");
      setLoading(false);
      return;
    }

    window.location.href = "/admin";
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-md px-4 py-16">
        <div className="rounded-3xl bg-white/5 p-6 ring-1 ring-white/10">
          <h1 className="text-2xl font-bold">Admin Login</h1>

          <label className="mt-5 block text-sm text-white/70">Username</label>
          <input
            className="mt-2 w-full rounded-xl bg-black/40 px-4 py-3 ring-1 ring-white/10 outline-none focus:ring-green-400/40"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />

          <label className="mt-4 block text-sm text-white/70">Password</label>
          <input
            type="password"
            className="mt-2 w-full rounded-xl bg-black/40 px-4 py-3 ring-1 ring-white/10 outline-none focus:ring-green-400/40"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {msg && (
            <div className="mt-4 rounded-xl bg-red-500/10 p-3 text-sm text-red-200 ring-1 ring-red-400/30">
              {msg}
            </div>
          )}

          <button
            onClick={login}
            disabled={loading}
            className="mt-6 w-full rounded-2xl bg-green-500/20 py-3 font-semibold ring-1 ring-green-400/40 hover:bg-green-500/25 disabled:opacity-50"
          >
            {loading ? "Masuk..." : "Login"}
          </button>
        </div>
      </div>
    </main>
  );
}
