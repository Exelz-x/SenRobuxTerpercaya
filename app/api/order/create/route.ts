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

  // opsional untuk MEMBER
  payment_method: z.string().optional(), // "MIDTRANS" | "MEMBER"
  member_name: z.any().optional(),
  member_class: z.any().optional(),
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
  // 2) BODY + payment_method
  // =========================
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Input tidak valid" }, { status: 400 });
  }

  const paymentMethod = String(body?.payment_method ?? "MIDTRANS").toUpperCase();
  const paymentChannel = paymentMethod === "MEMBER" ? "MEMBER" : "MIDTRANS";

  // =========================
  // 3) LIMIT PENDING (<= 3)
  //    + AUTO CANCEL MEMBER EXPIRED
  // =========================
  const nowIso = new Date().toISOString();

  // 3A) auto-cancel order MEMBER yang lewat 48 jam
  await supabaseAdmin
    .from("orders")
    .update({ status: "CANCELLED" })
    .eq("buyer_key", buyerKey)
    .eq("payment_channel", "MEMBER")
    .eq("status", "PENDING_PAYMENT")
    .lte("member_expires_at", nowIso);

  // 3B) hitung pending MIDTRANS yang belum expired
  const { count: midPending, error: midErr } = await supabaseAdmin
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("buyer_key", buyerKey)
    .eq("payment_channel", "MIDTRANS")
    .eq("status", "PENDING_PAYMENT")
    .gt("expires_at", nowIso);

  if (midErr) {
    return NextResponse.json({ ok: false, message: midErr.message }, { status: 500 });
  }

  // 3C) hitung pending MEMBER yang belum lewat 48 jam
  const { count: memPending, error: memErr } = await supabaseAdmin
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("buyer_key", buyerKey)
    .eq("payment_channel", "MEMBER")
    .eq("status", "PENDING_PAYMENT")
    .gt("member_expires_at", nowIso);

  if (memErr) {
    return NextResponse.json({ ok: false, message: memErr.message }, { status: 500 });
  }

  // ✅ Batas 3 pending MIDTRANS
  if ((midPending ?? 0) >= 3) {
    return NextResponse.json(
      {
        ok: false,
        message: "Kamu punya 3 pesanan yang belum dibayar. Selesaikan dulu sebelum buat pesanan lagi.",
      },
      { status: 429 }
    );
  }

  // ✅ Batas 3 pending MEMBER (menunggu dibayar/menunggu admin set PAID)
  if ((memPending ?? 0) >= 3) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Kamu punya 3 pesanan yang belum dibayar. Selesaikan dulu sebelum buat pesanan lagi.",
      },
      { status: 429 }
    );
  }

  // =========================
  // 4) VALIDASI INPUT UTAMA
  // =========================
  const robux = Number(body.robux);
  if (!Number.isFinite(robux) || robux <= 0) {
    return NextResponse.json({ ok: false, message: "Jumlah Robux tidak valid" }, { status: 400 });
  }

  const username = String(body.username ?? "").trim();
  if (!username) {
    return NextResponse.json({ ok: false, message: "Username tidak valid" }, { status: 400 });
  }

  // =========================
  // 5) HITUNG HARGA + RESOLVE ROBLOX
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
  // 6) CEK STOCK (SEBELUM INSERT)
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
  // 7) EXPIRES (MIDTRANS / MEMBER)
  // =========================
  const EXPIRE_MINUTES = Number(process.env.MIDTRANS_EXPIRE_MINUTES ?? "15");
  const expiresAt = new Date(Date.now() + EXPIRE_MINUTES * 60 * 1000).toISOString();
  const memberExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

  // =========================
  // 8) INSERT ORDER
  // =========================
  const insertPayload: Record<string, any> = {
    buyer_key: buyerKey,

    roblox_username: resolved.username,
    roblox_user_id: resolved.userId,
    headshot_url: resolved.headshotUrl,
    robux_target: robux,
    gamepass_price_required: priceRequired,
    gamepass_id: gamepassId,
    gamepass_url: gamepassUrl,
    amount_idr: amountIdr,
    short_code: generateShortCode(),

    payment_method: paymentMethod,
  };

  if (paymentChannel === "MIDTRANS") {
    insertPayload.payment_channel = "MIDTRANS";
    insertPayload.status = "PENDING_PAYMENT";
    insertPayload.expires_at = expiresAt;
    insertPayload.member_expires_at = null;
    insertPayload.member_name = null;
    insertPayload.member_class = null;
  } else {
    insertPayload.payment_channel = "MEMBER";
    insertPayload.status = "PENDING_PAYMENT"; // ✅ tetap pending (admin yang set PAID nanti)
    insertPayload.member_name = body?.member_name ?? null;
    insertPayload.member_class = body?.member_class ?? null;
    insertPayload.member_expires_at = memberExpiresAt;
    insertPayload.expires_at = null;
  }

  const { data, error } = await supabaseAdmin
    .from("orders")
    .insert(insertPayload)
    .select("id, gamepass_id, gamepass_url, gamepass_price_required, payment_channel")
    .single();

  if (error || !data) {
    return NextResponse.json({ ok: false, message: "Gagal simpan order", detail: error?.message }, { status: 500 });
  }

  const next =
    data.payment_channel === "MEMBER"
      ? `/member-instructions?id=${data.id}`
      : data.gamepass_id
      ? `/pay?id=${data.id}`
      : `/create-gamepass?id=${data.id}`;

  // =========================
  // 9) RESPONSE + SET COOKIE
  // =========================
  const res = NextResponse.json({
    ok: true,
    orderId: data.id,
    requiredPrice: data.gamepass_price_required,
    next,
    paymentChannel: data.payment_channel,
  });

  if (needSetCookie) {
    res.cookies.set("buyer_key", buyerKey, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  return res;
}












