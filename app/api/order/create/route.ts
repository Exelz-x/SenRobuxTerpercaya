import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requiredGamepassPrice } from "@/lib/tax";
import { calculatePriceIdr } from "@/lib/pricing";
import { resolveRobloxUsername, findGamepassByPrice } from "@/lib/roblox";
import { generateShortCode } from "@/lib/shortCode";

const schema = z.object({
  robux: z.number().int().min(1).max(100000),
  username: z.string().min(1),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: "Input tidak valid" },
      { status: 400 }
    );
  }

  // ✅ ambil dari body, lalu validasi ulang (sesuai request)
  const robux = Number(body.robux);

  if (!Number.isFinite(robux) || robux <= 0) {
    return NextResponse.json(
      { ok: false, message: "Jumlah Robux tidak valid" },
      { status: 400 }
    );
  }

  const username = String(body.username ?? "").trim();
  if (!username) {
    return NextResponse.json(
      { ok: false, message: "Username tidak valid" },
      { status: 400 }
    );
  }

  const priceRequired = requiredGamepassPrice(robux);
  const amountIdr = calculatePriceIdr(robux);

  const resolved = await resolveRobloxUsername(username);
  if (!resolved.ok) {
    return NextResponse.json(resolved, { status: 400 });
  }

  const check = await findGamepassByPrice(resolved.userId, priceRequired);

  const gamepassId = check.ok && check.found ? check.gamepassId : null;
  const gamepassUrl = check.ok && check.found ? check.gamepassUrl : null;

  // ✅ cek stock robux (SEBELUM insert order)
  const { data: st, error: stErr } = await supabaseAdmin
    .from("stock")
    .select("robux_stock")
    .eq("id", 1)
    .single();

  if (stErr || !st) {
    return NextResponse.json(
      { ok: false, message: "Gagal cek stok" },
      { status: 500 }
    );
  }

  const stock = Number(st.robux_stock);

  // stok kosong
  if (stock <= 0) {
    return NextResponse.json(
      {
        ok: false,
        message: "Stok Robux sedang kosong. Silakan coba lagi nanti.",
      },
      { status: 400 }
    );
  }

  // stok kurang dari jumlah beli
  if (robux > stock) {
    return NextResponse.json(
      { ok: false, message: `Stok tidak cukup. Stok tersedia: ${stock} Robux.` },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("orders")
    .insert({
      roblox_username: resolved.username,
      roblox_user_id: resolved.userId,
      headshot_url: resolved.headshotUrl,
      robux_target: robux,
      gamepass_price_required: priceRequired,
      gamepass_id: gamepassId,
      gamepass_url: gamepassUrl,
      amount_idr: amountIdr, // ✅ sesuai request
      status: "CREATED",
      payment_method: "MIDTRANS",
      short_code: generateShortCode(),
    })
    .select("id, gamepass_id, gamepass_url, gamepass_price_required")
    .single();

  if (error) {
    return NextResponse.json(
      { ok: false, message: "Gagal simpan order", detail: error.message },
      { status: 500 }
    );
  }

  const next = data.gamepass_id ? `/pay?id=${data.id}` : `/create-gamepass?id=${data.id}`;

  return NextResponse.json({
    ok: true,
    orderId: data.id,
    requiredPrice: data.gamepass_price_required,
    next,
  });
}


