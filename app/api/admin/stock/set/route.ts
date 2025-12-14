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
  const n = Number(body?.stock);

  if (!Number.isFinite(n) || n < 0) {
    return NextResponse.json({ ok: false, message: "Stock tidak valid" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("stock")
    .update({ robux_stock: Math.floor(n), updated_at: new Date().toISOString() })
    .eq("id", 1);

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
