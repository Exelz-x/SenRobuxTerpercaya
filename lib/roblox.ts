type RobloxResolveResult =
  | { ok: true; userId: number; username: string; headshotUrl: string }
  | { ok: false; message: string };

export async function resolveRobloxUsername(username: string): Promise<RobloxResolveResult> {
  const u = username.trim();
  if (!u) return { ok: false, message: "Username kosong" };

  // 1) username -> userId
  const r1 = await fetch("https://users.roblox.com/v1/usernames/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // excludeBannedUsers true biar yang kebanned gak lolos
    body: JSON.stringify({ usernames: [u], excludeBannedUsers: true }),
    cache: "no-store",
  });

  if (!r1.ok) return { ok: false, message: "Gagal cek username Roblox" };
  const j1 = await r1.json();

  const data = j1?.data?.[0];
  if (!data?.id) return { ok: false, message: "Username tidak ditemukan" };

  const userId = Number(data.id);
  const canonicalUsername = String(data.name ?? u);

  // 2) userId -> avatar headshot
  // Pakai thumbnails API
  const thumbUrl =
    `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=true`;

  const r2 = await fetch(thumbUrl, { cache: "no-store" });
  if (!r2.ok) {
    return { ok: true, userId, username: canonicalUsername, headshotUrl: "" };
  }
  const j2 = await r2.json();
  const headshotUrl = j2?.data?.[0]?.imageUrl ?? "";

  return { ok: true, userId, username: canonicalUsername, headshotUrl };
}

export async function findGamepassByPrice(userId: number, requiredPrice: number) {
  // Endpoint yang kamu kasih:
  // GET https://apis.roblox.com/game-passes/v1/users/{USER_ID}/game-passes?count=100
  // Catatan: beberapa endpoint punya pagination cursor.
  // Kita loop sampai habis atau sampai ketemu.
  let cursor: string | undefined = undefined;

  for (let page = 0; page < 20; page++) { // batas aman biar gak infinite loop
    const url = new URL(`https://apis.roblox.com/game-passes/v1/users/${userId}/game-passes`);
    url.searchParams.set("count", "100");
    if (cursor) url.searchParams.set("cursor", cursor);

    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) {
      return { ok: false as const, message: `Gagal cek gamepass (HTTP ${res.status})` };
    }

    const json = await res.json();

    const items: any[] = json?.gamePasses ?? json?.data ?? [];
    for (const gp of items) {
      const price = Number(gp?.price ?? gp?.product?.price ?? gp?.displayPrice ?? gp?.seller?.price ?? NaN);
      if (Number.isFinite(price) && price === requiredPrice) {
        const gamepassId = Number(gp?.id ?? gp?.gamePassId ?? gp?.gamePass?.id);
        const gamepassUrl = Number.isFinite(gamepassId)
          ? `https://www.roblox.com/game-pass/${gamepassId}`
          : "";

        return {
          ok: true as const,
          found: true as const,
          gamepassId,
          gamepassUrl,
          raw: gp,
        };
      }
    }

    // pagination
    cursor = json?.nextPageCursor ?? json?.nextCursor ?? undefined;
    if (!cursor) break;
  }

  return { ok: true as const, found: false as const };
}
