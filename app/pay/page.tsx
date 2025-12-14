"use client";

import { useEffect, useState } from "react";

declare global {
  interface Window {
    snap?: {
      pay: (token: string, options?: any) => void;
    };
  }
}

export default function PayPage() {
  const [orderId, setOrderId] = useState("");
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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id") ?? "";
    setOrderId(id);

    // simpan order ke localStorage biar muncul di /orders
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
          json.detail
            ? `${json.message}: ${json.detail}`
            : json.message ?? "Gagal membuat transaksi Midtrans"
        );
        return;
      }

      if (!window.snap?.pay) {
        setMsg("Snap.js belum ter-load. Coba refresh halaman.");
        return;
      }

      window.snap.pay(json.token, {
        onSuccess: async function () {
          // paksa sinkron status ke server dulu (biar gak nunggu webhook)
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

      // ✅ kalau benar baru lanjut step 2
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
          name: realName.trim(),
          kelas: kelas.trim(),
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

          <div className="mt-6 rounded-2xl bg-black/30 p-4 ring-1 ring-white/10">
            <div className="text-sm text-white/70">Order ID</div>
            <div className="font-mono break-all">{orderId || "-"}</div>
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
                    verifyMemberCode(); // ✅ cek server dulu
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






