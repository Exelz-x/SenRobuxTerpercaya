import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  memberCode: z.string().min(1),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Input tidak valid" }, { status: 400 });
  }

  const correct = process.env.MEMBER_CODE!;
  if (parsed.data.memberCode.trim() !== correct) {
    return NextResponse.json({ ok: false, message: "Kode member salah" }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
