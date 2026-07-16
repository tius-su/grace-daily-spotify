BIBLE ENCYCLOPEDIA ARCHITECTURE V3
TUJUAN
Firebase Read turun >90%
Firebase Write turun >90%
Menghilangkan ketergantungan Firestore untuk konten publik
Mendukung ratusan ribu user
SEO aman dari Googlebot, Bingbot, Facebook crawler
Offline First Architecture
Cloudflare R2 sebagai Content Storage utama
Vercel sebagai Frontend + Cron
Firebase hanya untuk Auth dan Metadata

VERCEL STATIC STORAGE
Folder:
/public/data/
Bible Verse
/public/data/bible/
genesis.json
exodus.json
leviticus.json
...
revelation.json
Digunakan untuk:
Pembacaan ayat
Pencarian ayat
Referensi ayat
Tidak membaca Firestore.
Firebase hanya menyimpan backup Bible Verse.

CLOUDFLARE R2 PUBLIC
Bucket:
bible-public
Migrasi dari Firestore
Collection:
ensiklopedia_*
dipindahkan menjadi:
encyclopedia/
Tokoh
people/
contoh:
tokoh-paulus.json
tokoh-petrus.json
tokoh-abraham.json
Tempat
places/
Istilah
terms/
Kitab
books/
Kronologi
timeline/
bible-public
│
├── encyclopedia
│   │
│   ├── tokoh
│   │   ├── musa.json
│   │   ├── paulus.json
│   │   └── ...
│   │
│   ├── tempat
│   │   ├── yerusalem.json
│   │   ├── betlehem.json
│   │   └── ...
│   │
│   ├── kamus
│   │   ├── iman.json
│   │   ├── kasih.json
│   │   └── ...
│   │
│   ├── mukjizat
│   │   ├── air-menjadi-anggur.json
│   │   └── ...
│   │
│   ├── perumpamaan
│   │   ├── anak-hilang.json
│   │   └── ...
│   │
│   ├── kitab
│   │   ├── kejadian.json
│   │   ├── keluaran.json
│   │   └── ...
│   │
│   ├── kronologi
│   │   ├── penciptaan.json
│   │   ├── eksodus.json
│   │   └── ...
│   │
│   └── index.json

Blog
Migrasi:
blog_posts
ke:
articles/
article-001.json
article-002.json
index:
articles/index.json

Renungan Harian
Migrasi:
daily_devotion daily_reading devotion_generated
ke:
devotions/
2026-06-13.json
2026-06-14.json
latest.json

Lagu Rohani
Migrasi:
songs
ke:
songs/
songs-index.json

Ayat Emas
Migrasi:
golden_verse
ke:
golden-verses/

Share Pages
Migrasi:
share_pages
ke:
shared-pages/

Banner dan Ilustrasi
images/
banners/
illustrations/

CLOUDFLARE R2 PRIVATE
Bucket:
bible-private
Private Access Only
users/
{uid}/
favorites.json
bookmarks.json
notes.json
highlights.json
ai-history.json
sermon-history.json
reading-plan.json
search-history.json
prayer-history.json
cell-group-history.json
wall-post-history.json
draft-sermon.json
draft-article.json
metadata.json

FIREBASE
Tetap Digunakan
Authentication
users
subscriptions
admin_users
settings
fcm_tokens
backup_metadata
guest_limits
plans

Tidak Lagi Digunakan Untuk Konten
Hapus penggunaan Firestore pada:
ensiklopedia
blog_posts
daily_devotion
daily_reading
devotion_generated
songs
golden_verse
share_pages

INDEXEDDB
Storage utama user.
Collections:
user_profile
favorites
bookmarks
notes
highlights
search_history
reading_history
ai_history
pastoral_questions
sermon_assistant
sermon_history
cell_group_history
prayer_wall
draft_sermon
draft_article
reading_plan
devotion_cache
article_cache
encyclopedia_cache
offline_bible_cache

LOGIN FLOW
Firebase Auth
↓
Load Profile
↓
Load Subscription
↓
Check R2 Metadata
↓
Compare UpdatedAt
↓
Sync Latest Data
↓
Launch App

