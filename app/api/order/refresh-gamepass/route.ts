import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { findGamepassByPrice } from "@/lib/roblox";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const orderId = body?.orderId;

  if (!orderId) {
    return NextResponse.json({ ok: false, message: "Order ID tidak ada" }, { status: 400 });
  }

  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .single();

  if (error || !order) {
    return NextResponse.json({ ok: false, message: "Order tidak ditemukan" }, { status: 404 });
  }

  if (!order.roblox_user_id || !order.gamepass_price_required) {
    return NextResponse.json({ ok: false, message: "Data order belum lengkap" }, { status: 400 });
  }

  // ✅ guard: jangan pernah overwrite gamepass kalau order sudah PAID / DONE
  const lockedStatuses = ["PAID", "WAITING_DELIVERY", "DONE", "PAID_WAIT_STOCK"];
  const currentStatus = String(order.status ?? "").toUpperCase();
  if (lockedStatuses.includes(currentStatus)) {
    return NextResponse.json(
      {
        ok: false,
        message: "Order sudah dibayar / diproses. Tidak boleh refresh gamepass lagi.",
      },
      { status: 400 }
    );
  }

  // 🔍 cek gamepass
  const result = await findGamepassByPrice(order.roblox_user_id, order.gamepass_price_required);

  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.message }, { status: 500 });
  }

  if (!result.found) {
    return NextResponse.json({
      ok: true,
      found: false,
      message: "Gamepass belum ditemukan",
    });
  }

  // ✅ FIX PENTING: jangan pakai status WAITING_PAYMENT
  // Jangan overwrite status kalau sudah PENDING_PAYMENT / PAID, dll.
  const safeNextStatus =
    currentStatus === "CREATE_GAMEPASS" || currentStatus === "WAITING_GAMEPASS"
      ? "PENDING_PAYMENT"
      : order.status;

  // ✅ update order kalau ketemu
  await supabaseAdmin
    .from("orders")
    .update({
      gamepass_id: result.gamepassId,
      gamepass_url: result.gamepassUrl,
      status: safeNextStatus,
    })
    .eq("id", orderId);

  return NextResponse.json({
    ok: true,
    found: true,
    gamepassId: result.gamepassId,
    gamepassUrl: result.gamepassUrl,
    next: `/pay?id=${orderId}`,
  });
}

