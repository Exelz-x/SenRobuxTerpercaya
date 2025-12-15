"use client";

import { useEffect, useMemo, useState } from "react";

declare global {
  interface Window {
    snap?: {
      pay: (token: string, options?: any) => void;
    };
  }
}

type Order = {
  id: string;
  created_at?: string;
  roblox_username?: string;
  robux_target?: number;
  amount_idr?: number;
  status?: string;
  payment_channel?: string | null;
  payment_method?: string | null;
  midtrans_transaction_status?: string | null;
};

function formatIdr(n: number) {
  return `Rp ${Number(n).toLocaleString("id-ID")}`;
}

function formatDateTime(iso?: string) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function PayPage() {
  const [orderId, setOrderId] = useState("");
  const [order, setOrder] = useState<Order | null>(null);
  const [loadingOrder, setLoadingOrder] = useState(false);

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  // member modal state
  const [showMember, setShowMember] = useState(false);
  const [memberStep, setMemberStep] = useState<1 | 2>(1);
  const [memberCode, setMemberCode] = useState("");
  const [realName, setRealName] = useState("");
  const [kelas, setKelas] = useState("");
  const [memberLoading, setMemberLoading] = useState(false);
  const [memberMsg, setMemberMsg] = useState("");

  // ambil orderId dari query params + simpan ke localStorage
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id") ?? "";
    setOrderId(id);

    if (id) {
      try {
        const key = "senrobux_orders";
        const raw = localStorage.getItem(key);
        const list: string[] = raw ? JSON.parse(raw) : [];
        if (!list.includes(id)) {
          list.unshift(id);
          localStorage.setItem(key, JSON.stringify(list.slice(0, 50)));
        }
      } catch {}
    }
  }, []);

  // ✅ ambil detail order untuk ditampilkan
  useEffect(() => {
    if (!orderId) return;

    let stop = false;

    async function load() {
      setLoadingOrder(true);
      try {
        const r = await fetch(`/api/order/get?id=${orderId}`, { cache: "no-store" });
        const j = await r.json().catch(() => null);
        if (!stop) {
          if (r.ok && j?.ok && j?.order) setOrder(j.order as Order);
          else setOrder(null);
        }
      } catch {
        if (!stop) setOrder(null);
      } finally {
        if (!stop) setLoadingOrder(false);
      }
    }

    load();

    return () => {
      stop = true;
    };
  }, [orderId]);

  // ✅ POLLING STATUS (auto redirect kalau sudah PAID)
  useEffect(() => {
    if (!orderId) return;

    let stop = false;

    async function tick() {
      try {
        // 1) paksa sync status dari Midtrans
        await fetch("/api/midtrans/refresh-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId }),
        });

        // 2) ambil status order terbaru dari DB
        const r = await fetch(`/api/order/get?id=${orderId}`, { cache: "no-store" });
        const j = await r.json().catch(() => null);

        const latest = j?.order as Order | undefined;
        const status = String(latest?.status ?? "");

        // update detail UI sekalian biar selalu fresh
        if (latest && !stop) setOrder(latest);

        // status yang dianggap pembayaran sudah beres
        const paidLike = ["PAID", "WAITING_DELIVERY", "DONE", "PAID_WAIT_STOCK"];

        if (paidLike.includes(status)) {
          window.location.href = `/order-complete?id=${orderId}`;
        }
      } catch {}
    }

    tick();
    const t = setInterval(() => {
      if (!stop) tick();
    }, 3000);

    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [orderId]);

  const orderSummary = useMemo(() => {
    return {
      username: order?.roblox_username ?? "-",
      robux: typeof order?.robux_target === "number" ? order.robux_target.toLocaleString("id-ID") : "-",
      price: typeof order?.amount_idr === "number" ? formatIdr(order.amount_idr) : "-",
      time: formatDateTime(order?.created_at),
      status: order?.status ?? "-",
    };
  }, [order]);

  async function payNow() {
    if (!orderId) return;

    setLoading(true);
    setMsg("");

    try {
      const res = await fetch("/api/midtrans/create-snap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json.ok) {
        setMsg(
          json.detail ? `${json.message}: ${json.detail}` : json.message ?? "Gagal membuat transaksi Midtrans"
        );
        return;
      }

      if (!window.snap?.pay) {
        setMsg("Snap.js belum ter-load. Coba refresh halaman.");
        return;
      }

      window.snap.pay(json.token, {
        onSuccess: async function () {
          try {
            await fetch("/api/midtrans/refresh-status", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ orderId }),
            });
          } catch {}
          window.location.href = `/order-complete?id=${orderId}`;
        },
        onPending: function () {
          setMsg("⏳ Pembayaran pending. Silakan selesaikan pembayaran.");
        },
        onError: function () {
          setMsg("❌ Pembayaran gagal. Coba lagi.");
        },
        onClose: function () {
          setMsg("Kamu menutup popup pembayaran. Klik Bayar lagi untuk mencoba.");
        },
      });
    } catch {
      setMsg("Terjadi error jaringan/server saat menyiapkan pembayaran.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyMemberCode() {
    setMemberLoading(true);
    setMemberMsg("");

    try {
      const res = await fetch("/api/order/verify-member-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberCode: memberCode.trim() }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json.ok) {
        setMemberMsg(json.message ?? "Kode member salah");
        return;
      }

      setMemberStep(2);
    } catch {
      setMemberMsg("Error jaringan/server");
    } finally {
      setMemberLoading(false);
    }
  }

  async function submitMember() {
    setMemberLoading(true);
    setMemberMsg("");

    try {
      const res = await fetch("/api/order/member-pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          memberCode: memberCode.trim(),
          payment_method: "MEMBER",
          member_name: realName.trim(),
          member_class: kelas.trim(),
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json.ok) {
        setMemberMsg(json.message ?? "Gagal memproses pembayaran member");
        return;
      }

      window.location.href = json.next;
    } catch {
      setMemberMsg("Error jaringan/server");
    } finally {
      setMemberLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h1 className="text-2xl font-bold">Checkout</h1>
          <p className="mt-2 text-white/70">Pilih metode pembayaran di bawah.</p>

          {/* ✅ GANTI Order ID -> Detail Pesanan */}
          <div className="mt-6 rounded-2xl bg-black/30 p-4 ring-1 ring-white/10">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm text-white/70">Detail Pesanan</div>
              {loadingOrder && <div className="text-xs text-white/50">Memuat...</div>}
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
                <div className="text-xs text-white/60">Username Roblox</div>
                <div className="font-semibold">{orderSummary.username}</div>
              </div>

              <div className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
                <div className="text-xs text-white/60">Jumlah Robux</div>
                <div className="font-semibold">{orderSummary.robux}</div>
              </div>

              <div className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
                <div className="text-xs text-white/60">Harga</div>
                <div className="font-semibold">{orderSummary.price}</div>
              </div>

              <div className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
                <div className="text-xs text-white/60">Waktu Pembelian</div>
                <div className="font-semibold">{orderSummary.time}</div>
              </div>

              <div className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10 sm:col-span-2">
                <div className="text-xs text-white/60">Status</div>
                <div className="font-semibold">
                  {orderSummary.status}
                  {order?.midtrans_transaction_status ? ` • ${order.midtrans_transaction_status}` : ""}
                </div>
              </div>
            </div>

            {/* opsional: tampilkan orderId kecil */}
            <div className="mt-3 text-xs text-white/40 break-all">ID: {orderId || "-"}</div>
          </div>

          {msg && (
            <div className="mt-4 rounded-xl bg-white/5 p-3 text-sm ring-1 ring-white/10">
              {msg}
            </div>
          )}

          {/* Midtrans */}
          <button
            onClick={payNow}
            disabled={loading}
            className="mt-6 w-full rounded-2xl bg-green-500/20 py-3 font-semibold ring-1 ring-green-400/40 hover:bg-green-500/25 disabled:opacity-50"
          >
            {loading ? "Menyiapkan..." : "Bayar via QRIS / eWallet"}
          </button>

          {/* Member */}
          <button
            onClick={() => {
              setShowMember(true);
              setMemberStep(1);
              setMemberMsg("");
              setMemberCode("");
              setRealName("");
              setKelas("");
            }}
            className="mt-3 w-full rounded-2xl bg-white/5 py-3 font-semibold ring-1 ring-white/10 hover:ring-green-400/30"
          >
            Pembayaran khusus member
          </button>
        </div>
      </div>

      {/* Modal Member */}
      {showMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-3xl bg-[#0b0b0b] p-6 ring-1 ring-white/10">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-bold">Pembayaran Khusus Member</div>
                <div className="text-sm text-white/70">
                  {memberStep === 1 ? "Masukkan kode member" : "Isi data member"}
                </div>
              </div>
              <button
                onClick={() => setShowMember(false)}
                className="rounded-xl bg-white/5 px-3 py-1 text-sm ring-1 ring-white/10 hover:ring-green-400/30"
              >
                Tutup
              </button>
            </div>

            {memberStep === 1 && (
              <>
                <label className="mt-5 block text-sm text-white/70">Kode member</label>
                <input
                  className="mt-2 w-full rounded-xl bg-black/40 px-4 py-3 ring-1 ring-white/10 outline-none focus:ring-green-400/40"
                  value={memberCode}
                  onChange={(e) => setMemberCode(e.target.value)}
                  placeholder="Masukkan kode member..."
                />

                {memberMsg && (
                  <div className="mt-4 rounded-xl bg-red-500/10 p-3 text-sm text-red-200 ring-1 ring-red-400/30">
                    {memberMsg}
                  </div>
                )}

                <button
                  onClick={() => {
                    if (!memberCode.trim()) {
                      setMemberMsg("Kode member wajib diisi");
                      return;
                    }
                    verifyMemberCode();
                  }}
                  disabled={memberLoading}
                  className="mt-6 w-full rounded-2xl bg-green-500/20 py-3 font-semibold ring-1 ring-green-400/40 hover:bg-green-500/25 disabled:opacity-50"
                >
                  {memberLoading ? "Mengecek..." : "Lanjut"}
                </button>
              </>
            )}

            {memberStep === 2 && (
              <>
                <label className="mt-5 block text-sm text-white/70">Nama asli</label>
                <input
                  className="mt-2 w-full rounded-xl bg-black/40 px-4 py-3 ring-1 ring-white/10 outline-none focus:ring-green-400/40"
                  value={realName}
                  onChange={(e) => setRealName(e.target.value)}
                  placeholder="Contoh: Jansen..."
                />

                <label className="mt-4 block text-sm text-white/70">Kelas</label>
                <input
                  className="mt-2 w-full rounded-xl bg-black/40 px-4 py-3 ring-1 ring-white/10 outline-none focus:ring-green-400/40"
                  value={kelas}
                  onChange={(e) => setKelas(e.target.value)}
                  placeholder="Contoh: 9g"
                />

                {memberMsg && (
                  <div className="mt-4 rounded-xl bg-red-500/10 p-3 text-sm text-red-200 ring-1 ring-red-400/30">
                    {memberMsg}
                  </div>
                )}

                <button
                  onClick={() => {
                    if (!realName.trim() || !kelas.trim()) {
                      setMemberMsg("Nama asli dan kelas wajib diisi");
                      return;
                    }
                    submitMember();
                  }}
                  disabled={memberLoading}
                  className="mt-6 w-full rounded-2xl bg-green-500/20 py-3 font-semibold ring-1 ring-green-400/40 hover:bg-green-500/25 disabled:opacity-50"
                >
                  {memberLoading ? "Memproses..." : "Konfirmasi pembayaran member"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}








