import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { snap } from "@/lib/midtrans";

export const runtime = "nodejs";

type OrderRow = {
  id: string;
  status: string | null;
  expires_at: string | null;

  midtrans_order_id: string | null;
  midtrans_snap_token: string | null;
  midtrans_snap_redirect_url: string | null;

  amount_idr: number | null;
  robux_target: number | null;
  roblox_username: string | null;
};

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const orderId = String(body?.orderId ?? "");

  if (!orderId) {
    return NextResponse.json(
      { ok: false, message: "orderId kosong" },
      { status: 400 }
    );
  }

  // A) Ambil order dulu (select minimal + type casting)
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select(
      [
        "id",
        "status",
        "expires_at",
        "midtrans_order_id",
        "midtrans_snap_token",
        "midtrans_snap_redirect_url",
        "amount_idr",
        "robux_target",
        "roblox_username",
      ].join(",")
    )
    .eq("id", orderId)
    .single();

  if (error || !data) {
    return NextResponse.json(
      { ok: false, message: "Order tidak ditemukan" },
      { status: 404 }
    );
  }

  const order = data as unknown as OrderRow;

  // ✅ base url untuk finish redirect
  const envBase = (process.env.NEXT_PUBLIC_BASE_URL ?? "").replace(/\/$/, "");
  const origin = new URL(req.url).origin;
  const baseUrl = envBase || origin;

  const status = String(order.status ?? "");

  // B) Reuse token kalau masih pending & belum expired
  const now = Date.now();
  const expMs = order.expires_at ? new Date(order.expires_at).getTime() : 0;
  const notExpired = expMs === 0 ? true : expMs > now;

  const pendingLike = ["PENDING_PAYMENT", "WAITING_PAYMENT", "READY_TO_PAY"];

  if (
    order.midtrans_snap_token &&
    notExpired &&
    pendingLike.includes(status)
  ) {
    return NextResponse.json({
      ok: true,
      token: order.midtrans_snap_token,
      redirect_url: order.midtrans_snap_redirect_url ?? null,
      reused: true,
    });
  }

  // Jangan bikin transaksi baru kalau sudah dibayar
  const paidLike = ["PAID", "WAITING_DELIVERY", "DONE", "PAID_WAIT_STOCK"];
  if (paidLike.includes(status)) {
    return NextResponse.json(
      { ok: false, message: "Order sudah dibayar. Tidak bisa membuat transaksi lagi." },
      { status: 400 }
    );
  }

  // Pastikan midtrans_order_id tetap 1 untuk order ini
  let midtransOrderId = String(order.midtrans_order_id ?? "");
  if (!midtransOrderId) {
    const shortId = String(orderId).replace(/-/g, "").slice(0, 20);
    const uniq = Date.now().toString(36);
    midtransOrderId = `SRX-${shortId}-${uniq}`;

    await supabaseAdmin
      .from("orders")
      .update({
        midtrans_order_id: midtransOrderId,
        midtrans_transaction_status: "pending",
        status: "PENDING_PAYMENT",
      })
      .eq("id", orderId);
  } else {
    // kalau sudah ada, cukup pastikan status pending
    await supabaseAdmin
      .from("orders")
      .update({
        midtrans_transaction_status: "pending",
        status: "PENDING_PAYMENT",
      })
      .eq("id", orderId);
  }

  const amount = Number(order.amount_idr ?? 0);
  const robuxTarget = Number(order.robux_target ?? 0);
  const robloxUsername = String(order.roblox_username ?? "Customer");

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json(
      { ok: false, message: "amount_idr tidak valid di order" },
      { status: 400 }
    );
  }

  if (!Number.isFinite(robuxTarget) || robuxTarget <= 0) {
    return NextResponse.json(
      { ok: false, message: "robux_target tidak valid di order" },
      { status: 400 }
    );
  }

  // 4) Parameter Snap
  const params: any = {
    transaction_details: {
      order_id: midtransOrderId,
      gross_amount: amount,
    },
    item_details: [
      {
        id: `ROBux-${robuxTarget}`,
        price: amount,
        quantity: 1,
        name: `Topup Robux ${robuxTarget}`,
      },
    ],
    customer_details: {
      first_name: robloxUsername,
    },
    callbacks: {
      finish: `${baseUrl}/order-complete?id=${orderId}`,
    },
    expiry: {
      unit: "minute",
      duration: 30,
    },
  };

  // 5) Create token
  try {
    const snapResp = await snap.createTransaction(params);

    const snapToken = String(snapResp?.token ?? "");
    const snapRedirectUrl = snapResp?.redirect_url ?? null;

    if (!snapToken) {
      return NextResponse.json(
        { ok: false, message: "Snap token kosong dari Midtrans" },
        { status: 502 }
      );
    }

    // ✅ Simpan token biar bisa reuse
    await supabaseAdmin
      .from("orders")
      .update({
        midtrans_order_id: midtransOrderId,
        midtrans_snap_token: snapToken,
        midtrans_snap_redirect_url: snapRedirectUrl,
      })
      .eq("id", orderId);

    return NextResponse.json({
      ok: true,
      token: snapToken,
      redirect_url: snapRedirectUrl,
      reused: false,
    });
  } catch (e: any) {
    await supabaseAdmin
      .from("orders")
      .update({
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





