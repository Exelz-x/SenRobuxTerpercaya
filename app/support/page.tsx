"use client";

import { useEffect, useState } from "react";

type TicketRow = {
  id: string;
  roblox_username: string;
  subject: string;
  status: string;
  created_at: string;
};

function getDeviceKey() {
  const key = "senrobux_device_key";
  let v = localStorage.getItem(key);
  if (!v) {
    v = `DEV-${Math.random().toString(36).slice(2)}-${Date.now()
      .toString(36)}`.toUpperCase();
    localStorage.setItem(key, v);
  }
  return v;
}

export default function SupportPage() {
  const [username, setUsername] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const [ticketIds, setTicketIds] = useState<string[]>([]);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [listLoading, setListLoading] = useState(false);

  const [hasOpenTicket, setHasOpenTicket] = useState(false);
  const [openTicketId, setOpenTicketId] = useState<string | null>(null);

  // ambil ticket id dari localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem("senrobux_tickets");
      const ids: string[] = raw ? JSON.parse(raw) : [];
      setTicketIds(ids);
    } catch {
      setTicketIds([]);
    }
  }, []);

  async function refreshMyTickets(ids: string[]) {
    if (!ids.length) {
      setTickets([]);
      setHasOpenTicket(false);
      setOpenTicketId(null);
      return;
    }

    setListLoading(true);
    try {
      const rows = await Promise.all(
        ids.slice(0, 50).map(async (id) => {
          const res = await fetch(`/api/ticket/get?id=${id}`);
          const json = await res.json().catch(() => null);
          if (!res.ok || !json?.ok) return null;
          return json.ticket as TicketRow;
        })
      );

      const clean = rows.filter(Boolean) as TicketRow[];
      clean.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

      setTickets(clean);

      const open = clean.find((t) => t.status === "OPEN");
      setHasOpenTicket(!!open);
      setOpenTicketId(open?.id ?? null);
    } finally {
      setListLoading(false);
    }
  }

  useEffect(() => {
    refreshMyTickets(ticketIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketIds]);

  async function createTicket() {
    setLoading(true);
    setMsg("");

    try {
      const res = await fetch("/api/ticket/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roblox_username: username.trim(),
          subject: subject.trim(),
          message: message.trim(),
          deviceKey: getDeviceKey(),
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json.ok) {
        if (res.status === 429 && json.activeTicketId) {
          setMsg("Masih ada tiket OPEN. Membuka tiket lama...");
          window.location.href = `/ticket/${json.activeTicketId}`;
          return;
        }
        setMsg(json.message ?? "Gagal membuat tiket");
        return;
      }

      const id = json.ticketId as string;

      try {
        const key = "senrobux_tickets";
        const raw = localStorage.getItem(key);
        const list: string[] = raw ? JSON.parse(raw) : [];
        if (!list.includes(id)) {
          list.unshift(id);
          localStorage.setItem(key, JSON.stringify(list.slice(0, 50)));
        }
        setTicketIds(list.includes(id) ? list : [id, ...list].slice(0, 50));
      } catch {}

      window.location.href = `/ticket/${id}`;
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-5xl px-4 py-10">

        {/* HEADER */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Customer Service</h1>
            <p className="mt-1 text-sm text-white/70">
              Buat tiket bantuan dan chat dengan admin.
            </p>
          </div>

          {/* ✅ TOMBOL KEMBALI KE BERANDA */}
          <a
            href="/"
            className="
              h-fit rounded-xl bg-white/5 px-4 py-2
              text-sm font-semibold ring-1 ring-white/10
              hover:ring-green-400/30 hover:text-green-300
            "
          >
            ← Kembali ke Beranda
          </a>
        </div>

        {/* FORM */}
        <div className="mt-6 rounded-3xl bg-white/5 p-6 ring-1 ring-white/10">
          <div className="text-lg font-semibold">Buat Tiket</div>

          <label className="mt-4 block text-sm text-white/70">
            Username Roblox
          </label>
          <input
            className="mt-2 w-full rounded-xl bg-black/40 px-4 py-3 ring-1 ring-white/10 outline-none focus:ring-green-400/40"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />

          <label className="mt-4 block text-sm text-white/70">
            Judul / Keluhan
          </label>
          <input
            className="mt-2 w-full rounded-xl bg-black/40 px-4 py-3 ring-1 ring-white/10 outline-none focus:ring-green-400/40"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />

          <label className="mt-4 block text-sm text-white/70">
            Detail Keluhan
          </label>
          <textarea
            className="mt-2 w-full rounded-xl bg-black/40 px-4 py-3 ring-1 ring-white/10 outline-none focus:ring-green-400/40"
            rows={5}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />

          {msg && (
            <div className="mt-4 rounded-xl bg-red-500/10 p-3 text-sm text-red-200 ring-1 ring-red-400/30">
              {msg}
            </div>
          )}

          {hasOpenTicket && openTicketId && (
            <div className="mt-4 rounded-2xl bg-yellow-500/10 p-4 ring-1 ring-yellow-400/30 text-sm text-yellow-200">
              Kamu masih punya tiket <strong>OPEN</strong>.
              <div className="mt-2">
                <a
                  href={`/ticket/${openTicketId}`}
                  className="text-green-300 hover:text-green-200"
                >
                  Buka tiket yang masih OPEN →
                </a>
              </div>
            </div>
          )}

          <button
            onClick={createTicket}
            disabled={loading || hasOpenTicket}
            className="mt-6 w-full rounded-2xl bg-green-500/20 py-3 font-semibold ring-1 ring-green-400/40 hover:bg-green-500/25 disabled:opacity-50"
          >
            {loading
              ? "Membuat..."
              : hasOpenTicket
              ? "Tunggu tiket ditutup admin"
              : "Buat Tiket"}
          </button>
        </div>

        {/* LIST TIKET */}
        <div className="mt-8">
          <div className="text-lg font-semibold">Tiket Saya</div>

          {listLoading ? (
            <div className="mt-3 text-white/70">Memuat tiket...</div>
          ) : !tickets.length ? (
            <div className="mt-3 rounded-2xl bg-white/5 p-5 ring-1 ring-white/10 text-white/70">
              Belum ada tiket di perangkat ini.
            </div>
          ) : (
            <div className="mt-3 grid grid-cols-1 gap-4">
              {tickets.map((t) => (
                <a
                  key={t.id}
                  href={`/ticket/${t.id}`}
                  className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10 hover:ring-green-400/30"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold">{t.subject}</div>
                      <div className="text-sm text-white/70">
                        {t.roblox_username}
                      </div>
                    </div>
                    <div className="text-sm font-semibold">{t.status}</div>
                  </div>
                  <div className="mt-2 text-xs text-white/50 break-all">
                    ID: {t.id}
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>

      </div>
    </main>
  );
}




