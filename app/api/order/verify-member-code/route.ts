import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const schema = z.object({
  memberCode: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: "Input tidak valid" },
      { status: 400 }
    );
  }

  const correct = String(process.env.MEMBER_CODE ?? "").trim();
  if (!correct) {
    return NextResponse.json(
      { ok: false, message: "MEMBER_CODE belum diset di env" },
      { status: 500 }
    );
  }

  if (parsed.data.memberCode.trim() !== correct) {
    return NextResponse.json(
      { ok: false, message: "Kode member salah" },
      { status: 401 }
    );
  }

  // ✅ SET cookie verifikasi (berlaku singkat, misal 15 menit)
  const res = NextResponse.json({ ok: true });

  res.cookies.set("member_verified", "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 15, // 15 menit
  });

  return res;
}

