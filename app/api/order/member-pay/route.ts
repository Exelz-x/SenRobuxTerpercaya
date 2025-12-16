import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const schema = z.object({
  orderId: z.string().min(1),

  // masih terima memberCode dari frontend, tapi kita tidak validasi ke tabel lagi
  memberCode: z.string().optional(),

  // dukung 2 versi field
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
  const memberName = String(body.member_name ?? body.name ?? "").trim();
  const memberClass = String(body.member_class ?? body.kelas ?? "").trim();

  if (!orderId || !memberName || !memberClass) {
    return NextResponse.json({ ok: false, message: "Input tidak valid" }, { status: 400 });
  }

  // 1) Ambil order + pastikan kode sudah diverifikasi di step 1
  const { data: order, error: oErr } = await supabaseAdmin
    .from("orders")
    .select("id, status, member_code")
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

  // ✅ KUNCI: kalau belum pernah verifikasi kode, stop di sini
  if (!order.member_code) {
    return NextResponse.json(
      { ok: false, message: "Kode member belum diverifikasi. Ulangi dari langkah kode member." },
      { status: 400 }
    );
  }

  // 2) Set order jadi MEMBER + isi data
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

      // reset midtrans fields biar tidak nyangkut
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



