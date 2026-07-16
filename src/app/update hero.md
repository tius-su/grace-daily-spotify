Perbarui sistem artikel renungan harian Grace Daily dengan ketentuan berikut:

## Gambar Artikel

1. Hentikan seluruh proses AI Image Generation untuk gambar utama Renungan harian
2. Jangan membuat prompt gambar.
3. Jangan memanggil API image generation apa pun.
4. Jangan menyimpan base64 image.
5. Jangan mengunggah gambar baru ke storage.

Gunakan hanya gambar statis yang tersimpan di Cloudflare R2.

Daftar gambar: /Users/tius/Documents/Data Tius/renungan-life/grace-daily/src/app/image-grace-hero

  "https://pub-9ba2247ba0854484a764b2a32e6b6ef1.r2.dev/hero/Grace-Daily-best.png",
  "https://pub-9ba2247ba0854484a764b2a32e6b6ef1.r2.dev/hero/Grace-Daily5.jpeg",
  "https://pub-9ba2247ba0854484a764b2a32e6b6ef1.r2.dev/hero/Grace-daily-bile.png",
  "https://pub-9ba2247ba0854484a764b2a32e6b6ef1.r2.dev/hero/Grace-daily.jpeg",
  "https://pub-9ba2247ba0854484a764b2a32e6b6ef1.r2.dev/hero/Grace-daily.png",
  "https://pub-9ba2247ba0854484a764b2a32e6b6ef1.r2.dev/hero/Grace.daily.jpeg",
  "https://pub-9ba2247ba0854484a764b2a32e6b6ef1.r2.dev/hero/Grace.daily.png",
  "https://pub-9ba2247ba0854484a764b2a32e6b6ef1.r2.dev/hero/Grace.png",
  "https://pub-9ba2247ba0854484a764b2a32e6b6ef1.r2.dev/hero/GraceDaily-1.png",
  "https://pub-9ba2247ba0854484a764b2a32e6b6ef1.r2.dev/hero/Grace_daily.png",


Saat artikel baru dibuat oleh cron:

- Pilih gambar secara bergiliran atau acak setiap Renungan harian baru - loop
- Simpan URL gambar yang dipilih ke field imageUrl.
- Renungan harian lama tetap menggunakan imageUrl yang sudah tersimpan.
- Jangan mengubah imageUrl Renungan harian lama.

## Fallback Gambar

Tambahkan fallback berlapis:

Prioritas 1:
article.imageUrl dari Firebase

Prioritas 2:
default URL gambar R2

Prioritas 3:
fallback.webp lokal

Contoh alur:

article.imageUrl
↓
default R2 image
↓
/fallback.webp

Pastikan pengguna hampir tidak pernah melihat fallback.webp jika URL R2 masih tersedia.

## Cloudflare R2

- Cloudflare R2 tetap menjadi sumber utama gambar.
- Jangan memindahkan gambar ke folder public Vercel.
- Jangan menyimpan file gambar di browser sebagai sumber utama.
- Service Worker hanya digunakan untuk cache, bukan sebagai sumber data utama.

## Service Worker / PWA

Perbaiki Service Worker agar gambar tidak gagal tampil di perangkat mobile.

Persyaratan:

1. Data artikel dan API menggunakan strategi Network First.
2. Gambar dari R2 menggunakan Stale While Revalidate atau Cache First dengan expiration.
3. Jika cache gagal, ambil gambar langsung dari jaringan.
4. Tambahkan versioning cache.
5. Bersihkan cache lama saat Service Worker baru aktif.
6. Gunakan skipWaiting() dan clientsClaim().
7. Pastikan pengguna tidak perlu menutup browser atau restart HP untuk melihat gambar terbaru.
8. Hindari kondisi yang menyebabkan fallback image muncul padahal URL gambar valid.
9. Pastikan update Service Worker berjalan otomatis setelah deploy.

## Cron Vercel

Jangan mengubah sistem cron yang sudah berjalan.

Cron tetap:

- Membuat Renungan  harian.
- Menyimpan Renungan harian ke Firebase.
- Berjalan sesuai jadwal yang ada saat ini.

## OG Banner

Jangan mengubah sistem Open Graph Banner.

Tetap pertahankan:

- API OG Image.
- ogImageUrl.
- Pembuatan banner otomatis untuk Facebook, WhatsApp, Telegram, dan X.
- Seluruh logika SEO yang sudah ada.

## Tujuan Akhir

- Renungan harian dibuat otomatis seperti sekarang
- Tidak ada lagi AI image generation untuk gambar utama Renungan harian.
- Gambar utama menggunakan gambar statis dari Cloudflare R2.
- OG Banner tetap dibuat otomatis seperti sekarang.
- Service Worker tidak menyebabkan gambar gagal tampil.
- Mobile selalu menampilkan gambar dengan benar tanpa perlu menutup browser atau restart perangkat.
- Cache digunakan hanya untuk mempercepat loading, bukan menggantikan sumber utama data.

deploy grace-daily-topaz.vercel.app
