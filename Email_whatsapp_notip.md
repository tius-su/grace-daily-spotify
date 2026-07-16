Tambahkan fitur "Public Subscription" pada aplikasi Grace Daily sehingga pengunjung yang belum login tetap dapat berlangganan artikel dan renungan harian.

TUJUAN:

- Pengguna tidak perlu login untuk menerima email artikel baru.
- Pengguna tidak perlu login untuk menerima push notification melalui Firebase Cloud Messaging (FCM).
- Pengguna dapat berhenti berlangganan kapan saja.

______________________________
Ubah smtp Gmail menjadi mengunakan resend

await resend.emails.send({
  from: 'Grace Daily <renungan@gracedaily.my.id>',
  to: user@email.com,
  subject: 'Renungan Harian',
  html: htmlContent,
});

_______________________________________

FITUR YANG HARUS DIBUAT:


1. PUBLIC EMAIL SUBSCRIPTION

Buat form:

"Dapatkan Renungan dan Artikel Harian"

Input:

- Email

Checkbox:

- Renungan Harian
- Artikel Baru

Tombol:

- Berlangganan

Saat submit:

- Validasi email.
- Simpan ke database.
- Hindari email duplikat.
- Jika email sudah ada, update preferensinya.

Struktur data:

emailSubscribers
subscriberId
email
devotionEnabled
articleEnabled
active
unsubscribeToken
createdAt
updatedAt

Contoh:

{
"email": "user@example.com",
"devotionEnabled": true,
"articleEnabled": true,
"active": true,
"unsubscribeToken": "random_secure_token",
"createdAt": 1749000000000
}

2. PUBLIC PUSH NOTIFICATION SUBSCRIPTION

Saat website dibuka:

- Minta izin notifikasi browser.
- Ambil FCM token.
- Simpan walaupun pengguna belum login.

Struktur data:

pushSubscribers
tokenHash
token
devotionEnabled
articleEnabled
active
createdAt
updatedAt

3. UNSUBSCRIBE EMAIL

Tambahkan link pada footer semua email:

"Berhenti Berlangganan"

Contoh:

https://domain.com/unsubscribe?token=TOKEN

Saat dibuka:

- Cari subscriber berdasarkan token.
- Ubah active menjadi false.
- Tampilkan halaman sukses.

4. MANAGE NOTIFICATION PREFERENCES

Buat halaman:

/notification-preferences

Isi:

[ON/OFF] Renungan Harian
[ON/OFF] Artikel Baru

Jika OFF:

- Update preferensi subscriber.
- Jangan kirim notifikasi untuk kategori tersebut.

5. ADMIN PUBLISH INTEGRATION

Saat admin publish artikel:

- Kirim email hanya ke:
  active = true
  articleEnabled = true

- Kirim FCM hanya ke:
  active = true
  articleEnabled = true

Saat admin publish renungan:

- Kirim email hanya ke:
  active = true
  devotionEnabled = true

- Kirim FCM hanya ke:
  active = true
  devotionEnabled = true

6. DUPLICATE PROTECTION

Pastikan:

- Email yang sama tidak tersimpan dua kali.
- Token FCM yang sama tidak tersimpan dua kali.

7. CLEANUP

Buat scheduled task:

- Hapus token FCM yang sudah invalid.
- Hapus subscriber email yang bounce permanen.
- Jalankan 1x per hari.

8. ADMIN DASHBOARD

Tambahkan statistik:

- Total Email Subscribers
- Active Email Subscribers
- Total Push Subscribers
- Active Push Subscribers
- Subscribers Hari Ini
- Unsubscribe Hari Ini

9. SECURITY

- Gunakan token unsubscribe yang aman.
- Sanitasi semua input.
- Rate limit endpoint subscribe.
- Jangan tampilkan email lengkap di dashboard.
- Gunakan HTTPS untuk semua endpoint.

10. KOMPATIBILITAS

Harus kompatibel dengan:

- Firebase Authentication yang sudah ada.
- Firebase Cloud Messaging yang sudah berjalan.
- Sistem publish artikel dan renungan yang sudah berjalan.
- Tidak mengubah fitur user login yang sudah ada.
- Tidak merusak struktur database eksisting.

Buat implementasi lengkap frontend, backend, database schema, API endpoint, migration script, dan dokumentasi penggunaan.

—-----+-+++------------------------------
Tambahkan fitur "Follow WhatsApp Channel" pada website Grace Daily.

TUJUAN:

- Mengajak pengunjung mengikuti WhatsApp Channel Grace Daily.
- Tampil responsif di desktop dan mobile.
- Tidak mengganggu pengalaman membaca.

SPESIFIKASI:

1. Tambahkan tombol WhatsApp Channel pada:
   
   - Homepage Hero Section
   - Footer Website
   - Halaman Artikel
   - Halaman Renungan

2. Gunakan URL channel dari konfigurasi:

WHATSAPP_CHANNEL_URL

Ikuti saluran Grace Daily di WhatsApp: https://whatsapp.com/channel/0029VbCUBJfG8l5A2qoOPN0w


3. Tampilan tombol:

Ikon WhatsApp
Teks:
"Ikuti WhatsApp Channel Grace Daily"

Subteks:
"Dapatkan renungan dan artikel terbaru setiap hari."

4. Saat tombol diklik:

- Buka link channel di tab baru.
- Gunakan target="_blank"
- Gunakan rel="noopener noreferrer"

5. Tambahkan popup ringan untuk pengunjung baru:

Judul:
"Jangan Lewatkan Renungan Harian"

Isi:
"Dapatkan artikel dan renungan terbaru melalui WhatsApp Channel Grace Daily."

Tombol:

- Ikuti Channel

Popup hanya muncul sekali setiap 30 hari.

6. Tambahkan tracking analytics:

Event:

- whatsapp_channel_click
- whatsapp_channel_popup_open
- whatsapp_channel_follow_cta

7. Responsif:

- Mobile: tombol full width.
- Desktop: tombol inline dengan CTA lainnya.

8. Jangan mengubah fitur FCM dan email subscription yang sudah ada.

9. Buat komponen reusable:
   WhatsAppChannelButton

Props:

- variant
- size
- sourcePage

10. Dokumentasikan cara mengganti URL channel dari panel konfigurasi tanpa mengubah kode.

Implementasikan lengkap frontend, styling, analytics tracking, dan dokumentasi penggunaan.

Ikuti saluran Grace Daily di WhatsApp: https://whatsapp.com/channel/0029VbCUBJfG8l5A2qoOPN0w
