# Grace Daily

App Next.js untuk renungan harian Kristen, Alkitab online, AI pendeta, jurnal spiritual, komunitas doa, blog, dan membership.

## Jalankan Dev Server

Pastikan terminal berada di folder app, bukan di file `Masterplan_gracedaily` atau root repo.

```bash
cd "/Users/tius/Documents/Data Tius/renungan-life/grace-daily"
npm run dev
```

Jika Next menulis `Another next dev server is already running`, berarti server lama masih aktif. Buka `http://localhost:3000`, atau hentikan proses lama sesuai PID yang ditampilkan Next.

## Firebase

Isi `.env.local` dari `.env.example`.

Untuk bootstrap collection dan super-admin pertama, gunakan Firebase service account:

```bash
export GOOGLE_APPLICATION_CREDENTIALS="/absolute/path/service-account.json"
npm run seed:firestore -- --super-admin-uid=UID_FIREBASE_AUTH_KAMU
```

Collection yang dibuat:

- `admin_users/{uid}`
- `plans/{planId}`
- `daily_devotions/{slug}`
- `golden_verses/{slug}`
- `blog_posts/{slug}`
- `prayer_rooms/{roomId}`

Untuk memasukkan Alkitab AYT ke Firestore:

```bash
npm run seed:bible
```

Untuk uji kecil lebih dulu:

```bash
npm run seed:bible -- --limit-books=1 --limit-chapters=1
```

## AI

Fitur AI memakai endpoint `/api/ai`. Isi salah satu dari `OPENROUTER_API_KEY_BACKUP2`, `GEMINI_API_KEY`, atau `OPENAI_API_KEY` agar jawaban live aktif. `AI_PROVIDER` boleh diisi `deepseek`, `gemini`, atau `openai` untuk memilih prioritas; jika kosong, app memakai key yang tersedia dan fallback ke provider berikutnya. Tanpa key, app berjalan dalam mode demo.
