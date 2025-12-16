import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const schema = z.object({
  orderId: z.string().min(1),
  memberCode: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Input tidak valid" }, { status: 400 });
  }

  const orderId = String(body.orderId).trim();
  const memberCode = String(body.memberCode).trim();

  // 1) pastikan order ada
  const { data: order, error: oErr } = await supabaseAdmin
    .from("orders")
    .select("id, status")
    .eq("id", orderId)
    .single();

  if (oErr || !order) {
    return NextResponse.json({ ok: false, message: "Order tidak ditemukan" }, { status: 404 });
  }

  const paidLike = ["PAID", "WAITING_DELIVERY", "DONE", "PAID_WAIT_STOCK"];
  if (paidLike.includes(String(order.status ?? ""))) {
    return NextResponse.json({ ok: false, message: "Order sudah dibayar / diproses." }, { status: 400 });
  }

  // 2) cek kode member (DI SINI SAJA)
  // ⚠️ Sesuaikan nama tabel/kolom kamu. Ini contoh paling umum:
  const { data: codeRow, error: cErr } = await supabaseAdmin
    .from("member_codes")
    .select("code, is_active")
    .ilike("code", memberCode)
    .single();

  if (cErr || !codeRow) {
    return NextResponse.json({ ok: false, message: "Kode member salah" }, { status: 400 });
  }
  if (codeRow.is_active === false) {
    return NextResponse.json({ ok: false, message: "Kode member sudah tidak aktif" }, { status: 400 });
  }

  // 3) simpan kode yang sudah terverifikasi ke order (biar step 2 gak perlu cek lagi)
  const { error: upErr } = await supabaseAdmin
    .from("orders")
    .update({
      member_code: String(codeRow.code ?? memberCode),
    })
    .eq("id", orderId);

  if (upErr) {
    return NextResponse.json({ ok: false, message: upErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

