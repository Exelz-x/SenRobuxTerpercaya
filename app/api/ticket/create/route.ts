import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const schema = z.object({
  roblox_username: z.string().min(1).max(50),
  subject: z.string().min(3).max(120),
  message: z.string().min(1).max(2000),
  deviceKey: z.string().min(10).max(200),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: "Input tidak valid" },
      { status: 400 }
    );
  }

  const { roblox_username, subject, message, deviceKey } = parsed.data;

  // Cek: masih ada tiket OPEN untuk device ini?
  const { data: openTicket } = await supabaseAdmin
    .from("tickets")
    .select("id")
    .eq("device_key", deviceKey)
    .eq("status", "OPEN")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (openTicket?.id) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Kamu masih punya tiket yang belum ditutup admin. Tunggu sampai CLOSED.",
        activeTicketId: openTicket.id,
      },
      { status: 429 }
    );
  }

  const { data: ticket, error: tErr } = await supabaseAdmin
    .from("tickets")
    .insert({ roblox_username, subject, status: "OPEN", device_key: deviceKey })
    .select("id, roblox_username, subject, status, created_at")
    .single();

  if (tErr || !ticket) {
    return NextResponse.json(
      { ok: false, message: "Gagal membuat tiket" },
      { status: 500 }
    );
  }

  const { error: mErr } = await supabaseAdmin
    .from("ticket_messages")
    .insert({ ticket_id: ticket.id, sender: "USER", message });

  if (mErr) {
    return NextResponse.json(
      { ok: false, message: "Tiket dibuat tapi pesan pertama gagal disimpan" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, ticketId: ticket.id });
}

