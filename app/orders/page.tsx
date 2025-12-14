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

  // tambahan
  short_code: string | null;
  payment_method: string | null;
};

type TabKey = "UNPAID" | "PROCESS" | "DONE" | "CANCELLED" | "ALL";

function tabOf(order: Order): TabKey {
  const s = (order.status || "").toUpperCase();

  if (s.includes("CANCEL")) return "CANCELLED";
  if (s === "DONE") return "DONE";
  if (s === "PAID" || s === "WAITING_DELIVERY" || s === "PROCESS") return "PROCESS";
  if (s === "PENDING_PAYMENT" || s === "WAITING_PAYMENT" || s === "CREATED") return "UNPAID";

  return "ALL";
}

export default function OrdersPage() {
  const [ids, setIds] = useState<string[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>("ALL");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  // ambil daftar orderId dari localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem("senrobux_orders");
      const list: string[] = raw ? JSON.parse(raw) : [];
      setIds(list);
    } catch {
      setIds([]);
    }
  }, []);

  // fetch detail semua order
  useEffect(() => {
    async function run() {
      setLoading(true);
      setMsg("");

      if (!ids.length) {
        setOrders([]);
        setLoading(false);
        return;
      }

      try {
        const results = await Promise.all(
          ids.slice(0, 50).map(async (id) => {
            const res = await fetch(`/api/order/get?id=${id}`);
            const json = await res.json().catch(() => null);
            if (!res.ok || !json?.ok) return null;
            return json.order as Order;
          })
        );

        const clean = results.filter(Boolean) as Order[];
        clean.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
        setOrders(clean);
      } catch {
        setMsg("Gagal memuat daftar pesanan.");
      } finally {
        setLoading(false);
      }
    }
    run();
  }, [ids]);

  const filtered = useMemo(() => {
    if (activeTab === "ALL") return orders;
    return orders.filter((o) => tabOf(o) === activeTab);
  }, [orders, activeTab]);

  function clearOrders() {
    if (!confirm("Hapus daftar pesanan dari perangkat ini?")) return;
    localStorage.removeItem("senrobux_orders");
    setIds([]);
    setOrders([]);
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Pesanan Kita</h1>
            <p className="mt-1 text-white/70 text-sm">
              Daftar pesanan yang pernah dibuat di perangkat/browser ini.
            </p>
          </div>

          <div className="flex gap-2">
            <a
              href="/"
              className="rounded-xl bg-white/5 px-4 py-2 text-sm font-semibold ring-1 ring-white/10 hover:ring-green-400/30"
            >
              Beranda
            </a>
            <button
              onClick={clearOrders}
              className="rounded-xl bg-red-500/10 px-4 py-2 text-sm font-semibold ring-1 ring-red-400/20 hover:ring-red-400/40"
            >
              Hapus daftar
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-6 flex flex-wrap gap-2">
          {([
            ["ALL", "Semua"],
            ["UNPAID", "Belum dibayar"],
            ["PROCESS", "Menunggu diproses"],
            ["DONE", "Selesai"],
            ["CANCELLED", "Batal/Expired"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold ring-1 transition ${
                activeTab === key
                  ? "bg-green-500/10 ring-green-400/40"
                  : "bg-white/5 ring-white/10 hover:ring-green-400/30"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="mt-6">
          {loading ? (
            <div className="text-white/70">Memuat pesanan...</div>
          ) : msg ? (
            <div className="rounded-xl bg-red-500/10 p-3 text-sm text-red-200 ring-1 ring-red-400/30">
              {msg}
            </div>
          ) : !ids.length ? (
            <div className="rounded-2xl bg-white/5 p-6 ring-1 ring-white/10 text-white/70">
              Belum ada pesanan tersimpan di perangkat ini.
            </div>
          ) : !filtered.length ? (
            <div className="rounded-2xl bg-white/5 p-6 ring-1 ring-white/10 text-white/70">
              Tidak ada pesanan di kategori ini.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filtered.map((o) => (
                <div
                  key={o.id}
                  className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 overflow-hidden rounded-full bg-black/30 ring-1 ring-green-400/30 flex items-center justify-center">
                        {o.headshot_url ? (
                          <img
                            src={o.headshot_url}
                            alt="avatar"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="text-white/50">👤</span>
                        )}
                      </div>
                      <div>
                        <div className="font-semibold">{o.roblox_username}</div>
                        <div className="text-sm text-white/70">
                          {o.robux_target.toLocaleString("id-ID")} Robux • Rp{" "}
                          {o.amount_idr.toLocaleString("id-ID")}
                        </div>

                        {/* teks kecil tambahan */}
                        <div className="text-xs text-white/50">
                          {o.short_code ? `Kode: ${o.short_code}` : ""}
                          {o.payment_method ? ` • ${o.payment_method}` : ""}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-sm text-white/70">Status</div>
                      <div className="font-semibold">
                        {o.status}
                        {o.midtrans_transaction_status
                          ? ` • ${o.midtrans_transaction_status}`
                          : ""}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <a
                      href={`/order-complete?id=${o.id}`}
                      className="flex-1 rounded-xl bg-white/5 px-4 py-2 text-center text-sm font-semibold ring-1 ring-white/10 hover:ring-green-400/30"
                    >
                      Detail
                    </a>

                    {tabOf(o) === "UNPAID" && (
                      <a
                        href={`/pay?id=${o.id}`}
                        className="flex-1 rounded-xl bg-green-500/20 px-4 py-2 text-center text-sm font-semibold ring-1 ring-green-400/40 hover:bg-green-500/25"
                      >
                        Bayar sekarang
                      </a>
                    )}
                  </div>

                  <div className="mt-3 text-xs text-white/50 break-all">
                    ID: {o.id}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

