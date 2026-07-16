# Rencana Implementasi Update Ensiklopedia & Integrasi Telegram

Dokumen ini menjelaskan rencana teknis untuk melakukan optimasi generator ensiklopedia, laporan telegram, chatbot telegram, konfigurasi AdSense, dan halaman legalitas Syarat & Ketentuan.

---

## Proposed Changes

### 1. Generator Ensiklopedia (Optimal & Cepat)
Mengubah strategi `generateDailyEncyclopediaEntries` agar hanya memproses 1 keyword setiap dipanggil untuk menghindari timeout 10 detik dari Vercel Hobby Tier.

#### [MODIFY] [generate-encyclopedia.ts](file:///Users/tius/Documents/Data%20Tius/renungan-life/grace-daily/src/lib/server/generate-encyclopedia.ts)
- Dapatkan kategori berikutnya dalam antrean dengan membaca kategori dari entri terakhir yang berhasil dibuat di `ensiklopedia_cache` (diurutkan berdasarkan `createdAt` desc).
- Filter categories secara dinamis menggunakan daftar index `ALL_CATEGORIES` yang diputar mulai dari kategori berikutnya.
- Cari keyword pertama yang belum terpakai pada kategori terpilih. Jika tidak ada keyword yang tersisa di kategori tersebut, otomatis berpindah ke kategori berikutnya dalam rotasi.
- Di dalam `generateSingleEntry`, panggil `ensureEncyclopediaBannerR2` dan `ensureEncyclopediaIllustrationR2` secara synchronous agar teks dan gambar AI (dari HuggingFace/Cloudflare/Pollinations) selesai digenerate dan disimpan ke Firebase & R2 dalam satu eksekusi.
- Ubah batas target per-eksekusi default menjadi 1 (kecuali jika dijalankan secara manual dari Dashboard Admin).

---

### 2. Integrasi & Laporan Telegram Channel
Menyediakan modul pelaporan otomatis ketika konten dipublish ke website dan chatbot interaktif untuk pencarian ensiklopedia serta FAQ.

#### [MODIFY] [telegram.ts](file:///Users/tius/Documents/Data%20Tius/renungan-life/grace-daily/src/lib/server/telegram.ts)
- Tambahkan pendeteksian `TELEGRAM_CHANNEL_ID` dari environment variable.
- Buat helper untuk menghitung jumlah item di R2:
  - `getR2DevotionsCountFromIndex()`: Membaca berkas `renungan.json` dari R2.
  - `getR2ArticlesCountFromIndex()`: Membaca berkas `articles/index.json` dari R2.
  - `getR2FileCounts()`: (Sudah ada di `backup-r2-service.ts`) Menghitung berkas per kategori ensiklopedia di R2.
- Tambahkan fungsi report ke channel Telegram:
  - `reportNewDevotionTelegram(devotion)`: Kirim judul + tautan + total renungan di R2.
  - `reportNewArticleTelegram(article)`: Kirim judul + tautan + total artikel di R2.
  - `reportNewEncyclopediaTelegram(entry)`: Kirim topik + kategori + tautan + detail statistik per kategori & total ensiklopedia di R2.

#### [MODIFY] [route.ts (daily-devotion)](file:///Users/tius/Documents/Data%20Tius/renungan-life/grace-daily/src/app/api/cron/daily-devotion/route.ts)
- Panggil `reportNewDevotionTelegram` sesaat setelah proses R2 backup berhasil dijalankan.

#### [MODIFY] [route.ts (generate-blog)](file:///Users/tius/Documents/Data%20Tius/renungan-life/grace-daily/src/app/api/cron/generate-blog/route.ts)
- Panggil `reportNewArticleTelegram` sesaat setelah proses R2 backup berhasil dijalankan.

