"use client";

import { useEffect, useState } from "react";

type OrderData = {
  id: string;
  roblox_username: string;
  headshot_url: string | null;
  robux_target: number;
  gamepass_price_required: number;
};

export default function CreateGamepassPage() {
  const [orderId, setOrderId] = useState("");
  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState("");

  // ambil order ID dari URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    if (id) setOrderId(id);
  }, []);

  // ambil data order dari server
  useEffect(() => {
    if (!orderId) return;

    fetch(`/api/order/get?id=${orderId}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.ok) {
          setOrder(json.order);
        } else {
          setMessage("Order tidak ditemukan");
        }
        setLoading(false);
      })
      .catch(() => {
        setMessage("Gagal mengambil data order");
        setLoading(false);
      });
  }, [orderId]);

  async function checkGamepassAgain() {
    if (!orderId) return;

    setChecking(true);
    setMessage("");

    const res = await fetch("/api/order/refresh-gamepass", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId }),
    });

    const json = await res.json();

    if (!res.ok || !json.ok) {
      setMessage(json.message ?? "Gagal mengecek gamepass");
      setChecking(false);
      return;
    }

    if (!json.found) {
      setMessage("❌ Gamepass belum ditemukan. Pastikan harga gamepass sudah sesuai dan ENABLE REGIONAL PRICING Pastikan MATI.");
      setChecking(false);
      return;
    }

    // ✅ sukses → ke pembayaran
    window.location.href = json.next;
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        Memuat data...
      </main>
    );
  }

  if (!order) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        Order tidak valid
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h1 className="text-2xl font-bold">Buat Game Pass</h1>
          <p className="mt-2 text-white/70">
            Silakan ikuti instruksi di bawah ini untuk melanjutkan pesanan Robux kamu.
          </p>

          {/* PLAYER INFO */}
          <div className="mt-6 flex items-center gap-4 rounded-2xl bg-black/30 p-4 ring-1 ring-white/10">
            <div className="h-16 w-16 overflow-hidden rounded-full ring-2 ring-green-400/40 bg-white/5 flex items-center justify-center">
              {order.headshot_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={order.headshot_url}
                  alt="Avatar Roblox"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-white/50 text-xl">👤</span>
              )}
            </div>

            <div>
              <div className="text-sm text-white/70">Username Roblox</div>
              <div className="text-lg font-semibold">{order.roblox_username}</div>
            </div>
          </div>

          {/* ORDER INFO */}
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-2xl bg-black/30 p-4 ring-1 ring-white/10">
              <div className="text-sm text-white/70">Jumlah Robux Dibeli</div>
              <div className="mt-1 text-xl font-bold text-green-300">
                {order.robux_target.toLocaleString("id-ID")} Robux
              </div>
            </div>

            <div className="rounded-2xl bg-black/30 p-4 ring-1 ring-white/10">
              <div className="text-sm text-white/70">Harga Game Pass Wajib</div>
              <div className="mt-1 text-xl font-bold text-green-400">
                {order.gamepass_price_required.toLocaleString("id-ID")} Robux
              </div>
            </div>
          </div>

          {/* INSTRUCTION */}
          <div className="mt-6 rounded-2xl bg-green-500/10 p-4 ring-1 ring-green-400/40">
            <p className="text-sm leading-relaxed text-green-200">
              ⚠️ <strong>Perhatian:</strong><br />
              Silakan buat <strong>Game Pass</strong> di Roblox dengan harga
              <strong className="text-green-300">
                {" "}
                {order.gamepass_price_required.toLocaleString("id-ID")} Robux
              </strong>.
              <br />
              Harga ini sudah disesuaikan dengan pajak Roblox sebesar 30%.
            </p>
          </div>

          {/* VIDEO */}
          <div className="mt-6 overflow-hidden rounded-2xl ring-1 ring-white/10">
            <div className="aspect-video bg-black">
              <iframe
                src="https://www.youtube.com/embed/_SN4xCSzldg"
                title="Tutorial Membuat Game Pass Roblox"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="h-full w-full"
              />
            </div>
          </div>

          {message && (
            <div className="mt-4 rounded-xl bg-white/5 p-3 text-sm ring-1 ring-white/10">
              {message}
            </div>
          )}

          {/* ACTIONS */}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <a
              href="https://create.roblox.com/"
              target="_blank"
              rel="noreferrer"
              className="flex-1 rounded-2xl bg-green-500/20 py-3 text-center font-semibold ring-1 ring-green-400/40 hover:bg-green-500/25"
            >
              Buat Game Pass
            </a>

            <button
              onClick={checkGamepassAgain}
              disabled={checking}
              className="flex-1 rounded-2xl bg-white/5 py-3 font-semibold ring-1 ring-white/10 hover:ring-green-400/30 disabled:opacity-50"
            >
              {checking ? "Mengecek..." : "Sudah Membuat Game Pass"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}


