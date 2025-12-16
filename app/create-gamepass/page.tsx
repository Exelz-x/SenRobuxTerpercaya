"use client";

import { useEffect, useMemo, useState } from "react";
import { requiredGamepassPrice } from "@/lib/tax";

type ResolveResp =
  | { ok: true; userId: number; username: string; headshotUrl: string }
  | { ok: false; message: string };

type GamepassCheckResp =
  | { ok: true; found: boolean; gamepassId?: number; gamepassUrl?: string }
  | { ok: false; message: string };

export default function CreateGamepassPage() {
  const [usernameQ, setUsernameQ] = useState<string>("");
  const [robuxQ, setRobuxQ] = useState<number>(0);

  const [resolved, setResolved] = useState<ResolveResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState("");

  // 1) ambil query username & robux dari URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const u = String(params.get("username") ?? "").trim();
    const rRaw = String(params.get("robux") ?? "").trim();
    const r = Number(rRaw);

    setUsernameQ(u);
    setRobuxQ(Number.isFinite(r) ? r : 0);
  }, []);

  // 2) hitung requiredPrice dari robux
  const requiredPrice = useMemo(() => {
    const r = Math.max(1, Math.min(100000, Number(robuxQ || 0)));
    return requiredGamepassPrice(r);
  }, [robuxQ]);

  // 3) resolve username -> userId + headshot
  useEffect(() => {
    (async () => {
      setMessage("");

      if (!usernameQ || !robuxQ || robuxQ <= 0) {
        setResolved(null);
        setLoading(false);
        setMessage("Query tidak valid. Pastikan URL berisi username & robux.");
        return;
      }

      setLoading(true);
      try {
        const res = await fetch("/api/roblox/resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: usernameQ }),
        });

        const json = (await res.json().catch(() => null)) as ResolveResp | null;

        if (!res.ok || !json) {
          setResolved(null);
          setMessage("Gagal resolve username Roblox.");
          setLoading(false);
          return;
        }

        setResolved(json);
        if (!json.ok) setMessage(json.message);
      } catch {
        setResolved(null);
        setMessage("Terjadi error jaringan/server saat resolve username.");
      } finally {
        setLoading(false);
      }
    })();
  }, [usernameQ, robuxQ]);

  // 4) tombol "Sudah membuat gamepass" -> call /api/gamepass/check
async function checkGamepassAgain() {
  setMessage("");

  if (!resolved?.ok) {
    setMessage("Username belum valid / belum ter-resolve.");
    return;
  }

  setChecking(true);
  try {
    const res = await fetch("/api/gamepass/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: resolved.userId,
        requiredPrice,
      }),
    });

    const json = (await res.json().catch(() => null)) as GamepassCheckResp | null;

    if (!res.ok || !json) {
      setMessage("Gagal mengecek gamepass");
      return;
    }

    if (json.ok === false) {
      setMessage(json.message ?? "Gagal mengecek gamepass");
      return;
    }

    if (!json.found) {
      setMessage(
        "❌ Gamepass belum ditemukan. Pastikan harga gamepass sudah sesuai dan ENABLE REGIONAL PRICING Pastikan MATI."
      );
      return;
    }

    const u = encodeURIComponent(resolved.username);
    const r = encodeURIComponent(String(robuxQ));
    const uid = encodeURIComponent(String(resolved.userId));
    window.location.href = `/checkout?username=${u}&robux=${r}&userId=${uid}`;
  } catch {
    setMessage("Terjadi error jaringan/server saat mengecek gamepass.");
  } finally {
    setChecking(false);
  }
}

  if (loading) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        Memuat data...
      </main>
    );
  }

  if (!usernameQ || !robuxQ || robuxQ <= 0) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        Query tidak valid
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
              {resolved?.ok && resolved.headshotUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={resolved.headshotUrl}
                  alt="Avatar Roblox"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-white/50 text-xl">👤</span>
              )}
            </div>

            <div>
              <div className="text-sm text-white/70">Username Roblox</div>
              <div className="text-lg font-semibold">
                {resolved?.ok ? resolved.username : usernameQ}
              </div>
            </div>
          </div>

          {/* INFO */}
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-2xl bg-black/30 p-4 ring-1 ring-white/10">
              <div className="text-sm text-white/70">Jumlah Robux Dibeli</div>
              <div className="mt-1 text-xl font-bold text-green-300">
                {Number(robuxQ).toLocaleString("id-ID")} Robux
              </div>
            </div>

            <div className="rounded-2xl bg-black/30 p-4 ring-1 ring-white/10">
              <div className="text-sm text-white/70">Harga Game Pass Wajib</div>
              <div className="mt-1 text-xl font-bold text-green-400">
                {Number(requiredPrice).toLocaleString("id-ID")} Robux
              </div>
            </div>
          </div>

          {/* INSTRUCTION */}
          <div className="mt-6 rounded-2xl bg-green-500/10 p-4 ring-1 ring-green-400/40">
            <p className="text-sm leading-relaxed text-green-200">
              ⚠️ <strong>Perhatian:</strong>
              <br />
              Silakan buat <strong>Game Pass</strong> di Roblox dengan harga
              <strong className="text-green-300">
                {" "}
                {Number(requiredPrice).toLocaleString("id-ID")} Robux
              </strong>
              .
              <br />
              Harga ini sudah disesuaikan dengan pajak Roblox sebesar 30%.
            </p>
          </div>

          {/* VIDEO */}
          <div className="mt-6 overflow-hidden rounded-2xl ring-1 ring-white/10">
            <div className="aspect-video bg-black">
              <iframe
                src="https://www.youtube.com/embed/iPJ061OOtGU"
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
              disabled={checking || !resolved?.ok}
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



