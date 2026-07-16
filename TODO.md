perbaiki gambar ke 2 / gambar illustrasi belum terbentuk masih berupa gambar banner / gambar fallback
pastikan gambar banner dan gambar ke 2 masuk kedalam PDF sekarang belum masuk.


-perbaiki Artikel lama yang sudah punya `illustrationUrl` lama berupa banner perlu diregenerate/force update agar URL berpindah ke folder `encyclopedia-illustrations`.

Buatkan :
- Perlu tombol admin atau script migrasi untuk force regenerate semua `illustrationUrl` lama yang masih mengarah ke `encyclopedia-banners/*-illustration.png`.

tambahkan untuk SEO di firebase pada :
DailyDevetions, blog post, bible ai pages, ai request, daily readings keyword, slug, title dan lainnya

### SEO di Firebase

field standar yang disarankan untuk semua koleksi konten:

```ts
seo: {
  title: string;
  description: string;
  keywords: string[];
  slug: string;
  canonicalPath: string;
  image?: string;
  publishedAt?: Timestamp;
  updatedAt?: Timestamp;
  schemaType?: "Article" | "BlogPosting" | "CreativeWork" | "FAQPage";
}
```

Koleksi yang perlu ditambahkan/dirapikan:
- `daily_devotions`
  - `title`, `slug/dateId`, `verseRef`, `seo.title`, `seo.description`, `seo.keywords`, `seo.image`, `seo.canonicalPath`
- `blog_posts`
  - `title`, `slug`, `excerpt`, `category`, `seo.title`, `seo.description`, `seo.keywords`, `seo.image`, `seo.canonicalPath`
- `bible_ai_pages`
  - `title`, `slug`, `mode`, `prompt/topic`, `seo.title`, `seo.description`, `seo.keywords`, `seo.canonicalPath`
- `ai_requests`
  - sebaiknya bukan halaman publik utama, tetapi bisa diberi `topic`, `mode`, `slug`, `summary`, dan `seoDraft` bila hasilnya dipromosikan menjadi halaman publik.
- `daily_readings`
  - `keyword`, `slug`, `title`, `description`, `seo.keywords`, `seo.canonicalPath`
- `ensiklopedia_cache`
  - sudah mulai ditambahkan `seo.title`, `seo.description`, `seo.keywords`, `seo.slug`, `seo.canonicalPath`, `seo.image`.

1. Buat helper `buildSeoFields()` agar format SEO konsisten.
2. Jalankan migrasi Firestore untuk dokumen lama.
3. Update `sitemap.ts` agar membaca canonical path dari field SEO.
4. Update metadata halaman detail agar memakai field `seo` bila tersedia.


- pastikan api key primary dan backup bekerja Untuk produksi, jangan bergantung pada satu provider saja. Minimal aktifkan:
  - primary: DeepSeek   - backup: OpenRouter
  - backup cepat: Groq
- Untuk gambar ilustrasi,gunakan  token huggingface sebagai backup tuliskan di env.local
token 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

- Tambahkan monitoring error provider per request agar terlihat provider mana yang sering gagal.

token huggingface
token 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

Tamabhkan Fitur fitur ini di artikel ensiklopedia
- Artikel terkait: tokoh/tempat/istilah yang punya relasi langsung.
- Daftar ayat referensi yang bisa diklik ke halaman Alkitab.
- Timeline untuk tokoh dan peristiwa.
- Peta lokasi untuk tempat Alkitab.
- Panel "Sumber dan batasan": jelaskan bahwa artikel dibatasi data Alkitab, bukan spekulasi tradisi.
- FAQ schema untuk SEO.
- Tombol "Laporkan koreksi" untuk user/admin review.


- Riwayat pencarian user.
- Bookmark artikel.
- Compare tokoh, contoh Musa vs Yosua.
- Glosarium istilah asli Ibrani/Yunani sederhana.
- Mode ringkas vs mendalam.
- Audio narasi dengan daftar bagian artikel.


- Admin review workflow sebelum artikel baru published.
- Confidence/source coverage score.
- Batch regenerate banner/illustration.
- Dashboard analytics: keyword populer, artikel paling dibuka, conversion popup paket.
- Export PDF dengan cover, daftar isi, banner, ilustrasi, dan watermark Grace Daily.

jalankan npm run build untuk meliat apakah ada error
tuliskan hasilnya disini