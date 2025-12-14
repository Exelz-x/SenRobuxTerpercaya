"use client";

import { useEffect, useMemo, useState } from "react";

type Order = {
  id: string;
  created_at: string;
  roblox_username: string;
  headshot_url: string | null;
  robux_target: number;
  amount_idr: number;
  status: string;
  midtrans_transaction_status: string | null;
  gamepass_url: string | null;

  payment_method: string | null; // MIDTRANS | MEMBER
  short_code: string | null; // SRX-XXXXXX
  member_name: string | null;
  member_class: string | null;
};

type TabKey = "ALL" | "UNPAID" | "MEMBER" | "WAITING" | "DONE" | "CANCELLED";

function categoryOf(o: Order): TabKey {
  const s = (o.status || "").toUpperCase();
  const method = (o.payment_method || "").toUpperCase();

  if (s.includes("CANCEL") || s.includes("EXPIRE")) return "CANCELLED";
  if (s === "DONE") return "DONE";

  // Khusus member yang belum dikonfirmasi admin
  if (method === "MEMBER" && (s === "CREATED" || s === "PENDING_PAYMENT" || s === "WAITING_PAYMENT")) {
    return "MEMBER";
  }

  // Belum dibayar (umum)
  if (s === "CREATED" || s === "PENDING_PAYMENT" || s === "WAITING_PAYMENT") return "UNPAID";

  // Sudah dibayar / siap diproses
  if (s === "PAID" || s === "WAITING_DELIVERY") return "WAITING";

  return "ALL";
}

