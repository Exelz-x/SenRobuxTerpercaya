import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

function basicAuthHeader(serverKey: string) {
  const token = Buffer.from(`${serverKey}:`).toString("base64");
  return `Basic ${token}`;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const orderId = String(body?.orderId ?? "").trim();

  if (!orderId) {
    return NextResponse.json({ ok: false, message: "orderId kosong" }, { status: 400 });
  }

  // 1) ambil order minimal field yang dibutuhkan
  const { data: order, error: oErr } = await supabaseAdmin
    .from("orders")
    .select("id, payment_channel, status, midtrans_order_id, robux_target, stock_deducted")
    .eq("id", orderId)
    .single();

  if (oErr || !order) {
    return NextResponse.json({ ok: false, message: "Order tidak ditemukan" }, { status: 404 });
  }

  const statusNow = String(order.status ?? "");
  const channel = String(order.payment_channel ?? "");

  // 2) Kalau order MEMBER, jangan hit Midtrans (biar ga 400 terus)
  if (channel === "MEMBER") {
    return NextResponse.json({ ok: true, status: statusNow, txStatus: null, skipped: "MEMBER" });
  }

  // 3) Kalau belum ada midtrans_order_id (belum create-snap), jangan error.
  if (!order.midtrans_order_id) {
    return NextResponse.json({ ok: true, status: statusNow, txStatus: null, skipped: "NO_MIDTRANS_ORDER_ID" });
  }

  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  if (!serverKey) {
    return NextResponse.json({ ok: false, message: "MIDTRANS_SERVER_KEY belum di-set" }, { status: 500 });
  }

  const isProd = (process.env.MIDTRANS_IS_PRODUCTION ?? "false") === "true";
  const base = isProd ? "https://api.midtrans.com" : "https://api.sandbox.midtrans.com";

  // 4) cek status transaksi ke Midtrans
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

  // 5) kalau EXPIRE -> set EXPIRED
  if (txStatus === "expire") {
    await supabaseAdmin
      .from("orders")
      .update({ status: "EXPIRED", midtrans_transaction_status: txStatus })
      .eq("id", orderId);

    return NextResponse.json({ ok: true, status: "EXPIRED", txStatus });
  }

  // 6) sukses?
  const isSuccess =
    txStatus === "settlement" ||
    (txStatus === "capture" && (fraudStatus === "accept" || fraudStatus === ""));

  if (isSuccess) {
    // kalau stok belum dipotong, potong sekarang
    if (!order.stock_deducted) {
      const amount = Number(order.robux_target ?? 0);

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
      }

      // stok tidak cukup
      await supabaseAdmin
        .from("orders")
        .update({
          status: "PAID_WAIT_STOCK",
          midtrans_transaction_status: txStatus,
        })
        .eq("id", orderId);

      return NextResponse.json({ ok: true, status: "PAID_WAIT_STOCK", txStatus });
    }

    // idempotent: sudah pernah dipotong
    const keepStatus = statusNow === "DONE" ? "DONE" : "PAID";
    await supabaseAdmin
      .from("orders")
      .update({
        status: keepStatus,
        midtrans_transaction_status: txStatus,
      })
      .eq("id", orderId);

    return NextResponse.json({ ok: true, status: keepStatus, txStatus });
  }

  // 7) selain sukses: update txStatus aja + kalau cancel/deny set CANCELLED
  let nextStatus = statusNow || "PENDING_PAYMENT";
  if (txStatus === "cancel" || txStatus === "deny") {
    nextStatus = "CANCELLED";
  }

  await supabaseAdmin
    .from("orders")
    .update({
      status: nextStatus,
      midtrans_transaction_status: txStatus || null,
    })
    .eq("id", orderId);

  return NextResponse.json({ ok: true, status: nextStatus, txStatus });
}


