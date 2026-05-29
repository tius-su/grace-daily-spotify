import Link from "next/link";

export default function TermsAndConditions() {
  return (
    <main className="min-h-screen bg-[#f7f4ee] text-[#1f2933] py-16 px-5 sm:px-8">
      <div className="mx-auto max-w-4xl bg-white p-8 sm:p-12 rounded-lg shadow-sm border border-[#dfd8ca]">
        <Link
          href="/"
          className="inline-flex items-center text-sm font-semibold text-[#2a6f6f] hover:underline mb-8"
        >
          &larr; Kembali ke Beranda
        </Link>
        <h1 className="text-3xl font-semibold text-[#14213d] mb-6">
          Syarat dan Ketentuan
        </h1>
        
        <div className="space-y-6 text-[#52606d] leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-[#14213d] mb-3">1. Penerimaan Syarat</h2>
            <p>
              Dengan mengakses dan menggunakan aplikasi Grace Daily, Anda menyetujui untuk terikat oleh Syarat dan Ketentuan ini. Jika Anda tidak setuju dengan bagian mana pun dari syarat ini, Anda tidak diperkenankan menggunakan layanan kami.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#14213d] mb-3">2. Layanan Premium</h2>
            <p>
              Grace Daily menawarkan layanan premium berbayar yang memberikan akses ke fitur-fitur eksklusif seperti kuota tanya jawab AI (Pendeta) dan fitur lanjutan lainnya. Pembayaran bersifat tidak dapat dikembalikan (non-refundable) kecuali ditentukan lain oleh hukum yang berlaku.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#14213d] mb-3">3. Penggunaan Layanan</h2>
            <p>
              Anda setuju untuk menggunakan layanan Grace Daily hanya untuk tujuan yang sah dan sesuai dengan ajaran moral kekristenan. Anda tidak diperkenankan menyalahgunakan fitur AI, menyebarkan konten yang tidak pantas, atau mengganggu kenyamanan pengguna lain di komunitas doa.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#14213d] mb-3">4. Privasi dan Data</h2>
            <p>
              Kami sangat menghargai privasi Anda. Data pribadi Anda, termasuk catatan jurnal dan doa, disimpan dengan aman dan tidak akan dibagikan ke pihak ketiga tanpa persetujuan Anda, kecuali diwajibkan oleh hukum.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#14213d] mb-3">5. Perubahan Ketentuan</h2>
            <p>
              Kami berhak memodifikasi atau mengganti Syarat dan Ketentuan ini kapan saja. Perubahan akan berlaku segera setelah dipublikasikan di halaman ini. Kami menyarankan Anda untuk meninjau halaman ini secara berkala.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
