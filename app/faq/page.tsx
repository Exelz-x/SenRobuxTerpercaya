export default function FaqPage() {
  const faqs = [
    {
      q: "SenRobux itu apa?",
      a: "SenRobux adalah website Yang menjual Robux dengan harga terjangkau dan 100% Aman",
    },
    {
      q: "Kenapa Robux saya belum masuk?",
      a: "Pastikan kamu sudah menunggu 5 sampai 6 hari, karna Robux yang dikirimkan melalui gamepass, Jika 5 - 6 hari belum masuk, Silakan hubungi customer service Senrobux",
    },
    {
      q: "Kenapa harus menunggu 5 hari?",
      a: "Robux dari transaksi Game Pass biasanya memiliki waktu tunggu (pending) sebelum masuk. Di SenRobux, estimasi prosesnya 5 - 6 hari.",
    },
    {
      q: "Apa itu gamepass?",
      a: "Gamepass adalah item berbayar di Roblox yang dibeli dengan Robux dan digunakan sebagai media pembayaran saat pembelian Robux di website kami, Tentunya terjamin aman.",
    },
    {
      q: "Saya sudah bayar, langkah selanjutnya apa?",
      a: "Setelah pembayaran berhasil, pesanan akan diproses. Kamu bisa cek status di halaman “Pesanan Kita”.",
    },
    {
      q: "Kenapa Saya harus membuat gamepass?",
      a: "Kamu harus membuat gamepass sesuai harga yang kami tentukan agar kami bisa membeli Gamepass kamu dan mengirimkan Robux ke kamu dalam waktu 5 - 6 Hari.",
    },
    {
      q: "Apakah robux disini 100% Aman?",
      a: "Ya, Robux disini kami jamin 100% aman, Dikarenakan kami mendapatkan robux dari hasil yang Legal dan aman, bukan dari Menghack, Scam, Mencuri, dan sebagainya, Kami mendapatkan robux dari hasil Membuat game yang aman.",
    },
    {
      q: "Saya tidak bisa membuat tiket baru, kenapa?",
      a: "Untuk mencegah spam, jika kamu masih memiliki tiket yang statusnya OPEN, kamu harus menunggu sampai admin menutup tiket tersebut terlebih dahulu.",
    },
    {
      q: "Saya lupa order saya, bisa dilihat di mana?",
      a: "Buka halaman “Pesanan Kita”. Pesanan tersimpan di perangkat/browser yang sama (tanpa login).",
    },
    {
      q: "Butuh bantuan? Hubungi siapa?",
      a: "Silakan buat tiket di halaman Customer Service agar admin bisa membantu.",
    },
  ];

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="rounded-3xl bg-white/5 p-6 ring-1 ring-white/10">
          <h1 className="text-2xl font-bold">FAQ</h1>
          <p className="mt-2 text-sm text-white/70">
            Pertanyaan yang sering ditanyakan tentang SenRobux.
          </p>

          <div className="mt-6 space-y-4">
            {faqs.map((item, idx) => (
              <details
                key={idx}
                className="rounded-2xl bg-black/30 p-4 ring-1 ring-white/10 open:ring-green-400/30"
              >
                <summary className="cursor-pointer font-semibold">
                  {item.q}
                </summary>
                <p className="mt-3 text-sm text-white/80 leading-relaxed">
                  {item.a}
                </p>
              </details>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap gap-2">
            <a
              href="/"
              className="rounded-xl bg-white/5 px-4 py-2 text-sm font-semibold ring-1 ring-white/10 hover:ring-green-400/30"
            >
              Kembali ke Beranda
            </a>
            <a
              href="/privacy"
              className="rounded-xl bg-green-500/20 px-4 py-2 text-sm font-semibold ring-1 ring-green-400/40 hover:bg-green-500/25"
            >
              Kebijakan Privasi
            </a>
            <a
              href="/support"
              className="rounded-xl bg-white/5 px-4 py-2 text-sm font-semibold ring-1 ring-white/10 hover:ring-green-400/30"
            >
              Customer Service
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
