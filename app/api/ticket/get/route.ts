import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, message: "id kosong" }, { status: 400 });

  const { data: ticket, error: tErr } = await supabaseAdmin
    .from("tickets")
    .select("*")
    .eq("id", id)
    .single();

  if (tErr || !ticket) {
    return NextResponse.json({ ok: false, message: "Tiket tidak ditemukan" }, { status: 404 });
  }

  const { data: messages, error: mErr } = await supabaseAdmin
    .from("ticket_messages")
    .select("*")
    .eq("ticket_id", id)
    .order("created_at", { ascending: true });

  if (mErr) {
    return NextResponse.json({ ok: false, message: "Gagal memuat chat" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, ticket, messages: messages ?? [] });
}
