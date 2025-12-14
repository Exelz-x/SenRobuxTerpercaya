import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requiredGamepassPrice } from "@/lib/tax";
import { calculatePriceIdr } from "@/lib/pricing";
import { resolveRobloxUsername, findGamepassByPrice } from "@/lib/roblox";
import { generateShortCode } from "@/lib/shortCode";

export const runtime = "nodejs";

const schema = z.object({
  robux: z.number().int().min(1).max(100000),
  username: z.string().min(1),
});

export async function POST(req: NextRequest) {
  // =========================
  // 1) BUYER KEY (COOKIE)
  // =========================
  let buyerKey = req.cookies.get("buyer_key")?.value;
  let needSetCookie = false;

  if (!buyerKey) {
    buyerKey = crypto.randomUUID();
    needSetCookie = true;
  }

  // =========================
  // 2) BATASI PENDING (<= 3)
  // =========================
  const nowIso = new Date().toISOString();
  const { count, error: cErr } = await supabaseAdmin
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("buyer_key", buyerKey)
    .eq("status", "PENDING_PAYMENT")
    .gt("expires_at", nowIso);

  if (cErr) {
    return NextResponse.json({ ok: false, message: cErr.message }, { status: 500 });
  }

  if ((count ?? 0) >= 3) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Kamu punya 3 pesanan yang belum dibayar. Selesaikan pembayaran dulu sebelum checkout lagi.",
      },
      { status: 429 }
    );
  }

  // =========================
  // 3) VALIDASI INPUT
  // =========================
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Input tidak valid" }, { status: 400 });
  }

  // ✅ ambil dari body, lalu validasi ulang (sesuai request)
  const robux = Number(body.robux);
  if (!Number.isFinite(robux) || robux <= 0) {
    return NextResponse.json({ ok: false, message: "Jumlah Robux tidak valid" }, { status: 400 });
  }

  const username = String(body.username ?? "").trim();
  if (!username) {
    return NextResponse.json({ ok: false, message: "Username tidak valid" }, { status: 400 });
  }

  // =========================
  // 4) HITUNG HARGA + RESOLVE ROBLOX
  // =========================
  const priceRequired = requiredGamepassPrice(robux);
  const amountIdr = calculatePriceIdr(robux);

  const resolved = await resolveRobloxUsername(username);
  if (!resolved.ok) {
    return NextResponse.json(resolved, { status: 400 });
  }

  const check = await findGamepassByPrice(resolved.userId, priceRequired);
  const gamepassId = check.ok && check.found ? check.gamepassId : null;
  const gamepassUrl = check.ok && check.found ? check.gamepassUrl : null;

  // =========================
  // 5) CEK STOCK (SEBELUM INSERT)
  // =========================
  const { data: st, error: stErr } = await supabaseAdmin
    .from("stock")
    .select("robux_stock")
    .eq("id", 1)
    .single();

  if (stErr || !st) {
    return NextResponse.json({ ok: false, message: "Gagal cek stok" }, { status: 500 });
  }

  const stock = Number(st.robux_stock);

  if (stock <= 0) {
    return NextResponse.json(
      { ok: false, message: "Stok Robux sedang kosong. Silakan coba lagi nanti." },
      { status: 400 }
    );
  }

  if (robux > stock) {
    return NextResponse.json(
      { ok: false, message: `Stok tidak cukup. Stok tersedia: ${stock} Robux.` },
      { status: 400 }
    );
  }

  // =========================
  // 6) expires_at (PENDING_PAYMENT)
  // =========================
  const EXPIRE_MINUTES = Number(process.env.MIDTRANS_EXPIRE_MINUTES ?? "15");
  const expiresAt = new Date(Date.now() + EXPIRE_MINUTES * 60 * 1000).toISOString();

  // =========================
  // 7) INSERT ORDER (buyer_key + expires_at)
  // =========================
  const { data, error } = await supabaseAdmin
    .from("orders")
    .insert({
      buyer_key: buyerKey,
      status: "PENDING_PAYMENT",
      expires_at: expiresAt,

      roblox_username: resolved.username,
      roblox_user_id: resolved.userId,
      headshot_url: resolved.headshotUrl,
      robux_target: robux,
      gamepass_price_required: priceRequired,
      gamepass_id: gamepassId,
      gamepass_url: gamepassUrl,
      amount_idr: amountIdr,
      payment_method: "MIDTRANS",
      short_code: generateShortCode(),
    })
    .select("id, gamepass_id, gamepass_url, gamepass_price_required")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { ok: false, message: "Gagal simpan order", detail: error?.message },
      { status: 500 }
    );
  }

  const next = data.gamepass_id ? `/pay?id=${data.id}` : `/create-gamepass?id=${data.id}`;

  // =========================
  // 8) RESPONSE + SET COOKIE (JIKA BARU)
  // =========================
  const res = NextResponse.json({
    ok: true,
    orderId: data.id,
    requiredPrice: data.gamepass_price_required,
    next,
  });

  if (needSetCookie) {
    res.cookies.set("buyer_key", buyerKey, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production", // localhost aman
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  return res;
}










