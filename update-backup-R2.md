


Buatkan sistem backup otomatis Firebase Firestore ke Cloudflare R2 khusus untuk website Ensiklopedia Alkitab berbasis Next.js.

TUJUAN:
Firebase tetap menjadi database utama.
Cloudflare R2 menjadi backup otomatis harian.
Website tetap dapat berjalan jika Firebase quota exceeded, limit, timeout, atau tidak dapat diakses.
User tidak melihat halaman 404 akibat Firebase error.

TEKNOLOGI:
Next.js
TypeScript
Firebase Firestore
Firebase Authentication
Cloudflare R2 (S3 Compatible API)
IndexedDB untuk cache browser

KOLEKSI YANG DIBACKUP:

Renungan harian
ensiklopedia
rencana baca
tanya pendeta
artikel blog
asisten khotbah
komsel
jurnal spiritual
komunitas
semua jejak panduan
users
bookmark
settings

KOLEKSI YANG TIDAK PERLU DIBACKUP:
logs
analytics
cache sementara
session sementara
SISTEM BACKUP:
Setiap hari pukul 23:00 server otomatis menjalankan backup.

Sistem membaca seluruh koleksi yang ditentukan.

Setiap koleksi dibuat menjadi file JSON terpisah.

contoh truktur R2:
backup/ ├── tokoh.json ├── tempat.json ├── istilah.json ├── perumpamaan.json ├── renungan.json ├── kategori.json ├── bible.json ├── users.json ├── bookmark.json ├── settings.json └── backup-info.json
Setelah JSON dibuat:

Kompres menggunakan gzip jika ukuran besar.
Upload ke Cloudflare R2.
Timpa file lama.
Simpan timestamp backup terakhir.
Jika backup gagal:
pastikan frontend membaca jika file backup zip di R2

Catat log error.
Kirim notifikasi ke admin via email 
Jangan menghentikan website.

DATA USER:
Untuk koleksi users:
Jangan menyimpan password.
Jangan menyimpan token login.
Jangan menyimpan refresh token.
Jangan menyimpan session.

Backup hanya:
{ uid, displayName, email, role, createdAt }
Jika menggunakan Firebase Authentication:
Login tetap menggunakan Firebase Auth.
Backup users hanya untuk pemulihan data profil.

SISTEM FALLBACK:
Saat frontend membaca data:
Langkah 1:
Ambil data dari Firebase.
Jika berhasil:
Tampilkan data.
Simpan ke IndexedDB.
Jika Firebase gagal:
Ambil data dari Cloudflare R2.

Jika R2 berhasil:
Tampilkan data.

Simpan ke IndexedDB.
Jika R2 gagal:
Ambil data dari IndexedDB.
Jika IndexedDB tersedia:
Tampilkan data cache.
Jika semua gagal:
Tampilkan halaman maintenance.
Jangan tampilkan 404.

ALUR PRIORITAS:
Firebase ↓ Cloudflare R2 ↓ IndexedDB ↓ Maintenance Page
CACHE LOKAL:
Gunakan IndexedDB.
Saat user membuka artikel:
Simpan artikel ke IndexedDB.
Simpan hasil pencarian ke IndexedDB.
Simpan daftar artikel ke IndexedDB.
Buat helper:
saveToCache() getFromCache() clearOldCache()

AUTO CLEANUP:
Hapus cache lebih dari 30 hari.
Simpan timestamp cache.
ADMIN PANEL:
Tambahkan menu:
Backup Status
Menampilkan:
Waktu backup terakhir
Ukuran backup
Jumlah dokumen per koleksi
Status upload R2
Tombol Backup Sekarang

ENVIRONMENT VARIABLES:
FIREBASE_PROJECT_ID= FIREBASE_CLIENT_EMAIL= FIREBASE_PRIVATE_KEY=
R2_ACCOUNT_ID= R2_ACCESS_KEY_ID= R2_SECRET_ACCESS_KEY= R2_BUCKET_NAME= R2_ENDPOINT=
FITUR TAMBAHAN:
Retry upload jika gagal.
Progress backup.
Validasi JSON sebelum upload.
Verifikasi file berhasil tersimpan di R2.
Logging lengkap.

OUTPUT YANG DIINGINKAN:
Struktur folder lengkap.
Kode TypeScript lengkap.
Cron job harian jam 00:00.
Upload ke Cloudflare R2.
Download dari Cloudflare R2.
Helper Firebase.
Helper IndexedDB.
Halaman status backup admin.
Halaman maintenance.
Sistem fallback otomatis Firebase → R2 → IndexedDB.
Contoh deployment di Vercel.
Best practice untuk database ensiklopedia besar dengan puluhan ribu artikel. :::
Catatan: jika data Bible sangat besar (misalnya puluhan MB), lebih baik pisahkan menjadi beberapa file seperti old-testament.json, new-testament.json, atau per kitab agar proses backup dan pemuatan lebih ringan.


______________________________________________________
menu komunitas di header pindahkan ke dalam menu Jurnal & Doa agar menu header terlihat rapih

logo header ubah dengan gambar /Users/tius/Documents/Data Tius/renungan-life/grace-daily/public/Grace-Daily.jpg
dan tetap ketika di klik mengarah ke hero sesion


_________________________________________________________

mengapa ketika firebase terkena limit paket/plant di landing pages  berlangganan  tidak sesuai dengan yang ada di admin / firebase