export default function AdminPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [tab, setTab] = useState<TabKey>("ALL");
  const [q, setQ] = useState("");

  // ✅ stok input
  const [stockInput, setStockInput] = useState("15000");

  async function checkAuth() {
    const r = await fetch("/api/admin/me");
    if (!r.ok) window.location.href = "/admin/login";
  }

  async function load() {
    setLoading(true);
    setMsg("");

    const res = await fetch(`/api/admin/orders`);
    const json = await res.json().catch(() => ({}));

    if (!res.ok || !json.ok) {
      setMsg(json.message ?? "Gagal memuat pesanan");
      setLoading(false);
      return;
    }

    setOrders(json.orders ?? []);
    setLoading(false);
  }

  useEffect(() => {
    checkAuth().then(load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/admin/login";
  }

  async function post(url: string, body: any) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.ok) throw new Error(json.message ?? "Gagal");
  }

  async function confirmMemberPaid(id: string) {
    if (!confirm("Konfirmasi pembayaran MEMBER? Status jadi PAID.")) return;
    try {
      await post("/api/admin/order/mark-paid", { id });
      await load();
    } catch (e: any) {
      alert(e?.message ?? "Gagal konfirmasi member");
    }
  }

  async function setWaitingDelivery(id: string) {
    if (!confirm("Set status jadi WAITING_DELIVERY (menunggu dikirim)?")) return;
    try {
      await post("/api/admin/order/waiting-delivery", { id });
      await load();
    } catch (e: any) {
      alert(e?.message ?? "Gagal set menunggu dikirim");
    }
  }

  async function markDone(id: string) {
    if (!confirm("Tandai pesanan sebagai DONE (selesai)?")) return;
    try {
      await post("/api/admin/order/done", { id });
      await load();
    } catch (e: any) {
      alert(e?.message ?? "Gagal tandai selesai");
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      alert("✅ Disalin ke clipboard!");
    } catch {
      alert("Gagal copy. Coba manual.");
    }
  }

  const filteredOrders = useMemo(() => {
    const query = q.trim().toLowerCase();

    return orders
      .filter((o) => (tab === "ALL" ? true : categoryOf(o) === tab))
      .filter((o) => {
        if (!query) return true;
        const hay = [o.roblox_username, o.short_code, o.id, o.payment_method, o.member_name, o.member_class]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(query);
      });
  }, [orders, tab, q]);

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Dashboard Admin</h1>
            <p className="mt-1 text-sm text-white/70">Kelola pesanan SenRobux</p>
          </div>

          <div className="flex gap-2">
            {/* tombol baru: Tiket CS */}
            <a
              href="/admin/tickets"
              className="rounded-xl bg-white/5 px-4 py-2 text-sm font-semibold ring-1 ring-white/10 hover:ring-green-400/30"
            >
              Tiket CS
            </a>

            <button
              onClick={load}
              className="rounded-xl bg-white/5 px-4 py-2 text-sm font-semibold ring-1 ring-white/10 hover:ring-green-400/30"
            >
              Refresh
            </button>
            <button
              onClick={logout}
              className="rounded-xl bg-white/5 px-4 py-2 text-sm font-semibold ring-1 ring-white/10 hover:ring-green-400/30"
            >
              Logout
            </button>
          </div>
        </div>

        {/* ✅ STOCK BLOCK (bawah judul) */}
        <div className="mt-6 rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="font-semibold">Stok Robux</div>
              <div className="text-sm text-white/70">Atur stok agar pembelian bisa dibatasi</div>
            </div>

            <div className="flex gap-2">
              <input
                inputMode="numeric"
                placeholder="Contoh: 25000"
                className="w-44 rounded-xl bg-black/40 px-4 py-2 text-sm ring-1 ring-white/10 outline-none focus:ring-green-400/40"
                value={stockInput}
                onChange={(e) => setStockInput(e.target.value.replace(/[^\d]/g, ""))}
              />
              <button
                onClick={async () => {
                  try {
                    const res = await fetch("/api/admin/stock/set", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ stock: Number(stockInput || "0") }),
                    });
                    const json = await res.json().catch(() => ({}));
                    if (!res.ok || !json.ok) {
                      alert(json.message ?? "Gagal set stock");
                      return;
                    }
                    alert("Stock berhasil diupdate");
                  } catch {
                    alert("Error jaringan/server");
                  }
                }}
                className="rounded-xl bg-green-500/20 px-4 py-2 text-sm font-semibold ring-1 ring-green-400/40 hover:bg-green-500/25"
              >
                Update
              </button>
            </div>
          </div>
        </div>

        {/* Tabs + Search */}
        <div className="mt-6 flex flex-wrap items-center gap-2">
          {(
            [
              ["ALL", "Semua"],
              ["UNPAID", "Belum dibayar"],
              ["MEMBER", "Khusus Member"],
              ["WAITING", "Menunggu dikirim"],
              ["DONE", "Selesai"],
              ["CANCELLED", "Batal/Expired"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold ring-1 transition ${
                tab === k ? "bg-green-500/10 ring-green-400/40" : "bg-white/5 ring-white/10 hover:ring-green-400/30"
              }`}
            >
              {label}
            </button>
          ))}

          <div className="ml-auto w-full sm:w-80">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari username / short code / id / member..."
              className="mt-2 sm:mt-0 w-full rounded-xl bg-black/40 px-4 py-2 text-sm ring-1 ring-white/10 outline-none focus:ring-green-400/40"
            />
          </div>
        </div>

        {/* Content */}
        <div className="mt-6">
          {loading ? (
            <div className="text-white/70">Memuat...</div>
          ) : msg ? (
            <div className="rounded-xl bg-red-500/10 p-3 text-sm text-red-200 ring-1 ring-red-400/30">{msg}</div>
          ) : !filteredOrders.length ? (
            <div className="rounded-2xl bg-white/5 p-6 ring-1 ring-white/10 text-white/70">
              Tidak ada pesanan untuk filter ini.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredOrders.map((o) => {
                const cat = categoryOf(o);
                const statusUpper = (o.status || "").toUpperCase();
                const methodUpper = (o.payment_method || "").toUpperCase();

                return (
                  <div key={o.id} className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 overflow-hidden rounded-full bg-black/30 ring-1 ring-green-400/30 flex items-center justify-center">
                          {o.headshot_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={o.headshot_url} alt="avatar" className="h-full w-full object-cover" />
                          ) : (
                            <span className="text-white/50">👤</span>
                          )}
                        </div>

                        <div>
                          <div className="font-semibold">{o.roblox_username}</div>
                          <div className="text-sm text-white/70">
                            {o.robux_target.toLocaleString("id-ID")} Robux • Rp {o.amount_idr.toLocaleString("id-ID")}
                          </div>

                          <div className="mt-2 text-xs text-white/60">
                            {o.short_code ? `Kode: ${o.short_code}` : ""}
                            {o.payment_method ? ` • ${o.payment_method}` : ""}
                            {methodUpper === "MEMBER" && (o.member_name || o.member_class)
                              ? ` • ${o.member_name ?? "-"} (${o.member_class ?? "-"})`
                              : ""}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-sm text-white/70">Status</div>
                        <div className="font-semibold">
                          {o.status}
                          {o.midtrans_transaction_status ? ` • ${o.midtrans_transaction_status}` : ""}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                      <a
                        href={`/admin/order?id=${o.id}`}
                        className="flex-1 rounded-xl bg-white/5 px-4 py-2 text-center text-sm font-semibold ring-1 ring-white/10 hover:ring-green-400/30"
                      >
                        Detail
                      </a>

                      {o.gamepass_url && (
                        <>
                          <a
                            href={o.gamepass_url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex-1 rounded-xl bg-green-500/20 px-4 py-2 text-center text-sm font-semibold ring-1 ring-green-400/40 hover:bg-green-500/25"
                          >
                            Buka Gamepass
                          </a>
                          <button
                            onClick={() => copy(o.gamepass_url!)}
                            className="flex-1 rounded-xl bg-white/5 px-4 py-2 text-sm font-semibold ring-1 ring-white/10 hover:ring-green-400/30"
                          >
                            Copy Link Gamepass
                          </button>
                        </>
                      )}

                      {/* Khusus member: konfirmasi */}
                      {cat === "MEMBER" && (
                        <button
                          onClick={() => confirmMemberPaid(o.id)}
                          className="flex-1 rounded-xl bg-green-500/20 px-4 py-2 text-sm font-semibold ring-1 ring-green-400/40 hover:bg-green-500/25"
                        >
                          Konfirmasi Member (PAID)
                        </button>
                      )}

                      {/* Paid -> waiting delivery */}
                      {cat === "WAITING" && statusUpper === "PAID" && (
                        <button
                          onClick={() => setWaitingDelivery(o.id)}
                          className="flex-1 rounded-xl bg-white/5 px-4 py-2 text-sm font-semibold ring-1 ring-white/10 hover:ring-green-400/30"
                        >
                          Set Menunggu Dikirim
                        </button>
                      )}

                      {/* Waiting -> done */}
                      {cat === "WAITING" && (
                        <button
                          onClick={() => markDone(o.id)}
                          className="flex-1 rounded-xl bg-green-500/20 px-4 py-2 text-sm font-semibold ring-1 ring-green-400/40 hover:bg-green-500/25"
                        >
                          Pesanan Selesai (DONE)
                        </button>
                      )}
                    </div>

                    <div className="mt-3 text-xs text-white/50 break-all">ID: {o.id}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}



