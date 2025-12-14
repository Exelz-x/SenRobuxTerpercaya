import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get("id");

  if (!orderId) {
    return NextResponse.json(
      { ok: false, message: "Order ID tidak ada" },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .single();

  if (error || !data) {
    return NextResponse.json(
      { ok: false, message: "Order tidak ditemukan" },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true, order: data });
}
