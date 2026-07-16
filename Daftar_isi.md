Buat halaman "Daftar Isi Ensiklopedia Alkitab" untuk website Grace Daily.

Tab daftar isi ada di halaman ensiklopedia

Tujuan:
- Memudahkan pengguna menjelajahi seluruh ensiklopedia.
- SEO friendly.
- Mobile friendly.
- Mirip konsep Wikipedia tetapi dengan desain modern.

Struktur halaman:

1. Hero Section
- Judul: "Daftar Isi Ensiklopedia Alkitab"
- Deskripsi singkat:
  "Jelajahi tokoh, tempat, istilah, mukjizat, perumpamaan, kitab, dan kronologi Alkitab secara lengkap."

2. Search Bar
- Pencarian real-time.
- Bisa mencari lintas kategori.
- Menampilkan hasil instan saat mengetik.

3. Daftar Kategori

Tampilkan kategori berikut:

📖 Tokoh
📍 Tempat
📚 Kamus Istilah
🔥 Mukjizat
📜 Perumpamaan
📕 Kitab
🕰️ Kronologi

4. Isi Setiap Kategori

Setiap kategori dapat di-expand/collapse.

Contoh:

TOKOH (1.250)

A
- Aaron
- Absalom
- Abraham
- Adam

B
- Barabas
- Barnabas
- Bartimeus

C
- ...

TEMPAT (320)

A
- Antiokhia

B
- Babel
- Betlehem

C
- ...

5. Pengurutan

- Data harus otomatis diurutkan berdasarkan huruf A-Z.
- Huruf yang tidak memiliki data tidak ditampilkan.
- Kelompokkan berdasarkan huruf pertama.
- Gunakan localeCompare untuk pengurutan.

Contoh:

const grouped = items
  .sort((a,b) => a.title.localeCompare(b.title))
  .reduce(...)

6. Tampilan Desktop

- Sidebar kiri:
  - Daftar kategori
  - Statistik jumlah artikel

- Konten kanan:
  - Daftar A-Z kategori yang dipilih

7. Tampilan Mobile

- Kategori tampil sebagai accordion.
- Daftar A-Z berada di dalam accordion.
- Optimalkan untuk scrolling cepat.

8. SEO

Setiap item harus berupa link statis:

/ensiklopedia/tokoh/abraham
/ensiklopedia/tempat/yerusalem
/ensiklopedia/kamus/farisi

Tambahkan:
- Breadcrumb
- Schema.org BreadcrumbList
- Internal linking

9. Pagination

Jika isi list  kategori lebih dari 30 item:
- Lazy loading atau infinite scroll.
- Tetap mempertahankan grouping A-Z.

10. Statistik

Tampilkan jumlah data per kategori:

Tokoh (1250)
Tempat (320)
Kamus (840)
Mukjizat (95)
Perumpamaan (52)
Kitab (66)
Kronologi (180)

11. Data Source

Gunakan Firebase Firestore.

Collection:
encyclopedia

Field:
- slug
- title
- category
- summary
- imageUrl
- updatedAt

Ambil data berdasarkan category lalu urutkan title ASC (A-Z).

12. UI Style

- Bersih dan modern.
- Mirip Wikipedia tetapi lebih elegan.
- Menggunakan Tailwind CSS.
- Card ringan.
- Sticky sidebar.
- Dark mode support.
- Mobile-first responsive.