


Ubah sesion rekomendasi lagu rohani di landing pages - Rekomendasi Musik
Lagu Rohani Penyejuk Jiwa

File json youtubeid = /Users/tius/Documents/DataTius/renungan-life/grace-daily/public/youtube-id.json

Dan backup dari firebase ke R2 atau json di simpan di local - vercel

Buat fitur "Rekomendasi Lagu Rohani" pada aplikasi web menggunakan Next.js, TypeScript, Tailwind CSS, dan Firebase.

Layout Desktop

Buat section dengan 2 kolom:

Kolom Kiri (70%)

Tampilkan video YouTube aktif menggunakan iframe embed.

Saat halaman pertama kali dibuka, tampilkan lagu pertama dari daftar rekomendasi.

Video dapat langsung diputar.

Responsive dengan rasio 16:9.

Menampilkan:

Judul lagu

Penyanyi

Bahasa

Tema lagu



Contoh:

+--------------------------------------+
|                                      |
|          YouTube Player              |
|                                      |
+--------------------------------------+

What A Beautiful Name
Hillsong Worship
English • Worship


---

Kolom Kanan (30%)

Tampilkan daftar rekomendasi lagu.

Setiap item berisi:

Thumbnail YouTube

Judul lagu

Penyanyi

Bahasa

Tema


Contoh:

[Thumbnail] What A Beautiful Name
            Hillsong Worship

[Thumbnail] Oceans
            Hillsong UNITED

[Thumbnail] Amazing Grace
            Various


---

Interaksi

Ketika pengguna mengklik lagu pada daftar rekomendasi:

1. Video pada kolom kiri langsung berubah.


2. Judul, penyanyi, bahasa, dan tema ikut berubah.


3. Lagu yang sedang aktif diberi highlight.


4. Tidak perlu reload halaman.


5. Gunakan React State.

6. Gunakan Chace 



Contoh:

const [selectedSong, setSelectedSong] = useState(songs[0]);

Ketika item diklik:

setSelectedSong(song);

Player otomatis berubah menjadi:

https://www.youtube.com/embed/${selectedSong.youtubeVideoId}


---

Data Source

Ambil data dari Firebase Collection:

worship_songs

Struktur data:

{
  "id": "id_001",
    "title": "Bapa Yang Kekal",
    "titlePinyin": "",
    "titleIndonesia": "Bapa Yang Kekal",
    "artist": "True Worshippers",
    "language": "Indonesia",
    "theme": "Worship",
    "youtubeVideoId": "",
    "featured": false,
    "active": true,
    "views": 0,
    "plays": 0,
    "favoriteCount": 0,
    "sortOrder": 1

}


---

Rekomendasi Harian

Tampilkan maksimal 6 lagu rekomendasi setiap hari.

Algoritma:

const today = Math.floor(Date.now() / 86400000);

const recommendations = songs
  .slice(today % songs.length)
  .concat(songs.slice(0, today % songs.length))
  .slice(0, 6);

Sehingga setiap hari 6 lagu yang ditampilkan berubah otomatis tanpa perlu mengubah database.


---

Mobile Responsive

Pada layar mobile:

YouTube Player

Lagu Aktif

Daftar Rekomendasi

Layout berubah menjadi 1 kolom.


---

Tambahan

Gunakan YouTube Embed API.

Lazy loading thumbnail.

Skeleton loading saat data Firebase belum selesai dimuat.

Error handling jika video tidak ditemukan.

Gunakan TypeScript yang ketat.

Gunakan Tailwind CSS modern.

Buat komponen:

RecommendationPlayer.tsx

RecommendationList.tsx

RecommendationSection.tsx


Optimalkan performa agar hanya me-render ulang komponen yang berubah.

Backup ke R2
