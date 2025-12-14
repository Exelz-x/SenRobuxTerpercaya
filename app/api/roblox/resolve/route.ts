import { NextResponse } from "next/server";
import { resolveRobloxUsername } from "@/lib/roblox";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const username = String(body?.username ?? "");

  const result = await resolveRobloxUsername(username);
  return NextResponse.json(result);
}

