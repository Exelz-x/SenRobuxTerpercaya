import { NextResponse } from "next/server";
import { signToken } from "@/lib/adminAuth";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const username = String(body?.username ?? "");
  const password = String(body?.password ?? "");

  const adminUser = process.env.ADMIN_USERNAME!;
  const adminPass = process.env.ADMIN_PASSWORD!;

  if (username !== adminUser || password !== adminPass) {
    return NextResponse.json({ ok: false, message: "Username atau password salah" }, { status: 401 });
  }

  const token = signToken({ role: "admin", username, iat: Date.now() });

  const res = NextResponse.json({ ok: true });

  // cookie admin_session
  res.cookies.set("admin_session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: false, // nanti kalau Vercel/https -> true
    path: "/",
    maxAge: 60 * 60 * 8, // 8 jam
  });

  return res;
}
