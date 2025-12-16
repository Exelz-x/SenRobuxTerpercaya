import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

/**
 * Kita terima dua versi nama field:
 * - versi lama: name, kelas
 * - versi baru: member_name, member_class
 */
const schema = z.object({
  orderId: z.string().min(1),
  memberCode: z.string().min(1),

  // dua versi: boleh salah satu terisi
  name: z.string().optional(),
  kelas: z.string().optional(),

  member_name: z.string().optional(),
  member_class: z.string().optional(),

  payment_method: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Input tidak valid" }, { status: 400 });
  }

  const orderId = String(body.orderId ?? "").trim();
  const memberCode = String(body.memberCode ?? "").trim();

  // ambil nama & kelas dari field manapun yang ada
  const memberName = String(body.member_name ?? body.name ?? "").trim();
  const memberClass = String(body.member_class ?? body.kelas ?? "").trim();

  if (!orderId || !memberCode || !memberName || !memberClass) {
    return NextResponse.json(
      { ok: false, message: "Input tidak valid (orderId/kode/nama/kelas wajib diisi)" },
      { status: 400 }
    );
  }

  // 1) pastikan order ada
  const { data: order, error: oErr } = await supabaseAdmin
    .from("orders")
    .select("id, status, payment_channel")
    .eq("id", orderId)
    .single();

  if (oErr || !order) {
    return NextResponse.json({ ok: false, message: "Order tidak ditemukan" }, { status: 404 });
  }

  const statusNow = String(order.status ?? "");
  const channelNow = String(order.payment_channel ?? "");

  // 2) order sudah dibayar? stop
  const paidLike = ["PAID", "WAITING_DELIVERY", "DONE", "PAID_WAIT_STOCK"];
  if (paidLike.includes(statusNow)) {
    return NextResponse.json(
      { ok: false, message: "Order sudah dibayar / diproses." },
      { status: 400 }
    );
  }

  // 3) kalau payment_channel sudah MIDTRANS, jangan izinkan member-pay nabrak
  if (channelNow && channelNow !== "MEMBER") {
    return NextResponse.json(
      { ok: false, message: "Order ini bukan pembayaran MEMBER." },
      { status: 400 }
    );
  }

  // 4) verifikasi kode member (contoh: cek tabel member_codes / member)
  //    Sesuaikan nama tabel/kolom kamu di sini.
  const { data: codeRow, error: cErr } = await supabaseAdmin
    .from("member_codes")
    .select("code, is_active")
    .eq("code", memberCode)
    .single();

  if (cErr || !codeRow || codeRow.is_active === false) {
    return NextResponse.json({ ok: false, message: "Kode member salah" }, { status: 400 });
  }

  // 5) update order jadi MEMBER pending (atau tetap pending) + simpan data member
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

      // member tidak pakai midtrans expiry
      expires_at: null,
    })
    .eq("id", orderId);

  if (upErr) {
    return NextResponse.json({ ok: false, message: upErr.message }, { status: 500 });
  }

  // arahkan ke halaman instruksi member / status order
  return NextResponse.json({
    ok: true,
    next: `/member-instructions?id=${orderId}`,
  });
}

