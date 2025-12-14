export function requiredGamepassPrice(targetRobux: number) {
  // Roblox cut 30% => creator terima 70%
  return Math.ceil(targetRobux / 0.7);
}