OFFLINE FIRST
Semua aktivitas user:
Favorit
Bookmark
Catatan
Tanya Pendeta
Pendamping Khotbah
Reading Plan
Riwayat AI
langsung masuk IndexedDB.
Contoh:
{ synced:false, updatedAt:"" }

AUTO SYNC
Trigger:
Login
App Open
Online kembali
Setiap 5 menit saat aktif
Flow:
IndexedDB
↓
Data Unsynced
↓
Upload ke R2 Private
↓
Update Metadata
↓
synced=true

CRON VERCEL
Artikel AI
00:05
Generate
↓
Upload langsung ke R2
↓
Update articles/index.json

Renungan Harian
00:10
Generate
↓
Upload langsung ke R2
↓
Update latest.json

Sinkronisasi Ensiklopedia
23:00
Cek seluruh category:
people
places
terms
books
timeline
Pastikan seluruh data Firestore sudah ada di R2.
Generate migration-report.json

Backup Metadata
23:30
Update:
backup_metadata
di Firebase.

FIRESTORE SECURITY
Bible Verse
Read Public
Write Admin Only
Users
Read Own Data
Write Own Data
Admin
Admin Only
Subscription
Read Own Subscription
Admin Write Only

CACHE STRATEGY
Latest JSON:
Cache 1 Jam
Article JSON:
Cache 30 Hari
Encyclopedia JSON:
Cache 30 Hari
Bible Verse JSON:
Cache 365 Hari
Gunakan:
Cache-Control
ETag
Stale-While-Revalidate

SEO
Googlebot
Bingbot
Facebook
WhatsApp Preview
Telegram Preview
harus membaca:
Vercel Static Files
atau
Cloudflare CDN
Jangan mengakses Firestore.

TARGET AKHIR
Firebase
├─ Auth
├─ Users
├─ Subscription
├─ Admin
├─ Settings
├─ FCM
└─ Metadata
Cloudflare R2 Public
├─ Encyclopedia
├─ People
├─ Places
├─ Terms
├─ Books
├─ Timeline
├─ Articles
├─ Devotions
├─ Songs
├─ Golden Verses
├─ Shared Pages
├─ Images
└─ Banners
Cloudflare R2 Private
└─ User Backup
Vercel Static
└─ Bible Verse
IndexedDB
└─ Aktivitas User
HASIL YANG DIHARAPKAN
Hampir seluruh konten publik dibaca dari R2
Bible Verse dibaca dari Vercel
Aktivitas user dibaca dari IndexedDB
Firebase hanya Auth dan Metadata
Cron menulis langsung ke R2
Backup manual admin tetap tersedia
Backup otomatis 23:00 berjalan
Siap untuk skala ratusan ribu user
Mengurangi risiko limit Firestore akibat crawler maupun trafik tinggi
=========================================
MIGRATION MONITORING & STORAGE STATUS
=========================================

Buat halaman Admin baru:

Admin
├─ Storage Status
├─ Migration Status
├─ Firebase Usage
├─ R2 Usage
└─ Sync Monitor

TUJUAN

Admin dapat melihat secara realtime data sedang dibaca dari:

- Firebase
- Cloudflare R2
- Vercel Static Files
- IndexedDB

tanpa harus membuka source code.

=========================================
STORAGE CONFIG
=========================================

Buat konfigurasi global:

storage-config.json

{
  "tokoh": "r2",
  "tempat": "r2",
  "kamus": "r2",
  "mukjizat": "firebase",
  "perumpamaan": "firebase",
  "kitab": "firebase",
  "kronologi": "firebase",
  "artikel": "r2",
  "renungan": "r2",
  "songs": "r2",
  "goldenVerse": "r2",
  "bibleVerse": "vercel"
}

Semua service harus membaca konfigurasi ini.

Contoh:

if(source === "r2"){
   return fetchFromR2();
}

if(source === "firebase"){
   return fetchFromFirestore();
}

if(source === "vercel"){
   return fetchStaticJson();
}

=========================================
ADMIN STORAGE STATUS
=========================================

Tampilkan:

Current Active Source

