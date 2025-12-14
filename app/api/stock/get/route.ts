import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("stock")
    .select("robux_stock, updated_at")
    .eq("id", 1)
    .single();

  if (error || !data) {
    return NextResponse.json({ ok: false, message: "Gagal mengambil stok" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, stock: Number(data.robux_stock), updated_at: data.updated_at });
}
