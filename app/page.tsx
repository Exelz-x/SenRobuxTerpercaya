"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type ResolveResp =
  | { ok: true; userId: number; username: string; headshotUrl: string }
  | { ok: false; message: string };

export default function HomePage() {
  const [robux, setRobux] = useState<number>(100);
  const [customRobux, setCustomRobux] = useState<string>("100");
  const [username, setUsername] = useState("");
  const [resolved, setResolved] = useState<ResolveResp | null>(null);
  const [loadingResolve, setLoadingResolve] = useState(false);
  const [error, setError] = useState<string>("");

  // ✅ stok state
  const [stock, setStock] = useState<number | null>(null);
  const [stockLabel, setStockLabel] = useState<string>("...");

  const debounceRef = useRef<any>(null);

  // ✅ Patokan: 100 Robux = 12.000 => 1 Robux = 120
  const PRICE_PER_ROBUX = 120;

  // ====== Harga Editable State ======
  const [editingPrice, setEditingPrice] = useState(false);
  const [priceInput, setPriceInput] = useState<string>(""); // angka saja (misal "10000")
  const priceInputRef = useRef<HTMLInputElement | null>(null);

  // ✅ paket robux (bebas kamu ubah)
  const packages = [100, 200, 500, 1000, 2000, 5000];

  function calculatePriceIdr(r: number) {
    // patokan langsung
    return Math.max(0, Math.floor(Number(r) * PRICE_PER_ROBUX));
  }

  const priceIdr = useMemo(() => calculatePriceIdr(robux), [robux]);

  function formatStock(n: number) {
    if (n > 10000) return "10k+";
    if (n > 5000) return "5k+";
    return n.toLocaleString("id-ID");
  }

  // ✅ load stok saat halaman dibuka
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/stock/get");
        const json = await res.json().catch(() => ({}));
        if (res.ok && json.ok) {
          const s = Number(json.stock);
          setStock(s);
          setStockLabel(formatStock(s));
        } else {
          setStock(null);
          setStockLabel("—");
        }
      } catch {
        setStock(null);
        setStockLabel("—");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function clampRobux(n: number) {
    return Math.max(1, Math.min(100000, n));
  }

  function clampPrice(n: number) {
    return Math.max(0, Math.min(12000000000, n));
  }

  // ✅ sinkron robux + input custom
  function setRobuxSynced(n: number) {
    const r = clampRobux(n);
    setRobux(r);
    setCustomRobux(String(r));
  }

  function onCustomRobuxChange(v: string) {
    const cleaned = v.replace(/[^\d]/g, "");
    setCustomRobux(cleaned);

    // kalau kosong, jangan ubah robux (biar user bisa hapus & ketik ulang)
    if (!cleaned) return;

    const n = parseInt(cleaned, 10);
    if (Number.isFinite(n)) {
      const clamped = clampRobux(n);
      setRobux(clamped);
      // jangan setCustomRobux(String(clamped)) biar caret tidak loncat-loncat
      setEditingPrice(false);
      setPriceInput("");
    }
  }

  // ====== Price -> Robux Sync ======
  function commitPriceToRobux() {
    const raw = (priceInput || "").replace(/[^\d]/g, "");
    const n = parseInt(raw || "0", 10);
    const price = clampPrice(Number.isFinite(n) ? n : 0);

    // hitung robux dari harga (dibulatkan ke bawah)
    const r = clampRobux(Math.floor(price / PRICE_PER_ROBUX));

    setRobux(r);
    setCustomRobux(String(r));
    setEditingPrice(false);
  }

  async function resolveNow(u: string) {
    const name = u.trim();
    if (!name) {
      setResolved(null);
      setError("");
      return;
    }
    setLoadingResolve(true);
    setError("");

    const res = await fetch("/api/roblox/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: name }),
    });

    const json = (await res.json()) as ResolveResp;
    setResolved(json);
    if (!json.ok) setError(json.message);
    setLoadingResolve(false);
  }

  function onUsernameChange(v: string) {
    setUsername(v);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => resolveNow(v), 700);
  }

  async function createOrder() {
    setError("");

    if (stock !== null && stock <= 0) {
      setError("Stok Robux sedang kosong. Silakan coba lagi nanti.");
      return;
    }

    if (!resolved?.ok) {
      setError("Masukkan username Roblox yang valid dulu.");
      return;
    }

    const res = await fetch("/api/order/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ robux, username: resolved.username }),
    });

    const json = await res.json();
    if (!res.ok || !json.ok) {
      setError(json.message ?? "Gagal membuat pesanan");
      return;
    }

    try {
      const key = "senrobux_orders";
      const raw = localStorage.getItem(key);
      const list: string[] = raw ? JSON.parse(raw) : [];
      if (!list.includes(json.orderId)) {
        list.unshift(json.orderId);
        localStorage.setItem(key, JSON.stringify(list.slice(0, 50)));
      }
    } catch {}

    window.location.href = json.next;
  }

  const disableBuy = loadingResolve || (stock !== null && stock <= 0);

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-6xl px-4 py-10">
        {/* H1 SEO (homepage) */}
        <h1 className="sr-only">Beli Robux Murah via Gamepass – SenRobux</h1>

        {/* SEO text (hidden di mobile, tampil di md+) */}
        <section className="hidden md:block mt-3 text-sm text-white/60">
          <p>
            SenRobux adalah layanan <strong>beli robux murah</strong> melalui
            sistem<strong> gamepass</strong> yang aman dan terpercaya. 100 Robux
            hanya <strong>12 Ribu</strong> Saja.
          </p>
        </section>

        <header className="mt-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* LOGO */}
            <div className="h-16 w-16 rounded-2xl bg-green-500/30 ring-1 ring-green-400/50 flex items-center justify-center p-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/senrobux-logo.png"
                alt="SenRobux Logo"
                className="h-full w-full object-contain"
              />
            </div>

            {/* TEXT LOGO - NEON PREMIUM (RECOMMENDED) */}
            <div
              className="
                text-3xl font-extrabold tracking-wider text-green-400
                drop-shadow-[0_0_12px_rgba(34,197,94,0.9)]
              "
            >
              SenRobux
            </div>
          </div>

          <nav className="text-sm text-white/70 flex gap-6">
            <a href="/orders" className="hover:text-white">
              Pesanan Kita
            </a>
            <a href="/support" className="hover:text-white">
              Customer Service
            </a>
          </nav>
        </header>

        <section className="mt-10 rounded-3xl border border-green-500/20 bg-white/5 p-8 shadow-[0_0_50px_rgba(34,197,94,0.08)]">
          <h2 className="text-3xl font-bold">
            Top Up Robux Murah 100 Robux hanya{" "}
            <span className="text-green-400">12 Ribu</span>
          </h2>
          <p className="mt-2 text-white/70 max-w-2xl">
            Dapatkan Robux Aman & Murah Via gamepass 5 hari Di Senrobux.
          </p>
        </section>

        <section className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* LEFT */}
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="text-lg font-semibold">
              Langkah 1:{" "}
              <span className="text-green-400">Masukkan Username</span>
            </div>

            <label className="mt-4 block text-sm text-white/70">
              Username Roblox
            </label>
            <input
              className="mt-2 w-full rounded-xl bg-black/40 px-4 py-3 outline-none ring-1 ring-white/10 focus:ring-green-400/40"
              placeholder="Masukkan username Roblox..."
              value={username}
              onChange={(e) => onUsernameChange(e.target.value)}
            />

            <div className="mt-4 flex items-center gap-4 rounded-2xl bg-black/30 p-4 ring-1 ring-white/10">
              <div className="h-14 w-14 overflow-hidden rounded-full ring-2 ring-green-400/40 bg-white/5 flex items-center justify-center">
                {resolved?.ok && resolved.headshotUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={resolved.headshotUrl}
                    alt="avatar"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-white/50">👤</span>
                )}
              </div>

              <div className="flex-1">
                <div className="text-sm text-white/70">
                  {loadingResolve
                    ? "Mengecek username..."
                    : resolved?.ok
                    ? "Terdeteksi"
                    : "Belum terdeteksi"}
                </div>
                <div className="text-sm">
                  {resolved?.ok
                    ? resolved.username
                    : "Masukkan username untuk melihat avatar"}
                </div>
              </div>
            </div>

            {error && (
              <div className="mt-4 rounded-xl bg-red-500/10 p-3 text-sm text-red-200 ring-1 ring-red-400/30">
                {error}
              </div>
            )}
          </div>

          {/* RIGHT */}
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="text-lg font-semibold">
              Langkah 2: <span className="text-green-400">Pilih Robux</span>
            </div>

            {/* Stok */}
            <div className="mb-3 rounded-2xl bg-black/30 p-4 ring-1 ring-white/10">
              <div className="flex items-center justify-between">
                <div className="text-sm text-white/70">Stok Robux</div>
                <div className="font-semibold text-green-300">{stockLabel}</div>
              </div>

              {stock !== null && stock <= 0 && (
                <div className="mt-2 text-sm text-red-200">
                  Stok sedang kosong. Pembelian sementara tidak tersedia.
                </div>
              )}
            </div>

            {/* Paket */}
            <div className="mt-4 grid grid-cols-2 gap-4">
              {packages.map((r) => (
                <button
                  key={r}
                  onClick={() => {
                    setRobuxSynced(r);
                    setEditingPrice(false);
                    setPriceInput("");
                  }}
                  className={`rounded-2xl p-4 text-left ring-1 transition ${
                    robux === r
                      ? "bg-green-500/10 ring-green-400/40"
                      : "bg-black/30 ring-white/10 hover:ring-green-400/30"
                  }`}
                >
                  <div className="text-xl font-bold">
                    {r.toLocaleString("id-ID")}
                  </div>
                  <div className="text-sm text-white/70">
                    Rp {calculatePriceIdr(r).toLocaleString("id-ID")}
                  </div>
                </button>
              ))}
            </div>

            {/* Custom robux */}
            <div className="mt-4 rounded-2xl bg-black/30 p-4 ring-1 ring-white/10">
              <div className="text-sm text-white/70">Jumlah Robux Custom</div>

              <div className="mt-2 flex gap-2">
                <input
                  id="custom-robux"
                  name="custom-robux"
                  inputMode="numeric"
                  placeholder="Contoh: 125"
                  value={customRobux}
                  onChange={(e) => onCustomRobuxChange(e.target.value)}
                  className="flex-1 rounded-xl bg-black/40 px-4 py-3 ring-1 ring-white/10 outline-none focus:ring-green-400/40"
                />
              </div>

              <p className="mt-2 text-xs text-white/50">
                Isi jumlah Robux sesuai keinginan. Angka akan otomatis dipilih
                untuk checkout.
              </p>
            </div>

            {/* Harga bisa diklik/edit */}
            <div className="mt-5 rounded-2xl bg-black/30 p-4 ring-1 ring-white/10">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm text-white/70">Harga</div>

                {!editingPrice ? (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingPrice(true);
                      setPriceInput(String(priceIdr));
                      setTimeout(() => priceInputRef.current?.focus(), 0);
                    }}
                    className="text-xs rounded-xl bg-white/5 px-3 py-1 ring-1 ring-white/10 hover:ring-green-400/30 text-white/70 hover:text-white"
                    title="Klik untuk ubah harga"
                  >
                    Ubah
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingPrice(false);
                        setPriceInput("");
                      }}
                      className="text-xs rounded-xl bg-white/5 px-3 py-1 ring-1 ring-white/10 hover:ring-green-400/30 text-white/70 hover:text-white"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={commitPriceToRobux}
                      className="text-xs rounded-xl bg-green-500/20 px-3 py-1 font-semibold ring-1 ring-green-400/40 hover:bg-green-500/25"
                    >
                      Pakai
                    </button>
                  </div>
                )}
              </div>

              {!editingPrice ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingPrice(true);
                      setPriceInput(String(priceIdr));
                      setTimeout(() => priceInputRef.current?.focus(), 0);
                    }}
                    className="mt-1 text-left w-full"
                    title="Klik untuk edit harga"
                  >
                    <div className="text-2xl font-bold text-green-300">
                      Rp {priceIdr.toLocaleString("id-ID")}
                    </div>
                  </button>

                  <div className="mt-1 text-xs text-white/50">
                    Patokan: 100 Robux = Rp12.000
                  </div>
                </>
              ) : (
                <>
                  <div className="mt-2 flex gap-2">
                    <div className="flex-1">
                      <input
                        ref={priceInputRef}
                        inputMode="numeric"
                        placeholder="Contoh: 10000"
                        value={priceInput}
                        onChange={(e) =>
                          setPriceInput(e.target.value.replace(/[^\d]/g, ""))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitPriceToRobux();
                          if (e.key === "Escape") {
                            setEditingPrice(false);
                            setPriceInput("");
                          }
                        }}
                        className="w-full rounded-xl bg-black/40 px-4 py-3 ring-1 ring-white/10 outline-none focus:ring-green-400/40"
                      />
                      <div className="mt-1 text-xs text-white/50">
                        Ketik nominal Rupiah, lalu klik <b>Pakai</b>.
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={commitPriceToRobux}
                      className="rounded-xl bg-green-500/20 px-4 py-3 text-sm font-semibold ring-1 ring-green-400/40 hover:bg-green-500/25"
                    >
                      Pakai
                    </button>
                  </div>

                  <div className="mt-3 text-xs text-white/60">
                    Preview: Rp{" "}
                    {Number(priceInput || "0").toLocaleString("id-ID")} ≈{" "}
                    <b className="text-green-300">
                      {clampRobux(
                        Math.floor(
                          clampPrice(Number(priceInput || "0")) / PRICE_PER_ROBUX
                        )
                      ).toLocaleString("id-ID")}
                    </b>{" "}
                    Robux
                  </div>
                </>
              )}
            </div>

            <button
              onClick={createOrder}
              disabled={disableBuy}
              className="mt-6 w-full rounded-2xl bg-green-500/20 py-3 font-semibold ring-1 ring-green-400/40 hover:bg-green-500/25 disabled:opacity-50"
            >
              {stock !== null && stock <= 0 ? "Stok Habis" : "Beli Robux →"}
            </button>
          </div>
        </section>

        <footer className="mt-12 text-sm text-white/60">
          <div className="flex flex-wrap gap-6">
            <a href="/orders" className="hover:text-white">
              Pesanan Kita
            </a>
            <a href="/faq" className="hover:text-white">
              FAQ
            </a>
            <a href="/support" className="hover:text-white">
              Customer Service
            </a>
            <a href="/privacy" className="hover:text-white">
              Kebijakan Privasi
            </a>
          </div>
        </footer>
      </div>
    </main>
  );
}
















