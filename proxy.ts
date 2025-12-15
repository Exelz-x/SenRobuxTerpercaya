import { NextRequest, NextResponse } from "next/server";
import { getRatelimiter } from "@/lib/ratelimit";

function ipOf(req: NextRequest) {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0].trim();
  return "unknown";
}

export const config = {
  matcher: [
    "/api/ticket/:path*",
    "/api/order/:path*",
    "/api/midtrans/:path*",
    "/api/admin/:path*",
  ],
};

export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;

  if (path === "/api/midtrans/webhook") {
    return NextResponse.next();
  }

  const ip = ipOf(req);

  let kind: "public" | "ticket" | "admin" = "public";
  if (path.startsWith("/api/admin")) kind = "admin";
  else if (path.startsWith("/api/ticket")) kind = "ticket";

  const rl = getRatelimiter(kind);
  if (!rl) return NextResponse.next();

  const { success, limit, remaining, reset } = await rl.limit(`ip:${ip}`);

  if (!success) {
    return NextResponse.json(
      { ok: false, message: "Terlalu banyak request. Silakan tunggu sebentar lalu coba lagi." },
      {
        status: 429,
        headers: {
          "Retry-After": String(reset),
          "X-RateLimit-Limit": String(limit),
          "X-RateLimit-Remaining": String(remaining),
          "X-RateLimit-Reset": String(reset),
        },
      }
    );
  }

  const res = NextResponse.next();
  res.headers.set("X-RateLimit-Limit", String(limit));
  res.headers.set("X-RateLimit-Remaining", String(remaining));
  res.headers.set("X-RateLimit-Reset", String(reset));
  return res;
}

