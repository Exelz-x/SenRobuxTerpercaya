import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

// Terima dua versi nama field (biar aman):
// - lama: name, kelas
// - baru: member_name, member_class
const schema = z.object({
  orderId: z.string().min(1),
  memberCode: z.string().min(1),

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
  const memberCode = String(body.memberCode ?? "").trim();

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

  // 2) Kalau sudah dibayar/selesai -> stop
  if (paidLike.includes(statusNow)) {
    return NextResponse.json(
      { ok: false, message: "Order sudah dibayar / diproses." },
      { status: 400 }
    );
  }

  // 3) (Opsional tapi disarankan) Kalau Midtrans sudah benar-benar jalan dan belum expired,
  //    kamu bisa pilih mau blok switch. Aku bikin "soft guard":
  //    - Kalau sudah punya midtrans_order_id + status pending, boleh switch (kita reset midtrans field).
  //    - Kalau kamu mau blok, ganti logic ini jadi return error.
  // (Jadi versi ini: SWITCH DIBOLEHKAN)

  // 4) Verifikasi kode member
  // SESUAIKAN nama tabel/kolom kamu bila beda.
  const { data: codeRow, error: cErr } = await supabaseAdmin
    .from("member_codes")
    .select("code, is_active")
    .eq("code", memberCode)
    .single();

  if (cErr || !codeRow || codeRow.is_active === false) {
    return NextResponse.json({ ok: false, message: "Kode member salah" }, { status: 400 });
  }

  // 5) Switch order -> MEMBER (48 jam)
  const memberExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

  // Reset midtrans fields biar tidak nyangkut (ini penting!)
  const { error: upErr } = await supabaseAdmin
    .from("orders")
    .update({
      payment_channel: "MEMBER",
      payment_method: "MEMBER",
      status: "PENDING_PAYMENT",

      member_name: memberName,
      member_class: memberClass,
      member_expires_at: memberExpiresAt,

      // member tidak pakai midtrans expiry
      expires_at: null,

      // reset midtrans biar aman
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


