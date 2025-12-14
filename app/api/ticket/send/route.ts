import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/adminAuth";

const schema = z.object({
  ticketId: z.string().min(1),
  message: z.string().min(1).max(2000),
  as: z.enum(["USER", "ADMIN"]).optional(), // default USER
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Input tidak valid" }, { status: 400 });
  }

  const { ticketId, message } = parsed.data;
  const as = parsed.data.as ?? "USER";

  // kalau mengaku ADMIN, wajib punya cookie admin_session valid
  if (as === "ADMIN") {
    const jar = await cookies();
    const token = jar.get("admin_session")?.value;
    const payload = token ? verifyToken(token) : null;
    if (!payload || payload.role !== "admin") {
      return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
    }
  }

  // cek status tiket (kalau CLOSED, jangan boleh chat)
  const { data: ticket } = await supabaseAdmin
    .from("tickets")
    .select("status")
    .eq("id", ticketId)
    .single();

  if (!ticket) return NextResponse.json({ ok: false, message: "Tiket tidak ditemukan" }, { status: 404 });
  if (ticket.status === "CLOSED") return NextResponse.json({ ok: false, message: "Tiket sudah ditutup" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("ticket_messages")
    .insert({ ticket_id: ticketId, sender: as, message });

  if (error) return NextResponse.json({ ok: false, message: "Gagal kirim pesan" }, { status: 500 });

  return NextResponse.json({ ok: true });
}
