import { NextRequest, NextResponse } from "next/server";
import { getRatelimiter } from "@/lib/ratelimit";

function ipOf(req: NextRequest) {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) {
    return xf.split(",")[0].trim();
  }
  return "unknown";
}

export const config = {
  // Terapkan ke endpoint yang rawan
  matcher: [
    "/api/ticket/:path*",
    "/api/order/:path*",
    "/api/midtrans/:path*",
    "/api/admin/:path*",
  ],
};

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // Jangan ganggu webhook Midtrans (biar payment tetap masuk)
  // Midtrans punya IP sendiri + retry, lebih aman jangan di-limit keras via middleware.
  if (path === "/api/midtrans/webhook") {
    return NextResponse.next();
  }

  const ip = ipOf(req);

  let kind: "public" | "ticket" | "admin" = "public";
  if (path.startsWith("/api/admin")) kind = "admin";
  else if (path.startsWith("/api/ticket")) kind = "ticket";

  const rl = getRatelimiter(kind);
  if (!rl) return NextResponse.next(); // dev tanpa Upstash, skip

  const { success, limit, remaining, reset } = await rl.limit(`ip:${ip}`);

  if (!success) {
    return NextResponse.json(
      {
        ok: false,
        message: "Terlalu banyak request. Silakan tunggu sebentar lalu coba lagi.",
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(reset), // detik sampai reset (Upstash reset biasanya unix sec; ini cukup sebagai hint)
          "X-RateLimit-Limit": String(limit),
          "X-RateLimit-Remaining": String(remaining),
          "X-RateLimit-Reset": String(reset),
        },
      }
    );
  }

  // Set header info (opsional)
  const res = NextResponse.next();
  res.headers.set("X-RateLimit-Limit", String(limit));
  res.headers.set("X-RateLimit-Remaining", String(remaining));
  res.headers.set("X-RateLimit-Reset", String(reset));
  return res;
}
