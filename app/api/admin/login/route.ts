import { NextResponse } from "next/server";
import { signToken } from "@/lib/adminAuth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  // =========================
  // GUARD PALING ATAS (ENV)
  // =========================
  if (
    !process.env.ADMIN_USERNAME ||
    !process.env.ADMIN_PASSWORD ||
    !process.env.JWT_SECRET
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "ENV admin belum diset di server (ADMIN_USERNAME / ADMIN_PASSWORD / ADMIN_JWT_SECRET)",
      },
      { status: 500 }
    );
  }

  // =========================
  // LOGIN LOGIC
  // =========================
  const body = await req.json().catch(() => null);
  const username = String(body?.username ?? "");
  const password = String(body?.password ?? "");

  const adminUser = process.env.ADMIN_USERNAME;
  const adminPass = process.env.ADMIN_PASSWORD;

  if (username !== adminUser || password !== adminPass) {
    return NextResponse.json(
      { ok: false, message: "Username atau password salah" },
      { status: 401 }
    );
  }

  const token = signToken({
    role: "admin",
    username,
    iat: Date.now(),
  });

  const res = NextResponse.json({ ok: true });

  // =========================
  // COOKIE ADMIN SESSION
  // =========================
  res.cookies.set("admin_session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: false, // ubah true kalau sudah https / vercel
    path: "/",
    maxAge: 60 * 60 * 8, // 8 jam
  });

  return res;
}

