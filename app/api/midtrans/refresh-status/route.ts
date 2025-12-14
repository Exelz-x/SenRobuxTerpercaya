import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function basicAuthHeader(serverKey: string) {
  // Midtrans pakai basic auth: base64("SERVER_KEY:")
  const token = Buffer.from(`${serverKey}:`).toString("base64");
  return `Basic ${token}`;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const orderId = String(body?.orderId ?? "");
  if (!orderId)
    return NextResponse.json({ ok: false, message: "orderId kosong" }, { status: 400 });

  // ambil order
  const { data: order, error: oErr } = await supabaseAdmin
    .from("orders")
    .select("id, midtrans_order_id, robux_target, stock_deducted, status")
    .eq("id", orderId)
    .single();

  if (oErr || !order)
    return NextResponse.json({ ok: false, message: "Order tidak ditemukan" }, { status: 404 });
  if (!order.midtrans_order_id)
    return NextResponse.json({ ok: false, message: "midtrans_order_id belum tersimpan" }, { status: 400 });

  const serverKey = process.env.MIDTRANS_SERVER_KEY!;
  const isProd = (process.env.MIDTRANS_IS_PRODUCTION ?? "false") === "true";
  const base = isProd ? "https://api.midtrans.com" : "https://api.sandbox.midtrans.com";

  // cek status transaksi ke Midtrans
  const statusRes = await fetch(`${base}/v2/${order.midtrans_order_id}/status`, {
    method: "GET",
    headers: {
      Authorization: basicAuthHeader(serverKey),
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const st = await statusRes.json().catch(() => null);
  if (!statusRes.ok || !st) {
    return NextResponse.json(
      { ok: false, message: "Gagal cek status Midtrans", detail: st },
      { status: 502 }
    );
  }

  const txStatus = String(st.transaction_status ?? "");
  const fraudStatus = String(st.fraud_status ?? "");
  const isSuccess =
    txStatus === "settlement" ||
    (txStatus === "capture" && (fraudStatus === "accept" || fraudStatus === ""));

  // ✅ CABANG BARU: EXPIRE => status EXPIRED
  if (txStatus === "expire") {
    await supabaseAdmin
      .from("orders")
      .update({ status: "EXPIRED", midtrans_transaction_status: txStatus })
      .eq("id", orderId);

    return NextResponse.json({ ok: true, status: "EXPIRED", txStatus });
  }

  // Update status di order
  if (isSuccess) {
    // potong stok kalau belum pernah
    if (!order.stock_deducted) {
      const amount = Number(order.robux_target);
      const { data: okDeduct, error: dErr } = await supabaseAdmin.rpc("decrement_stock", {
        p_amount: amount,
      });

      if (!dErr && okDeduct === true) {
        await supabaseAdmin
          .from("orders")
          .update({
            status: "PAID",
            stock_deducted: true,
            midtrans_transaction_status: txStatus,
          })
          .eq("id", orderId);

        return NextResponse.json({ ok: true, status: "PAID", txStatus });
      } else {
        await supabaseAdmin
          .from("orders")
          .update({
            status: "PAID_WAIT_STOCK",
            midtrans_transaction_status: txStatus,
          })
          .eq("id", orderId);

        return NextResponse.json({ ok: true, status: "PAID_WAIT_STOCK", txStatus });
      }
    }

    // sudah dipotong (idempotent)
    await supabaseAdmin
      .from("orders")
      .update({
        status: order.status === "DONE" ? "DONE" : "PAID",
        midtrans_transaction_status: txStatus,
      })
      .eq("id", orderId);

    return NextResponse.json({
      ok: true,
      status: order.status === "DONE" ? "DONE" : "PAID",
      txStatus,
    });
  }

  // kalau belum sukses, simpan status transaksi juga
  await supabaseAdmin
    .from("orders")
    .update({
      midtrans_transaction_status: txStatus,
      // status order biarkan tetap PENDING_PAYMENT kalau memang belum settlement
    })
    .eq("id", orderId);

  return NextResponse.json({ ok: true, status: order.status, txStatus });
}

