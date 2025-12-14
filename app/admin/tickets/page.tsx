"use client";

import { useEffect, useMemo, useState } from "react";

type Ticket = {
  id: string;
  roblox_username: string;
  subject: string;
  status: string;
  created_at: string;
};

export default function AdminTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [tab, setTab] = useState<"ALL" | "OPEN" | "CLOSED">("OPEN");
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);

  async function checkAuth() {
    const r = await fetch("/api/admin/me");
    if (!r.ok) window.location.href = "/admin/login";
  }

  async function load() {
    setLoading(true);
    setMsg("");
    const qs = tab === "ALL" ? "" : `?status=${tab}`;
    const res = await fetch(`/api/admin/tickets${qs}`);
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.ok) {
      setMsg(json.message ?? "Gagal memuat tiket");
      setLoading(false);
      return;
    }
    setTickets(json.tickets ?? []);
    setLoading(false);
  }

  useEffect(() => {
    checkAuth().then(load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return tickets;
    return tickets.filter((t) =>
      [t.subject, t.roblox_username, t.id].join(" ").toLowerCase().includes(query)
    );
  }, [tickets, q]);

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Admin • Tiket CS</h1>
            <p className="mt-1 text-sm text-white/70">Kelola tiket customer service</p>
          </div>
          <a
            href="/admin"
            className="rounded-xl bg-white/5 px-4 py-2 text-sm font-semibold ring-1 ring-white/10 hover:ring-green-400/30"
          >
            Kembali Dashboard
          </a>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          {(["OPEN", "CLOSED", "ALL"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold ring-1 transition ${
                tab === k ? "bg-green-500/10 ring-green-400/40" : "bg-white/5 ring-white/10 hover:ring-green-400/30"
              }`}
            >
              {k}
            </button>
          ))}

          <div className="ml-auto w-full sm:w-80">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari subject / username / id..."
              className="mt-2 sm:mt-0 w-full rounded-xl bg-black/40 px-4 py-2 text-sm ring-1 ring-white/10 outline-none focus:ring-green-400/40"
            />
          </div>
        </div>

        <div className="mt-6">
          {loading ? (
            <div className="text-white/70">Memuat...</div>
          ) : msg ? (
            <div className="rounded-xl bg-red-500/10 p-3 text-sm text-red-200 ring-1 ring-red-400/30">
              {msg}
            </div>
          ) : !filtered.length ? (
            <div className="rounded-2xl bg-white/5 p-6 ring-1 ring-white/10 text-white/70">
              Tidak ada tiket.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filtered.map((t) => (
                <a
                  key={t.id}
                  href={`/admin/ticket?id=${t.id}`}
                  className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10 hover:ring-green-400/30"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold">{t.subject}</div>
                      <div className="text-sm text-white/70">{t.roblox_username}</div>
                    </div>
                    <div className="text-sm font-semibold">{t.status}</div>
                  </div>
                  <div className="mt-2 text-xs text-white/50 break-all">ID: {t.id}</div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
