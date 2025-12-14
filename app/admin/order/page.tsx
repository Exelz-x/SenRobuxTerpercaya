"use client";

import { useEffect, useState } from "react";

type Order = any;

export default function AdminOrderDetailPage() {
  const [id, setId] = useState("");
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setId(params.get("id") ?? "");
  }, []);

  useEffect(() => {
    if (!id) return;

    async function run() {
      const auth = await fetch("/api/admin/me");
      if (!auth.ok) {
        window.location.href = "/admin/login";
        return;
      }

      setLoading(true);
      setMsg("");

      const res = await fetch(`/api/admin/order?id=${id}`);
      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json.ok) {
        setMsg(json.message ?? "Gagal load order");
        setLoading(false);
        return;
      }

      setOrder(json.order);
      setLoading(false);
    }

    run();
  }, [id]);

  async function markDone() {
    if (!confirm("Tandai pesanan ini sebagai DONE?")) return;

    const res = await fetch("/api/admin/order/done", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.ok) {
      alert(json.message ?? "Gagal update");
      return;
    }

    window.location.reload();
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        Memuat...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="rounded-3xl bg-white/5 p-6 ring-1 ring-white/10">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">Detail Pesanan</h1>
              <div className="mt-1 text-sm text-white/60 break-all">{id}</div>
            </div>

            <a
              href="/admin"
              className="rounded-xl bg-white/5 px-4 py-2 text-sm font-semibold ring-1 ring-white/10 hover:ring-green-400/30"
            >
              Kembali
            </a>
          </div>

          {msg && (
            <div className="mt-4 rounded-xl bg-red-500/10 p-3 text-sm text-red-200 ring-1 ring-red-400/30">
              {msg}
            </div>
          )}

          {order && (
            <>
              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Info label="Username" value={order.roblox_username} />
                <Info
                  label="Robux"
                  value={`${Number(order.robux_target).toLocaleString("id-ID")} Robux`}
                />
                <Info
                  label="Total"
                  value={`Rp ${Number(order.amount_idr).toLocaleString("id-ID")}`}
                />
                <Info
                  label="Status"
                  value={`${order.status}${
                    order.midtrans_transaction_status
                      ? " • " + order.midtrans_transaction_status
                      : ""
                  }`}
                />
                <Info
                  label="Harga Gamepass Wajib"
                  value={`${Number(order.gamepass_price_required).toLocaleString(
                    "id-ID"
                  )} Robux`}
                />
                <Info
                  label="Midtrans Order ID"
                  value={order.midtrans_order_id ?? "-"}
                />
                <Info
                  label="Metode Pembayaran"
                  value={order.payment_method ?? "-"}
                />
                <Info label="Kode Pendek" value={order.short_code ?? "-"} />

                {order.payment_method === "MEMBER" && (
                  <>
                    <Info label="Nama Member" value={order.member_name ?? "-"} />
                    <Info label="Kelas" value={order.member_class ?? "-"} />
                  </>
                )}
              </div>

              {order.gamepass_url && (
                <div className="mt-4 rounded-2xl bg-black/30 p-4 ring-1 ring-white/10">
                  <div className="text-sm text-white/70">Link Gamepass</div>
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

              {/* Tombol DONE */}
              <button
                onClick={markDone}
                className="mt-6 w-full rounded-2xl bg-green-500/20 py-3 font-semibold ring-1 ring-green-400/40 hover:bg-green-500/25"
              >
                Tandai Selesai (DONE)
              </button>

              {/* Tombol Konfirmasi Pembayaran Member */}
              {order?.payment_method === "MEMBER" &&
                (order?.status === "PENDING_PAYMENT" ||
                  order?.status === "CREATED") && (
                  <button
                    onClick={async () => {
                      if (
                        !confirm(
                          "Konfirmasi pembayaran member? Status jadi PAID."
                        )
                      )
                        return;

                      const res = await fetch(
                        "/api/admin/order/mark-paid",
                        {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ id }),
                        }
                      );

                      const json = await res.json().catch(() => ({}));
                      if (!res.ok || !json.ok) {
                        alert(json.message ?? "Gagal konfirmasi");
                        return;
                      }

                      window.location.reload();
                    }}
                    className="mt-3 w-full rounded-2xl bg-green-500/20 py-3 font-semibold ring-1 ring-green-400/40 hover:bg-green-500/25"
                  >
                    Konfirmasi Pembayaran Member (PAID)
                  </button>
                )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-black/30 p-4 ring-1 ring-white/10">
      <div className="text-sm text-white/70">{label}</div>
      <div className="mt-1 font-semibold break-all">{value}</div>
    </div>
  );
}

