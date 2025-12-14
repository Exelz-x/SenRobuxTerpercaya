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
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, message: "id kosong" }, { status: 400 });

  const { data, error } = await supabaseAdmin.from("orders").select("*").eq("id", id).single();
  if (error || !data) return NextResponse.json({ ok: false, message: "Order tidak ditemukan" }, { status: 404 });

  return NextResponse.json({ ok: true, order: data });
}