#### [NEW] [route.ts (contact-api)](file:///Users/tius/Documents/Data%20Tius/renungan-life/grace-daily/src/app/api/contact/route.ts)
- Buat API route POST `/api/contact` untuk menerima input Form Kontak (nama, email, subjek, pesan).
- Kirim pesan kontak langsung ke Telegram Admin `TELEGRAM_CHAT_ID` via Bot API.

#### [MODIFY] [page.tsx (kontak)](file:///Users/tius/Documents/Data%20Tius/renungan-life/grace-daily/src/app/kontak/page.tsx)
- Ubah form submission untuk mengirim data ke API lokal `/api/contact` menggantikan target luar `https://formsubmit.co/...`.

#### [NEW] [route.ts (telegram-webhook)](file:///Users/tius/Documents/Data%20Tius/renungan-life/grace-daily/src/app/api/telegram/webhook/route.ts)
- Handler POST webhook dari Telegram Bot.
- Jika pengguna mengirim pesan:
  1. Periksa kecocokan keyword dengan `faq.json` di R2. Jika cocok, balas dengan jawaban. Jika `faq.json` tidak ada, buat file faq default di R2 lalu gunakan.
  2. Jika tidak cocok FAQ, cari kecocokan kata kunci di `ensiklopedia_cache` (Firestore / R2 backup JSON). Jika ditemukan, potong bagian `## RINGKASAN` dan balas dengan ringkasan serta tautan lengkap.
  3. Jika tidak ditemukan, kirim pesan bantuan standar dan menu kontak.

#### [NEW] [route.ts (traffic-monitoring)](file:///Users/tius/Documents/Data%20Tius/renungan-life/grace-daily/src/app/api/monitoring/traffic/route.ts)
- Endpoint GET `/api/monitoring/traffic` dengan autentikasi `CRON_SECRET`.
- Ambil data trafik dari Google Analytics GA4 (atau simulasi jika belum dikonfigurasi).
- Kirim laporan status trafik (pengunjung realtime, pengunjung hari ini, tayangan halaman) ke Telegram channel.

---

### 3. Modul React & R2 Google AdSense
Membuat admin panel dan renderer iklan Google AdSense dinamis yang terintegrasi dengan konfigurasi terpusat.

#### [MODIFY] [route.ts (sync-doc)](file:///Users/tius/Documents/Data%20Tius/renungan-life/grace-daily/src/app/api/admin/sync-doc/route.ts)
- Tambahkan penanganan khusus ketika `collection === "settings"` dan `id === "ads_config"`.
- Simpan payload secara langsung ke root bucket R2 sebagai file `ads_config.json`.

#### [MODIFY] [AdminConsole.tsx](file:///Users/tius/Documents/Data%20Tius/renungan-life/grace-daily/src/app/components/AdminConsole.tsx)
- Tambahkan state baru untuk parameter AdSense: `ad_client`, `ad_slot`, `position`, `targets` (checkbox pages), `landingSection`, `intensity` (slider), dan `isEnabled` toggle.
- Load data AdSense pada mount dari Firestore document `settings/ads_config`.
- Tambahkan formulir input konfigurasi AdSense di bawah tab `"adsense"`.
- Pemicu simpan akan menulis ke Firestore dan melakukan sinkronisasi ke R2 via `syncDocR2`.

#### [NEW] [AdSenseAd.tsx](file:///Users/tius/Documents/Data%20Tius/renungan-life/grace-daily/src/app/components/AdSenseAd.tsx)
- Client component yang membaca `ads_config.json` dari R2.
- Menggunakan `localStorage` untuk caching konfigurasi agar tidak berulang kali melakukan HTTP request.
- Periksa kesesuaian parameter halaman aktif (`pathname`) dan posisi penempatan.
- Masukkan `<ins className="adsbygoogle">` dan panggil `window.adsbygoogle.push({})` secara dinamis.

