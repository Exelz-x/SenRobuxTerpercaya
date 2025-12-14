import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { findGamepassByPrice } from "@/lib/roblox";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const orderId = body?.orderId;

  if (!orderId) {
    return NextResponse.json(
      { ok: false, message: "Order ID tidak ada" },
      { status: 400 }
    );
  }

  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .single();

  if (error || !order) {
    return NextResponse.json(
      { ok: false, message: "Order tidak ditemukan" },
      { status: 404 }
    );
  }

  if (!order.roblox_user_id || !order.gamepass_price_required) {
    return NextResponse.json(
      { ok: false, message: "Data order belum lengkap" },
      { status: 400 }
    );
  }

  // 🔍 cek gamepass pakai endpoint yang kamu kasih
  const result = await findGamepassByPrice(
    order.roblox_user_id,
    order.gamepass_price_required
  );

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, message: result.message },
      { status: 500 }
    );
  }

  if (!result.found) {
    return NextResponse.json({
      ok: true,
      found: false,
      message: "Gamepass belum ditemukan",
    });
  }

  // ✅ update order kalau ketemu
  await supabaseAdmin
    .from("orders")
    .update({
      gamepass_id: result.gamepassId,
      gamepass_url: result.gamepassUrl,
      status: "WAITING_PAYMENT",
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
