"use client";

import { useEffect, useState } from "react";

type OrderData = {
  id: string;
  short_code: string | null;
  roblox_username: string;
  member_name: string | null;
  member_class: string | null;
  status: string;
};

export default function MemberCompletePage() {
  const [orderId, setOrderId] = useState("");
  const [order, setOrder] = useState<OrderData | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id") ?? "";
    setOrderId(id);

    if (id) {
      fetch(`/api/order/get?id=${id}`)
        .then((r) => r.json())
        .then((j) => {
          if (j.ok) setOrder(j.order);
          else setMsg("Order tidak ditemukan");
        })
        .catch(() => setMsg("Gagal memuat data order"));
    }
  }, []);

  const code = order?.short_code ?? "(kode belum ada)";

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="mx-auto mt-2 flex h-20 w-20 items-center justify-center rounded-full bg-green-500/10 ring-2 ring-green-400/40">
            ✅
          </div>

          <h1 className="mt-6 text-center text-2xl font-bold">Pembelian Berhasil</h1>
          <p className="mt-2 text-center text-white/70">
            Kamu memilih pembayaran khusus member.
          </p>

          <div className="mt-6 rounded-2xl bg-black/30 p-4 ring-1 ring-white/10">
            <div className="text-sm text-white/70">Kode Pesanan (tulis ini)</div>
            <div className="mt-1 text-3xl font-bold text-green-300">{code}</div>
          </div>

          <div className="mt-4 rounded-2xl bg-green-500/10 p-4 ring-1 ring-green-400/40 text-green-200 text-sm leading-relaxed">
            <strong>Silakan tulis kode pesanan</strong> dan berikan ke <strong>Jansen 9g</strong> serta memberi uang pembayaran.
            <br />
            Status pesanan kamu masih <strong>belum dibayar</strong> sampai admin mengonfirmasi.
          </div>

          {msg && (
            <div className="mt-4 rounded-xl bg-red-500/10 p-3 text-sm text-red-200 ring-1 ring-red-400/30">
              {msg}
            </div>
          )}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <a
              href="/orders"
              className="flex-1 rounded-2xl bg-green-500/20 py-3 text-center font-semibold ring-1 ring-green-400/40 hover:bg-green-500/25"
            >
              Lihat Pesanan Kita
            </a>
            <a
              href="/"
              className="flex-1 rounded-2xl bg-white/5 py-3 text-center font-semibold ring-1 ring-white/10 hover:ring-green-400/30"
            >
              Kembali ke Beranda
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
