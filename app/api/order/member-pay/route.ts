import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const schema = z.object({
  orderId: z.string().min(1),
  memberCode: z.string().min(1),

  // dukung 2 versi field biar kompatibel
  name: z.string().optional(),
  kelas: z.string().optional(),
  member_name: z.string().optional(),
  member_class: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Input tidak valid" }, { status: 400 });
  }

  const orderId = String(body.orderId ?? "").trim();

  // ✅ NORMALISASI CODE: trim + uppercase
  const memberCodeRaw = String(body.memberCode ?? "").trim();
  const memberCode = memberCodeRaw.toUpperCase();

  const memberName = String(body.member_name ?? body.name ?? "").trim();
  const memberClass = String(body.member_class ?? body.kelas ?? "").trim();

  if (!orderId || !memberCode || !memberName || !memberClass) {
    return NextResponse.json(
      { ok: false, message: "Input tidak valid (orderId/kode/nama/kelas wajib diisi)" },
      { status: 400 }
    );
  }

  // 1) Ambil order
  const { data: order, error: oErr } = await supabaseAdmin
    .from("orders")
    .select(
      "id, status, payment_channel, midtrans_order_id, midtrans_transaction_status, expires_at"
    )
    .eq("id", orderId)
    .single();

  if (oErr || !order) {
    return NextResponse.json({ ok: false, message: "Order tidak ditemukan" }, { status: 404 });
  }

  const statusNow = String(order.status ?? "");
  const paidLike = ["PAID", "WAITING_DELIVERY", "DONE", "PAID_WAIT_STOCK"];

  if (paidLike.includes(statusNow)) {
    return NextResponse.json(
      { ok: false, message: "Order sudah dibayar / diproses." },
      { status: 400 }
    );
  }

  // 2) Verifikasi kode member (case-insensitive)
  // ✅ tabel: member_codes, kolom: code, is_active
  // Kalau di DB kamu kolomnya beda, ganti di sini.
  const { data: codeRow, error: cErr } = await supabaseAdmin
    .from("member_codes")
    .select("code, is_active")
    // ilike biar gak peka huruf besar/kecil
    .ilike("code", memberCode)
    .single();

  // Kalau error karena "Row not found" supabase biasanya masuk error juga,
  // jadi kita treat sama: dianggap tidak valid.
  if (cErr || !codeRow) {
    return NextResponse.json({ ok: false, message: "Kode member salah" }, { status: 400 });
  }

  // is_active boleh null/true -> dianggap aktif
  if (codeRow.is_active === false) {
    return NextResponse.json({ ok: false, message: "Kode member sudah tidak aktif" }, { status: 400 });
  }

  // 3) Switch order -> MEMBER (48 jam)
  const memberExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

  const { error: upErr } = await supabaseAdmin
    .from("orders")
    .update({
      payment_channel: "MEMBER",
      payment_method: "MEMBER",
      status: "PENDING_PAYMENT",

      member_name: memberName,
      member_class: memberClass,
      member_expires_at: memberExpiresAt,

      // member tidak pakai expiry midtrans
      expires_at: null,

      // reset midtrans field biar tidak nyangkut
      midtrans_order_id: null,
      midtrans_transaction_status: null,
      midtrans_snap_token: null,
      midtrans_snap_redirect_url: null,
    })
    .eq("id", orderId);

  if (upErr) {
    return NextResponse.json({ ok: false, message: upErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    next: `/member-instructions?id=${orderId}`,
  });
}



