import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function sha512(input: string) {
  return crypto.createHash("sha512").update(input).digest("hex");
}

export async function POST(req: Request) {
  const notification = await req.json().catch(() => null);

  if (!notification) {
    return NextResponse.json({ ok: false, message: "Invalid JSON" }, { status: 400 });
  }

  const {
    order_id,
    status_code,
    gross_amount,
    signature_key,
    transaction_status,
    payment_type,
    settlement_time,
    fraud_status,
  } = notification;

  // 1) Verify signature Midtrans
  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  if (!serverKey) {
    return NextResponse.json({ ok: false, message: "MIDTRANS_SERVER_KEY belum di-set" }, { status: 500 });
  }

  const expected = sha512(`${order_id}${status_code}${gross_amount}${serverKey}`);
  if (expected !== signature_key) {
    return NextResponse.json({ ok: false, message: "Invalid signature" }, { status: 401 });
  }

  // 2) Cari order di Supabase berdasarkan midtrans_order_id (paling aman)
  const { data: found, error: findErr } = await supabaseAdmin
    .from("orders")
    .select("id")
    .eq("midtrans_order_id", order_id)
    .single();

  // Kalau order tidak ketemu, balikin 200 OK supaya Midtrans tidak retry terus
  if (findErr || !found?.id) {
    return NextResponse.json({
      ok: true,
      message: "Order tidak ditemukan di DB untuk midtrans_order_id ini",
    });
  }

  const ourOrderId = found.id;

  // ✅ helper status sukses
  const txStatus = String(notification.transaction_status ?? "");
  const fraudStatus = String(notification.fraud_status ?? "");

  const isSuccess =
    txStatus === "settlement" ||
    (txStatus === "capture" && (fraudStatus === "accept" || fraudStatus === ""));

  // ✅ kalau sukses: potong stok secara idempotent + update status
  if (isSuccess) {
    // ambil order dulu (butuh robux_target + stock_deducted)
    const { data: order, error: oErr } = await supabaseAdmin
      .from("orders")
      .select("id, robux_target, stock_deducted, status")
      .eq("id", ourOrderId)
      .single();

    if (!oErr && order) {
      // kalau stok belum pernah dipotong, potong sekarang
      if (!order.stock_deducted) {
        const amount = Number(order.robux_target);

        const { data: okDeduct, error: dErr } = await supabaseAdmin.rpc(
          "decrement_stock",
          { p_amount: amount }
        );

        if (!dErr && okDeduct === true) {
          // stok berhasil dipotong -> order jadi PAID
          await supabaseAdmin
            .from("orders")
            .update({
              status: "PAID",
              stock_deducted: true,
              midtrans_transaction_status: txStatus,
              midtrans_payment_type: payment_type ?? null,
              paid_at: settlement_time ?? new Date().toISOString(),
            })
            .eq("id", ourOrderId);
        } else {
          // stok tidak cukup -> tetap catat pembayaran, tapi tunggu stok
          await supabaseAdmin
            .from("orders")
            .update({
              status: "PAID_WAIT_STOCK",
              midtrans_transaction_status: txStatus,
              midtrans_payment_type: payment_type ?? null,
              paid_at: settlement_time ?? new Date().toISOString(),
            })
            .eq("id", ourOrderId);
        }
      } else {
        // idempotent: sudah pernah dipotong, cukup update status payment
        await supabaseAdmin
          .from("orders")
          .update({
            status: order.status === "DONE" ? "DONE" : "PAID",
            midtrans_transaction_status: txStatus,
            midtrans_payment_type: payment_type ?? null,
            paid_at: settlement_time ?? new Date().toISOString(),
          })
          .eq("id", ourOrderId);
      }
    }

    return NextResponse.json({ ok: true });
  }

  // 3) Map status Midtrans ke status sistem kita (non-success)
  let newStatus = "PENDING_PAYMENT";

  // cancelled/expired/failed
  if (txStatus === "expire" || txStatus === "cancel" || txStatus === "deny") {
    newStatus = "CANCELLED";
  }

  // 4) Update order (fallback)
  await supabaseAdmin
    .from("orders")
    .update({
      midtrans_transaction_status: txStatus || null,
      midtrans_payment_type: payment_type ?? null,
      status: newStatus,
      paid_at: null,
    })
    .eq("id", ourOrderId);

  return NextResponse.json({ ok: true });
}


