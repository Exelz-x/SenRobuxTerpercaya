import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/adminAuth";
import { cookies } from "next/headers";

export async function GET() {
  const jar = await cookies();
  const token = jar.get("admin_session")?.value;
  if (!token) return NextResponse.json({ ok: false }, { status: 401 });

  const payload = verifyToken(token);
  if (!payload || payload.role !== "admin") return NextResponse.json({ ok: false }, { status: 401 });

  return NextResponse.json({ ok: true, admin: payload });
}
