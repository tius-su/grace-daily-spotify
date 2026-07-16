perbaiki fitur mini app
* voice to text pasang di halaman khusus  alkitab dan di renungan harian miniapp
alkitab ambil dari local vercel dan R2 sebagai backup
untuk altikel, renungan harian, ensklopedia ambil dari R2

alkitab, renungan harian dan artikel blog error tidak bisa ambil data sepertinya masih ambil dari firebase

perbaiki voice to text agar berfungsi normal dan responsive dan tidak melewati firebase

voice to text gunakan Web Speech API SEHINGGA TIDAK MELEWATI FIREBASE
----------------------------------

cloudflare D1 = 02913987-6b3d-45c9-890a-4f0a43f43b6a
gracedaily-db

saya ingin mengubah migrasi arsitektur aplikasi dari Firebase ke Cloudflare D1 + R2. tujuan untuk melepas dari bayang

ubah semua pengambilan data dari firebase ke r2 web utama dan minp app


ubah juga system di admin console yang berhubungan dengan databse firebase
Saya membutuhkan bantuan untuk membuat sistem baru dengan alur sebagai berikut:
Struktur Database (Cloudflare D1):
Buatkan desain skema SQL untuk tabel articles yang efisien untuk menyimpan metadata: id, title, category, r2_path, created_at, dan tags.
Pastikan skema ini optimal untuk fitur pencarian (pencarian kata kunci per kategori).

Integrasi Cron Job:
 Upload file konten (JSON & WebP) ke R2.
 Insert metadata artikel ke tabel articles di D1.
API Logic (Search & Fetch):
pencarian artikel berdasarkan kata kunci atau kategori.

Utamakan efisiensi agar penggunaan read rows di D1 tetap rendah.
buat  migrasi ini tanpa membuat aplikasi saya down."
Tips Sebelum Anda Menggunakan Prompt Ini:


jadikan R2 tetap sebagai backup fallback - data di R2 jangan di pindahkan ke D1 - user tetep baca dari R2 dan R2 menjadi penyimpanan yang utama

D1 hanay di gunakan menyimpan informasi yang diperlukan untuk pencarian dan daftar artikel / ensiklopedia

Yang tetap disimpan di R2
JSON lengkap artikel.
Thumbnail atau gambar jika ukurannya besar. / webp
Lampiran seperti PDF atau file lainnya.
Backup ekspor metadata (misalnya backup/articles.json) untuk pemulihan.
Dengan pola ini:
D1 menjadi "daftar isi" yang cepat dicari.
R2 menjadi "gudang data" dan cadangan.
Jika suatu saat D1 rusak atau terhapus, Anda cukup membaca kembali file JSON di R2 dan mengisi ulang D1 melalui skrip migrasi

gunakan cloudflare wrangler untik mengelola D1 sehingg semua berjlana otomatis,, migrasi tabel, biding, deploymend
