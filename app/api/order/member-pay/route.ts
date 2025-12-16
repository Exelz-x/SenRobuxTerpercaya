import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const schema = z.object({
  orderId: z.string().min(1),
  member_name: z.string().min(1),
  member_class: z.string().min(1),
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

  const { orderId, member_name, member_class } = parsed.data;

  // 1) ambil order
  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .select("id, status")
    .eq("id", orderId)
    .single();

  if (error || !order) {
    return NextResponse.json(
      { ok: false, message: "Order tidak ditemukan" },
      { status: 404 }
    );
  }

  // 2) cegah kalau sudah dibayar
  const locked = ["PAID", "WAITING_DELIVERY", "DONE", "PAID_WAIT_STOCK"];
  if (locked.includes(String(order.status))) {
    return NextResponse.json(
      { ok: false, message: "Order sudah dibayar / diproses." },
      { status: 400 }
    );
  }

  // 3) set sebagai pembayaran MEMBER
  const { error: updateErr } = await supabaseAdmin
    .from("orders")
    .update({
      payment_channel: "MEMBER",
      payment_method: "MEMBER",
      status: "PENDING_PAYMENT",

      member_name,
      member_class,

      member_expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      expires_at: null,

      paid_at: null,
    })
    .eq("id", orderId);

  if (updateErr) {
    return NextResponse.json(
      { ok: false, message: updateErr.message },
      { status: 500 }
    );
  }

  // ✅ redirect ke halaman YANG ADA
  return NextResponse.json({
    ok: true,
    next: `/order-complete?id=${orderId}`,
  });
}






