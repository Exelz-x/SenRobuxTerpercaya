import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: Request) {
  const jar = await cookies();
  const token = jar.get("admin_session")?.value;
  const payload = token ? verifyToken(token) : null;

  if (!payload || payload.role !== "admin") {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status"); // optional

  let q = supabaseAdmin
    .from("orders")
    .select("id, created_at, roblox_username, headshot_url, robux_target, amount_idr, status, midtrans_transaction_status, gamepass_url, payment_method, short_code, member_name, member_class")
    .order("created_at", { ascending: false })
    .limit(200);

  if (status) q = q.eq("status", status);

  const { data, error } = await q;

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, orders: data ?? [] });
}
