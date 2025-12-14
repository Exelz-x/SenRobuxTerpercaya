export const PRICE_PER_100_ROBUX = 12000;

export function calculatePriceIdr(robux: number) {
  if (robux <= 0) return 0;
  // boleh pecahan 100 (misal 150 robux)
  return Math.ceil((robux / 100) * PRICE_PER_100_ROBUX);
}


