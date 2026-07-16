# Panduan Sistem Otomatisasi Konten & Banner AI - Grace Daily

Dokumen ini menjelaskan cara menggunakan dan mengonfigurasi fitur generator artikel otomatis (AI Blog), generator banner dinamis, serta perpustakaan media Cloudflare R2.

---

## 1. Generator Artikel Otomatis (Cron Job & Manual)

Sistem ini dirancang untuk memproduksi artikel blog Kristen secara otonom dan mendistribusikannya kepada pengguna melalui email newsletter.

### Cara Kerja Sistem
1. **Jadwal Otomatis (Cron)**: Berjalan setiap 2 hari sekali pada jam 05:00 WIB via endpoint `/api/cron/generate-blog`.
2. **Pengecekan Pengaturan**: Sistem membaca koleksi `settings/auto_blog` di Firestore. Jika dinonaktifkan (disabled), cron akan dilewati (kecuali dipicu manual oleh admin).
3. **Pemilihan Kategori**: Membaca 6 kategori aktif dari Firestore `settings/blog_categories`, lalu memilih salah satu kategori secara acak.
4. **AI Failover System**:
   - **Langkah 1**: AI Utama (**OpenRouter** dengan model `google/gemini-2.5-flash`) mencoba membuat artikel minimal 500 kata dalam format JSON (Title, Excerpt, HTML Body).
   - **Langkah 2 (Failover)**: Jika OpenRouter mengalami error, sistem akan otomatis beralih menggunakan AI Cadangan (**Groq** dengan model `llama-3.3-70b-versatile`).
5. **Penyimpanan**: Artikel disimpan di Firestore pada koleksi `blog_posts` dengan status `published`.
6. **Email Blast (Newsletter)**: Sistem mengambil seluruh alamat email pengguna terdaftar di Firestore dan mengirimkan email pemberitahuan artikel baru menggunakan **Nodemailer** via **BCC** (untuk menjaga privasi email pengguna).

### Cara Mengoperasikan
* **Mengaktifkan/Menonaktifkan Otomatisasi**:
  1. Masuk ke halaman **Admin Console** di website.
  2. Buka tab **Media & AI** -> sub-tab **Content Generator**.
  3. Geser toggle switch **Status Generator Otomatis** ke **AKTIF** atau **NONAKTIF**.
* **Memicu Pembuatan Artikel Sekarang (Manual)**:
  1. Pada tab **Content Generator**, klik tombol **Generate AI Article & Blast Newsletter Now**.
  2. Klik **OK** pada konfirmasi. Sistem akan langsung memproses artikel menggunakan AI dan membroadcast email ke seluruh jemaat/pengguna.
* **Membuat Artikel Manual dengan Dynamic Banner**:
  1. Isi form **Buat Artikel Manual** di sub-tab yang sama.
  2. Masukkan **Judul**, **Kategori**, **Emoji/Icon**, **Excerpt**, dan **Isi Artikel** menggunakan editor teks TinyMCE.
  3. Artikel Anda akan menggunakan dynamic banner otomatis yang merender teks Anda secara real-time. Klik **Simpan & Publikasikan Artikel**.

---

## 2. Generator Banner Gambar Dinamis (Edge API)

Fitur ini merender banner gambar beresolusi tinggi (1200x630 piksel) secara instan berdasarkan parameter teks yang dikirimkan. Sangat cocok untuk OG Image (Open Graph) artikel blog.

### Akses API
Endpoint: `/api/admin/generate-image`
Metode: `GET`

### Parameter Query yang Didukung
* `title`: Judul utama yang diletakkan di tengah banner (misal: `title=Mengucap Syukur di Tengah Badai`).
* `description`: Deskripsi/ringkasan pendek di bawah judul (misal: `description=Bagaimana tetap beriman saat badai kehidupan menerpa`).
* `icon`: Emoji atau ikon visual di bagian atas banner (misal: `icon=🙏` atau `icon=⛪`).

### Contoh Penggunaan Link
Cukup gunakan URL berikut pada tag `<img>` atau meta tag sosial media Anda:
```html
https://www.gracedaily.my.id/api/admin/generate-image?title=Judul%20Artikel&description=Ringkasan%20singkat%20disini&icon=📖
```

Sistem merender banner dalam format gambar secara instan menggunakan **Edge Runtime & `@vercel/og` (Satori)** dengan estetika premium berwarna krem/earth-tone minimalis.

---

## 3. Unggah & Manajemen Video/Gambar (Cloudflare R2 Media Library)

Perpustakaan media terintegrasi dengan penyimpanan Cloudflare R2 kompatibel S3 untuk menyimpan aset multimedia berukuran besar (gambar, audio, dan video banner).

### Cara Menggunakan Media Library
1. Masuk ke **Admin Console** -> tab **Media & AI** -> sub-tab **Cloudflare R2 Media Library**.
2. **Mengunggah File (Gambar / Video / Audio)**:
   - Klik tombol **Pilih File (Choose File)** di kotak upload.
   - Pilih file gambar (.jpg, .png, .webp) atau video (.mp4, .mov) yang ingin Anda unggah.
   - Sistem akan mengunggah file tersebut dan mengamankannya di bucket R2 Anda.
3. **Mendapatkan Link Akses**:
   - Setiap file yang berhasil diunggah akan tampil di daftar media di bawahnya.
   - Jika Anda memiliki domain publik R2 yang terkonfigurasi (`NEXT_PUBLIC_R2_PUBLIC_URL`), URL langsung akan dibuat secara otomatis.
   - Jika tidak, sistem akan menggunakan secure download routing.
4. **Mengunduh File secara Aman**:
   - Klik tombol **Download** pada kartu file.
   - Sistem akan membuat link presigned rahasia berdurasi 60 detik secara aman lalu otomatis memulai unduhan ke komputer/smartphone Anda.
5. **Menghapus File**:
   - Klik tombol **Hapus** berwarna merah di kartu file, konfirmasi penghapusan, dan file akan dihapus selamanya dari Cloudflare R2.
