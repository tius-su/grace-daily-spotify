olong buatkan komponen UI halaman pricing/billing untuk aplikasi "Grace Daily" menggunakan Tailwind CSS dan React. Halaman ini didesain dengan konsep "Kemitraan Pelayanan" dan dibatasi MAKSIMAL 3 CARD SAJA (termasuk paket Free).

semua paket donasi dapat di ubah di halaman admin console

Spesifikasi Desain & Warna:
- Background Utama: Deep Navy Blue (#0d1b2a / #111e38)
- Layout: Grid 3 kolom yang responsif (1 kolom di mobile, 3 kolom di desktop).

Konten yang Harus Ada di Halaman:

1. Header Section:
   - Judul: "Dukung Pelayanan Digital Grace Daily"
   - Deskripsi: "Pilih bagaimana Anda ingin terlibat dalam pelayanan ini. Setiap dukungan Anda membantu kami menyediakan akses Firman Tuhan berbasis AI bagi ribuan jemaat."

2. Susunan 3 Card:

   * Card 1 (Paket Sahabat / Free):
     - Judul: "Sahabat Grace Daily"
     - Harga: "Rp0" / selamanya
     - List Fitur: Akses Alkitab & Renungan Online, 5 Kuota Tanya Pendeta AI / hari, Fitur Dasar.
     - Tombol: "Mulai Gratis" (Warna border putih/abu-abu tipis, tanpa fill penuh).

   * Card 2 (Mitra Pelayanan - Beri Badge "REKOMENDASI"):
     - Desain: Beri border emas hangat (#f4c430) agar terlihat paling menonjol.
     - Judul: "Mitra Pelayanan"
     - Harga: "Rp60.000" / bulan
     - List Fitur: Semua fitur Sahabat, Akses Konseling Rohani AI, Musik Rohani, Ekspor PDF, Jurnal Spiritual, 150 Kuota AI, dan otomatis mensubsidi kuota untuk jemaat yang membutuhkan.
     - Tombol: "Gabung Kemitraan" (Warna Gold penuh dengan teks gelap).

   * Card 3 (Donasi Terbuka / Nominal Bebas): pertahankan yang sudah ada
     - Judul: "Mitra Sukarela"
     - Harga Besar: "Bebas"
     - Sub-keterangan: "Mulai dari Rp20.000"
     - List Fitur: Nilai akses premium dihitung proporsional (Kelipatan Rp20k = 30 hari akses & 50 kuota AI), Berkontribusi langsung pada biaya token AI server.
     - Komponen Tambahan: Masukkan input field HTML sederhana berlabel "Masukkan Nominal Donasi (Rp)" di atas tombol.
     - Tombol: "Donasi Sekarang" (Warna Teal/Hijau Toska yang ramah dan kontras).

Pastikan teks di dalam card menggunakan bahasa pelayanan yang hangat, tipografi yang rapi, scannable, dan padding yang seimbang.

jalankan npm run build - pastikan tidak ada error dan resume menggunakan bahasa indone