import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const schema = z.object({
  orderId: z.string().min(1),
  memberCode: z.string().min(1),
  name: z.string().min(2).max(80),
  kelas: z.string().min(1).max(10), // contoh 9g
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Input tidak valid" }, { status: 400 });
  }

  const { orderId, memberCode, name, kelas } = parsed.data;

  const correct = process.env.MEMBER_CODE!;
  if (memberCode !== correct) {
    return NextResponse.json({ ok: false, message: "Kode member salah" }, { status: 401 });
  }

  // update order: method MEMBER, isi nama/kelas, status tetap belum dibayar
  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .update({
      payment_method: "MEMBER",
      member_name: name,
      member_class: kelas,
      member_verified_at: new Date().toISOString(),
      // status tetap "PENDING_PAYMENT" / "CREATED" (belum dibayar)
      status: "PENDING_PAYMENT",
    })
    .eq("id", orderId)
    .select("id, short_code")
    .single();

  if (error || !order) {
    return NextResponse.json({ ok: false, message: "Gagal update order" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    next: `/member-complete?id=${orderId}`,
  });
}
