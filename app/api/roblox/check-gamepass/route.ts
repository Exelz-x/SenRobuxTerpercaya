import { NextResponse } from "next/server";
import { findGamepassByPrice } from "@/lib/roblox";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const userId = Number(body?.userId);
  const requiredPrice = Number(body?.requiredPrice);

  if (!Number.isFinite(userId) || !Number.isFinite(requiredPrice)) {
    return NextResponse.json({ ok: false, message: "Parameter invalid" }, { status: 400 });
  }

  const result = await findGamepassByPrice(userId, requiredPrice);
  return NextResponse.json(result);
}
