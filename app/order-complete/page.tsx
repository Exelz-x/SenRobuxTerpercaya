"use client";

import { useEffect, useState } from "react";

type OrderData = {
  id: string;
  roblox_username: string;
  headshot_url: string | null;
  robux_target: number;
  gamepass_price_required: number;
  amount_idr: number;
  status: string;
  midtrans_transaction_status: string | null;
  gamepass_url: string | null;
};

export default function OrderCompletePage() {
  const [orderId, setOrderId] = useState("");
  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id") ?? "";
    setOrderId(id);
  }, []);

  useEffect(() => {
    if (!orderId) return;

    let alive = true;

    async function loadOrder() {
      try {
        const res = await fetch(`/api/order/get?id=${orderId}`);
        const json = await res.json().catch(() => ({}));

        if (!alive) return;

        if (!res.ok || !json.ok) {
          setMsg(json.message ?? "Gagal mengambil data pesanan");
          setLoading(false);
          return;
        }

        setOrder(json.order);
        setLoading(false);
        setMsg("");
      } catch {
        if (!alive) return;
        setMsg("Gagal mengambil data pesanan");
        setLoading(false);
      }
    }

    const tick = async () => {
      // 1) coba refresh status midtrans
      try {
        await fetch("/api/midtrans/refresh-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId }),
        });
      } catch {}

      // 2) load order dari DB
      await loadOrder();
    };

    tick();
    const t = setInterval(tick, 3000);

    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [orderId]);

  // ✅ Hapus checkout_intent setelah status sudah PAID
  useEffect(() => {
    const status = String(order?.status ?? "").toUpperCase();

    // sesuaikan dengan status-status "paid-like" di sistem kamu
    const paidLike = ["PAID", "WAITING_DELIVERY", "DONE", "PAID_WAIT_STOCK"];

    if (paidLike.includes(status)) {
      try {
        localStorage.removeItem("senrobux_checkout_intent");
      } catch {}
    }
  }, [order?.status]);

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_0_60px_rgba(34,197,94,0.10)]">
          {/* CHECK ANIMATION */}
          <div className="mx-auto mt-2 flex h-24 w-24 items-center justify-center rounded-full bg-green-500/10 ring-2 ring-green-400/40">
            <svg
              viewBox="0 0 52 52"
              className="h-14 w-14"
              fill="none"
              aria-label="Sukses"
            >
              <path
                d="M14 27.5L22.5 36L38 18"
                stroke="currentColor"
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-green-400"
                style={{
                  strokeDasharray: 100,
                  strokeDashoffset: 100,
                  animation: "dash 900ms ease forwards",
                }}
              />
            </svg>
          </div>

          <h1 className="mt-6 text-center text-2xl font-bold">
            Pesanan Berhasil Dibuat 🎉
          </h1>
          <p className="mt-2 text-center text-white/70">
            Terima kasih! Pesanan kamu sudah tercatat.
          </p>

          {/* INFO BOX */}
          <div className="mt-6 rounded-2xl bg-black/30 p-4 ring-1 ring-white/10">
            <div className="text-sm text-white/70">Nomor Pesanan</div>
            <div className="mt-1 break-all font-mono">{orderId || "-"}</div>
          </div>

          {loading ? (
            <div className="mt-4 text-center text-white/60">
              Memuat detail pesanan…
            </div>
          ) : msg ? (
            <div className="mt-4 rounded-xl bg-red-500/10 p-3 text-sm text-red-200 ring-1 ring-red-400/30">
              {msg}
            </div>
          ) : order ? (
            <>
              {/* ORDER SUMMARY */}
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-2xl bg-black/30 p-4 ring-1 ring-white/10">
                  <div className="text-sm text-white/70">Username Roblox</div>
                  <div className="mt-1 flex items-center gap-3">
                    <div className="h-10 w-10 overflow-hidden rounded-full ring-1 ring-green-400/30 bg-white/5 flex items-center justify-center">
                      {order.headshot_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={order.headshot_url}
                          alt="Avatar Roblox"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-white/50">👤</span>
                      )}
                    </div>
                    <div className="font-semibold">{order.roblox_username}</div>
                  </div>
                </div>

                <div className="rounded-2xl bg-black/30 p-4 ring-1 ring-white/10">
                  <div className="text-sm text-white/70">Jumlah Robux</div>
                  <div className="mt-1 text-xl font-bold text-green-300">
                    {order.robux_target.toLocaleString("id-ID")} Robux
                  </div>
                </div>

                <div className="rounded-2xl bg-black/30 p-4 ring-1 ring-white/10">
                  <div className="text-sm text-white/70">Total Pembayaran</div>
                  <div className="mt-1 text-xl font-bold">
                    Rp {order.amount_idr.toLocaleString("id-ID")}
                  </div>
                </div>

                <div className="rounded-2xl bg-black/30 p-4 ring-1 ring-white/10">
                  <div className="text-sm text-white/70">Status</div>
                  <div className="mt-1 font-semibold">
                    {order.status}
                    {order.midtrans_transaction_status
                      ? ` • ${order.midtrans_transaction_status}`
                      : ""}
                  </div>
                </div>
              </div>

              {/* WAIT MESSAGE */}
              <div className="mt-6 rounded-2xl bg-green-500/10 p-4 ring-1 ring-green-400/40">
                <p className="text-sm leading-relaxed text-green-200">
                  ✅ Jika pembayaran kamu sudah berhasil, Robux akan masuk dalam
                  waktu <strong className="text-green-300">5 - 6 hari</strong>.
                  <br />
                  Mohon simpan nomor pesanan di atas untuk kebutuhan
                  bantuan/komplain.
                </p>
              </div>

              {/* GAMEPASS LINK (optional) */}
              {order.gamepass_url && (
                <div className="mt-4 rounded-2xl bg-black/30 p-4 ring-1 ring-white/10">
                  <div className="text-sm text-white/70">Link Game Pass</div>
                  <a
                    href={order.gamepass_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 block break-all text-green-300 hover:text-green-200"
                  >
                    {order.gamepass_url}
                  </a>
                </div>
              )}
            </>
          ) : null}

          {/* ACTIONS */}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <a
              href="/"
              className="flex-1 rounded-2xl bg-white/5 py-3 text-center font-semibold ring-1 ring-white/10 hover:ring-green-400/30"
            >
              Kembali ke Beranda
            </a>
            <a
              href={orderId ? `/orders?id=${orderId}` : "/orders"}
              className="flex-1 rounded-2xl bg-green-500/20 py-3 text-center font-semibold ring-1 ring-green-400/40 hover:bg-green-500/25"
            >
              Lihat Pesanan Saya
            </a>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes dash {
          to {
            stroke-dashoffset: 0;
          }
        }
      `}</style>
    </main>
  );
}