#### [MODIFY] Penempatan Iklan di Halaman Target
Tambahkan komponen `<AdSenseAd placement="..." />` di bagian atas/bawah/samping pada komponen berikut:
- [HomeClient.tsx](file:///Users/tius/Documents/Data%20Tius/renungan-life/grace-daily/src/app/components/HomeClient.tsx) (Landing Page)
- [DevotionPageClient.tsx](file:///Users/tius/Documents/Data%20Tius/renungan-life/grace-daily/src/app/components/DevotionPageClient.tsx) (Detail Renungan)
- [BlogPostClient.tsx](file:///Users/tius/Documents/Data%20Tius/renungan-life/grace-daily/src/app/components/BlogPostClient.tsx) (Detail Blog)
- [client.tsx (EncyclopediaClient)](file:///Users/tius/Documents/Data%20Tius/renungan-life/grace-daily/src/app/ensiklopedia/%5Bkategori%5D/%5Bslug%5D/client.tsx) (Detail Ensiklopedia)

---

### 4. Legalitas & Footer Links

#### [NEW] [page.tsx (syarat-ketentuan)](file:///Users/tius/Documents/Data%20Tius/renungan-life/grace-daily/src/app/syarat-dan-ketentuan/page.tsx)
- Buat halaman legalitas statis Syarat & Ketentuan yang menerangkan bahwa semua teks, judul, artikel, renungan, ensiklopedia, dan ilustrasi gambar diproduksi oleh AI (Open Source MIT License).

#### [MODIFY] [HomeClient.tsx](file:///Users/tius/Documents/Data%20Tius/renungan-life/grace-daily/src/app/components/HomeClient.tsx)
- Tambahkan ikon dan tautan menuju channel Telegram `https://t.me/gracedailybible` pada bagian footer sejajar dengan media sosial lainnya.

---

## Verification Plan

### Automated/Manual API Tests
- Panggil `/api/cron/generate-encyclopedia` dan pastikan hanya memproses 1 keyword serta selesai di bawah 10 detik.
- Periksa log Telegram Channel setelah eksekusi cron Ensiklopedia, Renungan, dan Blog berhasil.
- Submit form Kontak di `/kontak` dan pastikan notifikasi masuk ke chat pribadi admin.
- Lakukan panggilan Telegram Webhook simulasi untuk memastikan bot dapat mencocokkan FAQ dari R2 dan mencari data Ensiklopedia dengan benar.
- Panggil `/api/monitoring/traffic?secret=CRON_SECRET` dan verifikasi postingan trafik terkirim ke Telegram Channel.

### UI Verification
- Buka dashboard admin `/admin`, klik tab **AdSense**, ubah konfigurasi iklan dan simpan. Pastikan berkas `ads_config.json` di R2 terupdate.
- Buka halaman Beranda, Renungan, Blog, dan Ensiklopedia. Periksa apakah kode `<ins className="adsbygoogle">` disisipkan sesuai konfigurasi.
- Buka footer halaman beranda dan pastikan ikon Telegram terpasang dengan baik dan mengarah ke link Telegram Channel.
- Buka halaman `/syarat-dan-ketentuan` dan verifikasi pesan perlindungan hukum AI MIT tampil dengan baik.

-----------------------------------------------------------
# Task Checklist - Encyclopedia & Telegram Update

- [x] 1. Generator Ensiklopedia (Optimal & Cepat)
  - [x] Modify `src/lib/server/generate-encyclopedia.ts` to process 1 keyword per execution and sequence R2 uploads synchronously
- [ ] 2. Integrasi & Laporan Telegram Channel
  - [ ] Implement/Update `src/lib/server/telegram.ts` with Telegram channel reporting helpers and R2 count loaders
  - [ ] Modify `src/app/api/cron/daily-devotion/route.ts` to call `reportNewDevotionTelegram` after R2 backup
  - [ ] Modify `src/app/api/cron/generate-blog/route.ts` to call `reportNewArticleTelegram` after R2 backup
  - [ ] Create `src/app/api/contact/route.ts` POST handler for contacting admin via Telegram
  - [ ] Modify `src/app/kontak/page.tsx` to submit form to `/api/contact`
  - [ ] Create `src/app/api/telegram/webhook/route.ts` to handle bot commands, FAQ search, and Encyclopedia search
  - [ ] Create `src/app/api/monitoring/traffic/route.ts` to send GA4 traffic metrics to Telegram
- [ ] 3. Modul React & R2 Google AdSense
  - [ ] Modify `src/app/api/admin/sync-doc/route.ts` to save `ads_config` to R2 as `ads_config.json`
  - [ ] Modify `src/app/components/AdminConsole.tsx` to add AdSense configuration inputs and sync them
  - [ ] Create `src/app/components/AdSenseAd.tsx` Client Component for rendering ads dynamically using local storage caching
  - [ ] Insert `<AdSenseAd placement="..." />` into target page components:
    - [ ] `HomeClient.tsx`
    - [ ] `DevotionPageClient.tsx`
    - [ ] `BlogPostClient.tsx`
    - [ ] `ensiklopedia/[kategori]/[slug]/client.tsx`
- [ ] 4. Legalitas & Footer Links
  - [ ] Create `src/app/syarat-dan-ketentuan/page.tsx` for Terms of Service (AI-produced contents, MIT License)
  - [ ] Modify `src/app/components/HomeClient.tsx` (or footer component) to add Telegram channel link and icon
- [ ] 5. Verification & Final Verification
  - [ ] Verify API endpoints
  - [ ] Verify UI flows
  - [ ] Build & check for errors
------------------------------------------------------------------------------
1. ubah fitur  ensiklopedia :

Pengguna / user hanya dapat mencari dan membaca artikel yang sudah tersimpan di database. 
AI hanya digunakan di sisi admin untuk membuat, memperbarui, atau merangkum artikel.
Fitur pencarian:
Search hanya mencari data dari database.
Tidak mengirim pertanyaan ke LLM.
Jika artikel tidak ditemukan, tampilkan pesan: "Artikel belum tersedia."
perbaharui firebases rules
______________________________________________________________________

Perbaiki link ikon share ensiklopedia yang double
_____________________________________________________________________

2. sesioan alkitab di landing pages buat dinamsi seperti sesion ensiklopedia

# Rencana Implementasi: Alkitab Online Interaktif di Landing Page

Dokumen ini menjelaskan rencana teknis untuk merombak seksi "Alkitab Online" di halaman depan (landing page) agar interaktif dan dinamis, serupa dengan seksi "Jelajahi Ensiklopedia".

## User Review Required

> [!IMPORTANT]
> - **Simulator Interaktif**: Kami akan membuat komponen baru `<BiblePreview />` di `src/app/components/` yang memiliki simulator visual dengan dua tab:
>   1. **🔍 Mode Cari Ayat**: Simulator pengetikan otomatis ayat populer (seperti *Yohanes 3:16*, *Mazmur 23:1*, *khawatir*) lengkap dengan cuplikan kartu hasil ayat yang relevan secara visual.
>   2. **🏷️ Mode Ayat Tematik**: Simulator pemilih tema (seperti *Kasih*, *Damai*, *Kekuatan*) yang menampilkan daftar cuplikan ayat tematis secara interaktif.
> - **Integrasi Penelusuran Nyata**: Form pencarian di sisi kiri simulator akan berfungsi secara nyata. Ketika pengguna mengetik kata kunci atau referensi ayat lalu menekan tombol "Cari", halaman akan langsung dialihkan ke `/alkitab?search=KATA_KUNCI`.

## Proposed Changes

---

### 1. Components

#### [NEW] [BiblePreview.tsx](file:///Users/tius/Documents/Data%20Tius/renungan-life/grace-daily/src/app/components/BiblePreview.tsx)
Komponen client-side interaktif untuk preview Alkitab:
- **Seksi Kiri**:
  - Teks promosi Alkitab Online yang bersih.
  - Form Pencarian Nyata: Input teks yang jika di-submit mengalihkan ke `/alkitab?search=...`.
  - Pintasan Kategori Alkitab: Kategori seperti *Taurat*, *Puisi & Hikmat*, *Injil*, dan *Surat-Surat* dengan tautan langsung ke `/alkitab`.
- **Seksi Kanan (Simulator Digital)**:
  - Tab Switcher: Antara "🔍 Mode Cari Ayat" dan "🏷️ Mode Ayat Tematik".
  - **Animasi Auto-Typing**: Efek mengetik otomatis untuk referensi/kata kunci seperti "Yohanes 3:16" atau "khawatir", lalu menampilkan kartu ayat Alkitab yang bersangkutan.
  - **Pintasan Tematik**: Tombol interaktif untuk tema Alkitab yang ketika diklik memperbarui daftar ayat simulasi di bawahnya.

---

### 2. Main Page

#### [MODIFY] [page.tsx](file:///Users/tius/Documents/Data%20Tius/renungan-life/grace-daily/src/app/page.tsx)
- Mengimpor komponen baru `<BiblePreview />`.
- Menggantikan seksi statis `<section className="bg-[#102c3a] ...">` dengan pemanggilan `<BiblePreview />`.

---

## Verification Plan

### Automated Tests
- Menjalankan `npm run build` untuk memastikan proyek terkompilasi dengan sukses tanpa error tipe TypeScript.

### Manual Verification
- Membuka halaman utama (`/`) di browser lokal dan scroll ke seksi Alkitab Online untuk menguji:
  1. Pergantian tab simulator ("🔍 Mode Cari Ayat" vs "🏷️ Mode Ayat Tematik").
  2. Animasi ketik otomatis pada tab pencarian simulator.
  3. Klik tema pada tab tematik simulator untuk memastikan ayat berubah sesuai tema.
  4. Pengisian kata kunci di form pencarian sebelah kiri lalu menekan "Cari" untuk memastikan navigasi ke `/alkitab` dengan parameter yang benar bekerja.


————————————————————————————————————————————
3. Buat fitur Admin Content Completeness Checker untuk Ensiklopedia Alkitab.

Tugas:
- Cek seluruh artikel yang sudah ada di Firestore.
- Bandingkan dengan master data Alkitab.
- Temukan entri yang belum dibuat.
- Berikan 20 rekomendasi terbaik untuk dibuat berikutnya. dengan tombol next

Prioritas / category
- [ ] 1. Tokoh utama Alkitab.
- [ ] 2. Tempat penting dalam Alkitab.
- [ ] Kamus Alkitab
- [ ] 4. Istilah teologi yang sering dicari.
- [ ] 5. Perumpamaan Yesus.
- [ ] 6. Mukjizat Yesus.
- [ ] 7. Kitab
- [ ] 8. Kronologi

Output format:

{
  "category": "tokoh",
  "recommended": [
    {
      "name": "Abner",
      "priority": 90,
      "reason": "Tokoh penting pada masa Raja Daud"
    }
  ]
}


Buat koleksi masterData yang berisi daftar lengkap entri Alkitab untuk setiap kategori.

Fitur Admin:
1. Tampilkan total data master per kategori.
2. Tampilkan jumlah artikel yang sudah ada di database.
3. Tampilkan jumlah artikel yang belum dibuat.
4. Bandingkan masterData dengan artikel yang sudah ada berdasarkan slug.
5. Tampilkan daftar entri yang belum dibuat.
6. Urutkan berdasarkan prioritas.
8. Tampilkan progress bar persentase kelengkapan per kategori.
9. Gunakan TypeScript, Next.js App Router, Firebase Firestore, dan Tailwind CSS.
10. Buat komponen dashboard admin yang modern dan responsif.

Output:
- Struktur Firestore
- TypeScript types
- Query Firestore
- Fungsi pengecekan data yang belum ada
- UI Dashboard lengkap

_____________________________________________________________________