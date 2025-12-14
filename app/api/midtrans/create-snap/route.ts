import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { snap } from "@/lib/midtrans";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const orderId = String(body?.orderId ?? "");

  if (!orderId) {
    return NextResponse.json({ ok: false, message: "orderId kosong" }, { status: 400 });
  }

  // 1) ambil order dari supabase
  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .single();

  if (error || !order) {
    return NextResponse.json({ ok: false, message: "Order tidak ditemukan" }, { status: 404 });
  }

  // 2) buat midtrans order_id yang:
  // - unik (biar bisa retry bayar)
  // - pendek (biar tidak tembus limit order_id Midtrans)
  const shortId = String(orderId).replace(/-/g, "").slice(0, 20); // 20 char
  const uniq = Date.now().toString(36); // pendek (base36)
  const midtransOrderId = `SRX-${shortId}-${uniq}`; // aman < 50 char

  // 3) simpan midtrans_order_id + set status pending
  await supabaseAdmin
    .from("orders")
    .update({
      midtrans_order_id: midtransOrderId,
      midtrans_transaction_status: "pending",
      status: "PENDING_PAYMENT",
    })
    .eq("id", orderId);

  // 4) parameter Snap
  const params: any = {
    transaction_details: {
      order_id: midtransOrderId,
      gross_amount: Number(order.amount_idr),
    },
    item_details: [
      {
        id: `ROBux-${order.robux_target}`,
        price: Number(order.amount_idr),
        quantity: 1,
        name: `Topup Robux ${order.robux_target}`,
      },
    ],
    customer_details: {
      first_name: order.roblox_username,
    },
    // expiry (opsional)
    expiry: {
      unit: "minute",
      duration: 30,
    },
  };

  // 5) create token
  try {
    const snapResp = await snap.createTransaction(params);

    return NextResponse.json({
      ok: true,
      token: snapResp.token,
      redirect_url: snapResp.redirect_url,
    });
  } catch (e: any) {
    // supabase update status biar rapih
    await supabaseAdmin
      .from("orders")
      .update({
        status: "CREATED",
        midtrans_transaction_status: "create_failed",
      })
      .eq("id", orderId);

    return NextResponse.json(
      {
        ok: false,
        message: "Midtrans error saat createTransaction",
        detail: String(e?.message ?? e),
      },
      { status: 500 }
    );
  }
}