Tokoh           : R2
Tempat          : R2
Kamus           : R2
Mukjizat        : Firebase
Perumpamaan     : Firebase
Kitab           : Firebase
Kronologi       : Firebase
Artikel         : R2
Renungan        : R2
Songs           : R2
Golden Verse    : R2
Bible Verse     : Vercel

Gunakan badge warna:

Hijau   = R2
Biru    = Vercel
Kuning  = IndexedDB
Merah   = Firebase

=========================================
MIGRATION STATUS
=========================================

Tampilkan progress migrasi:

Tokoh
325 / 325
Status: Complete

Tempat
184 / 184
Status: Complete

Kamus
912 / 912
Status: Complete

Mukjizat
87 / 87
Status: Pending

Perumpamaan
53 / 53
Status: Pending

Kitab
66 / 66
Status: Pending

Kronologi
240 / 240
Status: Pending

=========================================
VALIDATION TOOL
=========================================

Buat tombol:

[ Validate Firebase vs R2 ]

Sistem melakukan:

1. Hitung jumlah dokumen Firebase
2. Hitung jumlah file JSON R2
3. Bandingkan
4. Generate report

Contoh:

{
  "category":"tokoh",
  "firebase":325,
  "r2":325,
  "status":"match"
}

Jika berbeda:

{
  "category":"tokoh",
  "firebase":325,
  "r2":320,
  "status":"error"
}

=========================================
SWITCH SOURCE
=========================================

Khusus Admin.

Tambahkan tombol:

[ Switch to Firebase ]
[ Switch to R2 ]

per kategori.

Contoh:

Tokoh
[ Firebase ]
[ R2 ]

Tempat
[ Firebase ]
[ R2 ]

Perubahan tanpa deploy ulang.

=========================================
NETWORK DEBUG
=========================================

Buat halaman debug:

Admin → Network Debug

Tampilkan request terakhir:

Source
URL
Response Time
Cache Hit/Miss

Contoh:

Tokoh
Source: R2
Response: 120ms
Cache: HIT

Bible Verse
Source: Vercel
Response: 30ms
Cache: HIT

=========================================
FIREBASE PROTECTION
=========================================

Tambahkan monitoring:

Firestore Reads Today
Firestore Writes Today

Warning jika:

Read > 70% quota

Warning jika:

Write > 70% quota

=========================================
FINAL MIGRATION CHECKLIST
=========================================

Migrasi dianggap selesai jika:

✓ Tokoh membaca dari R2
✓ Tempat membaca dari R2
✓ Kamus membaca dari R2
✓ Mukjizat membaca dari R2
✓ Perumpamaan membaca dari R2
✓ Kitab membaca dari R2
✓ Kronologi membaca dari R2
✓ Artikel membaca dari R2
✓ Renungan membaca dari R2
✓ Songs membaca dari R2
✓ Golden Verse membaca dari R2
✓ Bible Verse membaca dari Vercel
✓ Tidak ada request Firestore untuk konten publik
✓ Cron menulis langsung ke R2
✓ Backup otomatis berjalan
✓ Firebase hanya digunakan untuk Auth, Premium, Admin, Metadata

JANGAN menghapus collection Firebase lama sampai seluruh checklist di atas lulus dan stabil minimal 30 hari.
Vercel
├─ Bible Verse
├─ Static Assets

Cloudflare R2
├─ Tokoh
├─ Tempat
├─ Kamus
├─ Mukjizat
├─ Perumpamaan
├─ Kitab
├─ Kronologi
├─ Artikel AI
├─ Renungan Harian
├─ Lagu Rohani
├─ Golden Verse
├─ Banner
└─ Backup User

Firebase
├─ Auth
├─ Premium
├─ Admin
├─ Subscription
├─ Settings
└─ Metadata

IndexedDB
├─ Favorit
├─ Bookmark
├─ Catatan
├─ Riwayat AI
├─ Reading Plan
├─ Cache Ensiklopedia
├─ Cache Artikel
└─ Cache Renungan
_—--_—----------------++
Cron
 ↓
Cek seluruh category
 ↓
Tokoh
Tempat
Kamus
Mukjizat
Perumpamaan
Kitab
Kronologi
 ↓
Backup ke R2
 ↓
Generate report

