# Panduan Lengkap Deployment ke Vercel

Proyek Next.js ini dirancang agar dapat dideploy ke Vercel secara mudah, lengkap dengan integrasi basis data Firebase Firestore, Cloudflare R2 untuk penyimpanan gambar, dan Vercel Cron Jobs untuk otomatisasi pembuatan renungan harian.

---

## 📋 Prasyarat Deployment
Sebelum melakukan deploy, pastikan Anda telah menyiapkan akun di layanan berikut:
1. **Vercel**: Untuk mendeploy aplikasi web.
2. **Firebase Console**: Untuk autentikasi pengguna dan basis data Firestore.
3. **Cloudflare R2** *(Opsional)*: Untuk penyimpanan CDN gambar ilustrasi harian.
4. **Layanan SMTP** *(Opsional)*: Untuk notifikasi email otomatis diskusi grup (seperti Mailgun, SendGrid, Titan, Gmail SMTP, dll).

---

## 🛠️ Langkah-Langkah Deployment

### Opsi A: Integrasi GitHub (Sangat Direkomendasikan)
Metode ini adalah cara termudah dan paling aman karena setiap kali Anda melakukan `git push` ke repositori, Vercel akan otomatis membangun ulang aplikasi (CI/CD).

1. Unggah proyek Anda ke repositori GitHub pribadi/publik.
2. Buka dashboard [Vercel](https://vercel.com) dan klik **Add New > Project**.
3. Hubungkan akun GitHub Anda dan pilih repositori proyek ini.
4. Pada bagian **Build & Development Settings**, biarkan default (Next.js preset).
5. Pada bagian **Environment Variables**, masukkan variabel lingkungan yang tercantum pada tabel di bawah ini.
6. Klik **Deploy**. Selesai!

---

### Opsi B: Menggunakan Vercel CLI (Deployment Cepat via Terminal)
Jika Anda ingin mendeploy langsung dari komputer Anda melalui baris perintah:

1. Buka Terminal dan masuk ke direktori `grace-daily`:
   ```bash
   cd "grace-daily"
   ```
2. Instal Vercel CLI secara global (jika belum):
   ```bash
   npm install -g vercel
   ```
3. Lakukan login ke akun Vercel Anda:
   ```bash
   vercel login
   ```
4. Hubungkan proyek dengan Vercel:
   ```bash
   vercel link
   ```
   *(Ikuti petunjuk di layar untuk membuat proyek baru atau menghubungkan ke proyek yang sudah ada)*
5. Tarik setelan environment variables terbaru:
   ```bash
   vercel env pull .env.vercel.local
   ```
6. Deploy ke lingkungan pengembangan (Preview):
   ```bash
   vercel
   ```
7. Deploy ke lingkungan produksi:
   ```bash
   vercel --prod
   ```

---

## 🔑 Konfigurasi Environment Variables (Variabel Lingkungan)
Anda wajib mengisi variabel berikut pada panel **Settings > Environment Variables** di Vercel Dashboard agar seluruh fitur aplikasi berfungsi normal:

### 1. Kredensial Firebase (Client & Server Admin SDK)
| Variabel Lingkungan | Deskripsi / Contoh Nilai |
| :--- | :--- |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Kunci API Firebase Client |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Domain Autentikasi Firebase (misal: `renungan-life.firebaseapp.com`) |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Project ID Firebase (misal: `renungan-life`) |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Bucket Storage Firebase (misal: `renungan-life.firebasestorage.app`) |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Messaging Sender ID dari setelan Firebase |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Application ID unik dari setelan aplikasi web Firebase |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path ke berkas service account key. Nilai default: `scripts/serviceAccountKey.json`. (Berkas kunci ini harus ada dalam repositori di folder `scripts` agar Admin SDK berjalan di Vercel). |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | **(Sangat Direkomendasikan)** Isi teks JSON utuh dari file service account key Anda (contoh: `{"type": "service_account", ...}`). Variabel ini akan otomatis diurai oleh serverless functions tanpa memerlukan berkas fisik di repositori Anda. |

### 2. Konfigurasi Cloudflare R2 (Penyimpanan Gambar Ilustrasi)
| Variabel Lingkungan | Deskripsi / Contoh Nilai |
| :--- | :--- |
| `R2_ACCOUNT_ID` | Account ID dari Cloudflare |
| `R2_ACCESS_KEY_ID` | Access Key ID untuk API R2 |
| `R2_SECRET_ACCESS_KEY` | Secret Access Key untuk API R2 |
| `R2_BUCKET_NAME` | Nama bucket tempat menyimpan gambar (misal: `renungan-life`) |
| `NEXT_PUBLIC_R2_PUBLIC_URL` | Domain akses publik Cloudflare R2 (contoh: `https://pub-xxx.r2.dev`) |

### 3. Konfigurasi Notifikasi Email Diskusi Grup (SMTP)
| Variabel Lingkungan | Deskripsi / Contoh Nilai |
| :--- | :--- |
| `SMTP_HOST` | Host server SMTP (contoh: `smtp.mailgun.org` atau `smtp.gmail.com`) |
| `SMTP_PORT` | Port SMTP (gunakan `587` untuk TLS atau `465` untuk SSL) |
| `SMTP_USER` | Username SMTP login email Anda |
| `SMTP_PASSWORD` | Kata sandi SMTP login email Anda |
| `SMTP_FROM` | Alamat email pengirim (contoh: `Grace Daily <no-reply@domain.com>`) |
| `NEXT_PUBLIC_APP_URL` | Domain situs web utama Anda untuk tautan tombol email (contoh: `https://grace-daily.vercel.app`) |

### 4. Integrasi Payment Gateway (Midtrans)
| Variabel Lingkungan | Deskripsi / Contoh Nilai |
| :--- | :--- |
| `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY` | Client Key dari dashboard sandbox / production Midtrans |
| `MIDTRANS_SERVER_KEY` | Server Key dari dashboard sandbox / production Midtrans |
| `NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION` | `true` jika menggunakan mode produksi, `false` jika sandbox |

### 5. Integrasi API Kecerdasan Buatan (AI Gateway)
| Variabel Lingkungan | Deskripsi / Contoh Nilai |
| :--- | :--- |
| `DEEPSEEK_API_KEY` | API Key dari DeepSeek AI atau provider router Anda |
| `GROQ_API_KEY` | API Key dari Groq Cloud |
| `GROQ_MODEL` | Model AI Groq yang dipakai (contoh: `llama-3.3-70b-versatile`) |

---

## ⏰ Konfigurasi Otomatisasi Cron Jobs
Aplikasi ini menggunakan Vercel Cron Jobs untuk membuat renungan harian secara otomatis. Setelan ini sudah dikonfigurasi dalam berkas [vercel.json](file:///Users/tius/Documents/Data Tius/renungan-life/grace-daily/vercel.json):
```json
{
  "crons": [
    {
      "path": "/api/cron/daily-devotion",
      "schedule": "0 22 * * *"
    }
  ]
}
```
*Catatan: Jadwal `0 22 * * *` setara dengan pukul 05:00 WIB (GMT+7) setiap pagi, waktu yang ideal bagi pengguna untuk mendapatkan renungan harian terbaru.*

### Pengamanan Endpoint Cron
Untuk mengamankan cron endpoint agar tidak dipicu secara acak oleh pihak luar:
1. Buat variabel lingkungan `CRON_SECRET` di Vercel Dashboard dengan nilai acak (string panjang).
2. Vercel akan otomatis menyertakan variabel `CRON_SECRET` di header otorisasi saat memicu cronjob `/api/cron/daily-devotion`.
