// eslint-disable-next-line @typescript-eslint/no-var-requires
const midtransClient = require("midtrans-client");

export const snap = new midtransClient.Snap({
  isProduction: String(process.env.MIDTRANS_IS_PRODUCTION) === "true",
  serverKey: process.env.MIDTRANS_SERVER_KEY!,
  clientKey: process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY!,
});


