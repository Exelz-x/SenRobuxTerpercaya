"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";

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

export default function TicketChatPage() {
  const params = useParams();
  const ticketId = String(params?.id ?? "");

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState("");

  const bottomRef = useRef<HTMLDivElement | null>(null);

  async function firstLoad() {
    if (!ticketId) return;

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
  }

  async function pollMessages() {
    if (!ticketId) return;

    const res = await fetch(`/api/ticket/get?id=${ticketId}`);
    const json = await res.json().catch(() => null);

    if (!res.ok || !json?.ok) return;

    // ⚠️ hanya update jika jumlah pesan berubah
    if (json.messages?.length !== messages.length) {
      setMessages(json.messages);
    }

    // status tiket juga bisa berubah (misal CLOSED)
    if (json.ticket?.status !== ticket?.status) {
      setTicket(json.ticket);
    }
  }

    useEffect(() => {
    if (!ticketId) return;

    // simpan ke localStorage
    try {
        const key = "senrobux_tickets";
        const raw = localStorage.getItem(key);
        const list: string[] = raw ? JSON.parse(raw) : [];
        if (!list.includes(ticketId)) {
        list.unshift(ticketId);
        localStorage.setItem(key, JSON.stringify(list.slice(0, 50)));
        }
    } catch {}

    // load pertama (pakai loading)
    firstLoad();

    // polling ringan TANPA loading
    const t = setInterval(pollMessages, 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ticketId]);

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
    setMsg("");

    const res = await fetch("/api/ticket/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticketId, message: text.trim(), as: "USER" }),
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok || !json.ok) {
      setMsg(json.message ?? "Gagal mengirim pesan");
      setSending(false);
      return;
    }

    setText("");
    await pollMessages();
    setSending(false);
  }

  if (!ticketId) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        Ticket ID tidak valid
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Tiket</h1>
            <div className="mt-1 text-sm text-white/70 break-all">{ticketId}</div>
          </div>
          <a
            href="/support"
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
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-lg font-semibold">{ticket.subject}</div>
                <div className="text-sm text-white/70">{ticket.roblox_username}</div>
              </div>
              <div className="text-sm font-semibold">{ticket.status}</div>
            </div>

            <div className="mt-5 space-y-3">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex ${m.sender === "USER" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ring-1 ${
                      m.sender === "USER"
                        ? "bg-green-500/10 ring-green-400/30"
                        : "bg-black/40 ring-white/10"
                    }`}
                  >
                    <div className="text-xs text-white/60 mb-1">
                      {m.sender === "USER" ? "Kamu" : "Admin"}
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
                placeholder={ticket.status === "CLOSED" ? "Tiket ditutup" : "Tulis pesan..."}
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


