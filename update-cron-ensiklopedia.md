
saya ingin membuat cron otomatis untuk entry data ensiklopedia 

gunakan data ini sebagai patokan /Users/tius/Documents/Data Tius/renungan-life/grace-daily/Master_data_ensiklopediaCategory :

Aturan:
- Pilih topik yang belum pernah digunakan sebelumnya.
- Jangan mengulang nama tokoh, istilah, tempat, peristiwa, kitab, atau topik yang sudah pernah dibuat.
- Tulis dalam Bahasa Indonesia.
data di tulis di firebase dan R2

1 hari buat 25 cron dengan jadwal
Contoh jadwal:
01.00 → 5 tokoh Alkitab
03.00 → 5 Tempat
05.00 → 5 Perumpamaan
07.00 → 5 Kronologi
09.00 → 5 Teolog
Total 25 entri per hari.




TELEGRAM_BOT_TOKEN=8734226608:AAH3N4AZ2FvlRLXqBzhO1gbLZEK74W8f5Mg

category yang sudah ada :
Tokoh
Tempat
Kamus
Mukjizat
Perumpamaan
Kitab
Kronologi

tolong Tambahkan Category Ensiklopedia :
Silsilah
Teologi
Topikal Alkitab
peristiwa


cron langsung menandai data tersebut di database (misal diberi properti "isGenerated": true). Jadi, di sesi cron berikutnya, server tidak perlu membaca ulang seluruh file JSON dari awal, cukup mencari data yang belum diberi penanda

Alurnya bisa seperti ini: - mengikuti yang sudah ada, jangan merubah struktur json
Cron Job Vercel
Berjalan 1 kali sehari (misalnya jam 02.00 WIB).
Memilih 25 tokoh yang belum ada di database.
AI Generate Konten



Validasi
Cek apakah tokoh sudah ada.
Cek panjang artikel minimum.
Cek field wajib terisi.
Simpan ke Database
Firebase Firestore dan  langsung ke Cloudflare R2 + index metadata , seo
Generate slug otomatis.
Publish
Langsung muncul di halaman Ensiklopedia.
Sitemap diperbarui.
Kategori yang bisa diisi otomatis:


buatkan :
Halaman dashboard admin cron log
/admin/cron-logs
Tanggal ,jenis ,berhasil, duplikat, gagal
Buatkan Tombol pemicu cron ensilopeida manual

Buat laporan aktivitas cron via telegram dengan TELEGRAM_BOT_TOKEN=8734226608:AAH3N4AZ2FvlRLXqBzhO1gbLZEK74W8f5Mg

Data yang diberikan:

Tanggal: {{date}}
Jenis Cron: {{cronType}}
Total Target: {{target}}
Berhasil: {{success}}
Duplikat: {{duplicate}}
Gagal: {{failed}}

Daftar Entri Baru:
{{entries}}



1. Judul laporan.
2. Ringkasan statistik:
   - Total Target
   - Berhasil
   - Duplikat
   - Gagal
3. Daftar entri yang berhasil dibuat.
4. Status akhir:
   - BERHASIL jika gagal = 0
   - PERLU PERHATIAN jika gagal > 0
5. Footer:
   "Laporan otomatis Grace Daily Cron System"

__________________________________________________________

Tambahkan apikey openrouter sebagai SECOND backup dan api key Mistral posisikan sebelum apikey Nividia untuk membuat artikel
OPENROUTER_API_KEY_SECOND_BACKUP=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
MISTRAL_API_KEY=vhJPbXMMGgG1QIw3VNDNBShOM3mTkqGG



_____________________________________________________________

analisa keseluruhan  kemungkinan ada bug / error di app ini