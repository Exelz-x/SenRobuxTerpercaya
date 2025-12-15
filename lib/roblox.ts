type RobloxResolveResult =
  | { ok: true; userId: number; username: string; headshotUrl: string }
  | { ok: false; message: string };

export async function resolveRobloxUsername(
  username: string
): Promise<RobloxResolveResult> {
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
  const thumbUrl = `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=true`;

  const r2 = await fetch(thumbUrl, { cache: "no-store" });
  if (!r2.ok) {
    return { ok: true, userId, username: canonicalUsername, headshotUrl: "" };
  }
  const j2 = await r2.json();
  const headshotUrl = j2?.data?.[0]?.imageUrl ?? "";

  return { ok: true, userId, username: canonicalUsername, headshotUrl };
}

// ✅ GANTI TOTAL: versi filter anti "gamepass beli"
export async function findGamepassByPrice(userId: number, requiredPrice: number) {
  let cursor: string | undefined;

  for (let page = 0; page < 20; page++) {
    const url = new URL(`https://apis.roblox.com/game-passes/v1/users/${userId}/game-passes`);
    url.searchParams.set("count", "100");
    if (cursor) url.searchParams.set("cursor", cursor);

    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) {
      return { ok: false as const, message: "Gagal cek gamepass Roblox" };
    }

    const json = await res.json();
    const items: any[] = json?.gamePasses ?? json?.data ?? [];

    for (const gp of items) {
      const price = Number(
        gp?.price ??
          gp?.product?.price ??
          gp?.displayPrice ??
          NaN
      );

      if (!Number.isFinite(price) || price !== requiredPrice) continue;

      const gamepassId = Number(gp?.id ?? gp?.gamePassId);
      if (!Number.isFinite(gamepassId)) continue;

      // 🔒 FILTER ANTI "GAMEPASS BELI"
      // Gamepass yang DIBELI biasanya punya ownership flag
      if (gp?.owned === true || gp?.isOwned === true) {
        continue;
      }

      // 🔒 FILTER TAMBAHAN: harus PUBLIC / for sale
      if (gp?.isForSale === false) {
        continue;
      }

      return {
        ok: true as const,
        found: true as const,
        gamepassId,
        gamepassUrl: `https://www.roblox.com/game-pass/${gamepassId}`,
      };
    }

    cursor = json?.nextPageCursor ?? json?.nextCursor;
    if (!cursor) break;
  }

  return { ok: true as const, found: false as const };
}


