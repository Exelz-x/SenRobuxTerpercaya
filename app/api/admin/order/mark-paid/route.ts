import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  const jar = await cookies();
  const token = jar.get("admin_session")?.value;
  const payload = token ? verifyToken(token) : null;

  if (!payload || payload.role !== "admin") {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const id = String(body?.id ?? "");
  if (!id) return NextResponse.json({ ok: false, message: "id kosong" }, { status: 400 });

  // ambil order
  const { data: order, error: oErr } = await supabaseAdmin
    .from("orders")
    .select("id, robux_target, stock_deducted")
    .eq("id", id)
    .single();

  if (oErr || !order) {
    return NextResponse.json({ ok: false, message: "Order tidak ditemukan" }, { status: 404 });
  }

  if (!order.stock_deducted) {
    const amount = Number(order.robux_target);

    const { data: okDeduct, error: dErr } = await supabaseAdmin.rpc("decrement_stock", {
      p_amount: amount,
    });

    if (!dErr && okDeduct === true) {
      const { error } = await supabaseAdmin
        .from("orders")
        .update({
          status: "PAID",
          stock_deducted: true,
        })
        .eq("id", id);

      if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    // stok kurang
    await supabaseAdmin
      .from("orders")
      .update({
        status: "PAID_WAIT_STOCK",
      })
      .eq("id", id);

    return NextResponse.json(
      { ok: false, message: "Stok tidak cukup. Order masuk PAID_WAIT_STOCK." },
      { status: 409 }
    );
  }

  // sudah pernah dipotong
  await supabaseAdmin.from("orders").update({ status: "PAID" }).eq("id", id);
  return NextResponse.json({ ok: true });
}



