export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="rounded-3xl bg-white/5 p-6 ring-1 ring-white/10">
          <h1 className="text-2xl font-bold">Kebijakan Privasi</h1>
          <p className="mt-2 text-sm text-white/70">
            Terakhir diperbarui: {new Date().toLocaleDateString("id-ID")}
          </p>

          <div className="mt-6 space-y-6 text-white/80 leading-relaxed">
            <section>
              <h2 className="text-lg font-semibold text-white">1. Ringkasan</h2>
              <p className="mt-2">
                SenRobux menghargai privasi pengguna. Dokumen ini menjelaskan data apa yang kami kumpulkan,
                untuk apa data tersebut digunakan, dan bagaimana kami melindunginya.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white">2. Data yang Kami Kumpulkan</h2>
              <ul className="mt-2 list-disc pl-6 space-y-2">
                <li>
                  <strong>Username Roblox</strong> yang kamu masukkan saat membeli atau membuat tiket bantuan.
                </li>
                <li>
                  <strong>Data pesanan</strong> seperti jumlah Robux yang dibeli, total pembayaran (IDR), dan status pesanan.
                </li>
                <li>
                  <strong>Data pembayaran</strong> dari Midtrans (misalnya status transaksi, metode pembayaran) untuk keperluan verifikasi.
                </li>
                <li>
                  <strong>Data tiket customer service</strong> (judul keluhan dan isi chat) agar admin bisa membantu.
                </li>
                <li>
                  <strong>Data lokal perangkat</strong> (localStorage) untuk menyimpan daftar pesanan/tiket agar bisa dilihat kembali tanpa login.
                </li>
              </ul>
              <p className="mt-3 text-sm text-white/60">
                Catatan: kami tidak meminta password Roblox. Jangan pernah membagikan password ke siapapun.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white">3. Cara Kami Menggunakan Data</h2>
              <ul className="mt-2 list-disc pl-6 space-y-2">
                <li>Memproses pesanan Robux dan menampilkan detail pesanan.</li>
                <li>Memverifikasi pembayaran melalui notifikasi/webhook Midtrans.</li>
                <li>Membantu penyelesaian masalah melalui sistem tiket (customer service).</li>
                <li>Mencegah spam/penyalahgunaan sistem (misal pembatasan pembuatan tiket).</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white">4. Penyimpanan & Keamanan</h2>
              <p className="mt-2">
                Data pesanan dan tiket disimpan di database (Supabase). Akses admin dilindungi dengan login.
                Kami berusaha menjaga keamanan sistem, namun tidak ada metode transmisi/penyimpanan yang 100% aman.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white">5. Pihak Ketiga</h2>
              <p className="mt-2">
                Pembayaran diproses melalui <strong>Midtrans</strong>. Ketentuan dan kebijakan privasi Midtrans berlaku
                saat kamu menggunakan metode pembayaran mereka.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white">6. Retensi Data</h2>
              <p className="mt-2">
                Data pesanan dan tiket dapat disimpan selama diperlukan untuk operasional, keamanan, dan penyelesaian komplain.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white">7. Hak Pengguna</h2>
              <p className="mt-2">
                Kamu dapat meminta informasi terkait data pesanan/tiket kamu melalui customer service.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white">8. Perubahan Kebijakan</h2>
              <p className="mt-2">
                Kebijakan ini dapat diperbarui sewaktu-waktu. Versi terbaru akan ditampilkan di halaman ini.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white">9. Kontak</h2>
              <p className="mt-2">
                Jika ada pertanyaan tentang privasi, silakan buat tiket di halaman{" "}
                <a className="text-green-300 hover:text-green-200" href="/support">
                  Customer Service
                </a>
                .
              </p>
            </section>
          </div>

          <div className="mt-8 flex gap-2">
            <a
              href="/"
              className="rounded-xl bg-white/5 px-4 py-2 text-sm font-semibold ring-1 ring-white/10 hover:ring-green-400/30"
            >
              Kembali ke Beranda
            </a>
            <a
              href="/faq"
              className="rounded-xl bg-green-500/20 px-4 py-2 text-sm font-semibold ring-1 ring-green-400/40 hover:bg-green-500/25"
            >
              Baca FAQ
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
