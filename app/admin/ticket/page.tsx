"use client";

import { useEffect, useRef, useState } from "react";

type Msg = {
  id: string;
  sender: "USER" | "ADMIN";
  message: string;
  created_at: string;
};
type Ticket = {
  id: string;
  roblox_username: string;
  subject: string;
  status: string;
  created_at: string;
};

export default function AdminTicketDetailPage() {
  const [id, setId] = useState("");
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const bottomRef = useRef<HTMLDivElement | null>(null);

  // ✅ refs untuk polling stabil (hindari stale closure)
  const lastCountRef = useRef(0);
  const lastStatusRef = useRef<string>("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setId(params.get("id") ?? "");
  }, []);

  async function checkAuth() {
    const r = await fetch("/api/admin/me");
    if (!r.ok) window.location.href = "/admin/login";
  }

  // ✅ GANTI load() lama -> firstLoad(ticketId)
  async function firstLoad(ticketId: string) {
    setLoading(true);
    setMsg("");

    const res = await fetch(`/api/ticket/get?id=${ticketId}`);
    const json = await res.json().catch(() => ({}));

    if (!res.ok || !json.ok) {
      setMsg(json.message ?? "Gagal memuat tiket");
      setLoading(false);
      return;
    }

    setTicket(json.ticket);
    setMessages(json.messages ?? []);
    setLoading(false);

    // ✅ set ref setelah set state
    lastCountRef.current = (json.messages ?? []).length;
    lastStatusRef.current = json.ticket?.status ?? "";
  }

  // ✅ polling stabil pakai ref
  async function pollMessages(ticketId: string) {
    const res = await fetch(`/api/ticket/get?id=${ticketId}`);
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok) return;

    const newCount = Array.isArray(json.messages) ? json.messages.length : 0;
    const newStatus = json.ticket?.status ?? "";

    if (newCount !== lastCountRef.current) {
      setMessages(json.messages ?? []);
      lastCountRef.current = newCount;
    }

    if (newStatus && newStatus !== lastStatusRef.current) {
      setTicket(json.ticket);
      lastStatusRef.current = newStatus;
    }
  }

  // ✅ useEffect versi stabil
  useEffect(() => {
    if (!id) return;

    let t: any;

    (async () => {
      await checkAuth();
      await firstLoad(id);
      t = setInterval(() => pollMessages(id), 5000);
    })();

    return () => {
      if (t) clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function send() {
    if (!text.trim()) return;
    if (ticket?.status === "CLOSED") {
      setMsg("Tiket sudah ditutup.");
      return;
    }

    setSending(true);

    const res = await fetch("/api/ticket/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticketId: id, message: text.trim(), as: "ADMIN" }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.ok) {
      setMsg(json.message ?? "Gagal kirim pesan");
      setSending(false);
      return;
    }

    setText("");
    await firstLoad(id); // ✅ refresh + update refs
    setSending(false);
  }

  async function closeTicket() {
    if (!confirm("Tutup tiket ini? (CLOSED)")) return;

    const res = await fetch("/api/admin/ticket/close", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.ok) {
      alert(json.message ?? "Gagal menutup tiket");
      return;
    }

    await firstLoad(id); // ✅ refresh + update refs
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Admin • Detail Tiket</h1>
            <div className="mt-1 text-sm text-white/70 break-all">{id}</div>
          </div>
          <a
            href="/admin/tickets"
            className="rounded-xl bg-white/5 px-4 py-2 text-sm font-semibold ring-1 ring-white/10 hover:ring-green-400/30"
          >
            Kembali
          </a>
        </div>

        {loading ? (
          <div className="mt-6 text-white/70">Memuat...</div>
        ) : msg ? (
          <div className="mt-6 rounded-xl bg-red-500/10 p-3 text-sm text-red-200 ring-1 ring-red-400/30">
            {msg}
          </div>
        ) : ticket ? (
          <div className="mt-6 rounded-3xl bg-white/5 p-6 ring-1 ring-white/10">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold">{ticket.subject}</div>
                <div className="text-sm text-white/70">{ticket.roblox_username}</div>
              </div>
              <div className="flex items-center gap-2">
                <div className="rounded-xl bg-black/40 px-3 py-2 text-sm ring-1 ring-white/10">
                  {ticket.status}
                </div>
                <button
                  onClick={closeTicket}
                  className="rounded-xl bg-red-500/10 px-4 py-2 text-sm font-semibold ring-1 ring-red-400/20 hover:ring-red-400/40"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex ${m.sender === "ADMIN" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ring-1 ${
                      m.sender === "ADMIN"
                        ? "bg-green-500/10 ring-green-400/30"
                        : "bg-black/40 ring-white/10"
                    }`}
                  >
                    <div className="text-xs text-white/60 mb-1">
                      {m.sender === "ADMIN" ? "Admin" : "User"}
                    </div>
                    <div className="whitespace-pre-wrap">{m.message}</div>
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            <div className="mt-6 flex gap-2">
              <input
                className="flex-1 rounded-xl bg-black/40 px-4 py-3 ring-1 ring-white/10 outline-none focus:ring-green-400/40"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={ticket.status === "CLOSED" ? "Tiket ditutup" : "Tulis balasan..."}
                disabled={ticket.status === "CLOSED"}
                onKeyDown={(e) => {
                  if (e.key === "Enter") send();
                }}
              />
              <button
                onClick={send}
                disabled={sending || ticket.status === "CLOSED"}
                className="rounded-2xl bg-green-500/20 px-5 py-3 font-semibold ring-1 ring-green-400/40 hover:bg-green-500/25 disabled:opacity-50"
              >
                Kirim
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}

