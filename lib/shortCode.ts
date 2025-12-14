export function generateShortCode() {
  // 6 karakter base36 (0-9a-z), gampang ditulis
  const rand = Math.floor(Math.random() * 36 ** 6).toString(36).toUpperCase().padStart(6, "0");
  return `SRX-${rand}`;
}
