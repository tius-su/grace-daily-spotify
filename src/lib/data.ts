export type Verse = {
  book: string;
  bookShort: string;
  chapter: number;
  verse: number;
  translation: string;
  text: string;
  themes: string[];
};

export type Plan = {
  name: string;
  price: string;
  durationDays: number;
  aiRequests: number;
  features: string[];
  allowedModes?: string[];
};

export const dailyVerse: Verse = {
  book: "Yohanes",
  bookShort: "JHN",
  chapter: 3,
  verse: 16,
  translation: "TB",
  text: "Karena begitu besar kasih Allah akan dunia ini, sehingga Ia telah mengaruniakan Anak-Nya yang tunggal.",
  themes: ["kasih", "iman", "keselamatan"],
};

export const features = [
  {
    title: "Pendeta",
    description:
      "Tanya jawab rohani, teologi praktis, dan pendampingan refleksi secara pastoral.",
  },
  {
    title: "Renungan Harian",
    description:
      "Renungan otomatis dari ayat harian, dilengkapi doa, pertanyaan refleksi, dan ringkasan singkat.",
  },
  {
    title: "Ayat Emas",
    description:
      "Koleksi ayat bertema kasih, iman, pengharapan, pengampunan, keluarga, dan kekuatan.",
  },
  {
    title: "Jurnal Spiritual",
    description:
      "Catat pergumulan, mood rohani, jawaban doa, dan bahan evaluasi pertumbuhan iman.",
  },
  {
    title: "PDF Devotional",
    description:
      "Siapkan bahan renungan pribadi, kelompok sel, atau keluarga dalam format siap bagikan.",
  },
  {
    title: "Komunitas Doa",
    description:
      "Ruang doa dan curhat dengan moderasi, privasi, dan dukungan awal.",
  },
  {
    title: "Grup Renungan",
    description:
      "Ruang diskusi ayat, saat teduh, dan sharing kesaksian rohani bersama saudara seiman.",
  },
];

export const plans: Plan[] = [
  {
    name: "Sahabat Grace Daily",
    price: "Rp0",
    durationDays: 36500,
    aiRequests: 5,
    features: [
      "Akses Alkitab & Renungan Online",
      "5 Kuota Tanya Pendeta AI / hari",
      "Fitur Dasar"
    ],
    allowedModes: ["daily-devotion", "bible-encyclopedia", "pastor"],
  },
  {
    name: "Mitra Sukarela",
    price: "Bebas",
    durationDays: 30,
    aiRequests: 50,
    features: [
      "Semua fitur Sahabat",
      "Akses Konseling Rohani AI mendalam",
      "Musik Rohani & Jurnal Spiritual",
      "Ekspor PDF",
      "Otomatis mensubsidi kuota untuk jemaat yang membutuhkan"
    ],
    allowedModes: [
      "daily-devotion", "devotional", "devotional_pdf", "pastor",
      "bible-study", "bible-encyclopedia", "song_recommendation",
      "sermon_guide", "export_pdf"
    ],
  },
];

export const blogCategories = [
  "Renungan",
  "Doa",
  "Keluarga",
  "Teologi",
  "Kesaksian",
  "Bible Study",
];

export const testimonials = [
  {
    name: "Maya",
    role: "Pemimpin komsel",
    quote:
      "Bahan renungan jadi lebih rapi, mudah dibagikan, dan tetap terasa personal untuk anggota komsel.",
  },
  {
    name: "Yosua",
    role: "Mahasiswa",
    quote:
      "Fitur tanya ayat membantu saya memahami konteks tanpa merasa sedang membaca bahan yang berat.",
  },
  {
    name: "Lina",
    role: "Ibu rumah tangga",
    quote:
      "Jurnal doa membuat saya bisa melihat kembali cara Tuhan menuntun dari hari ke hari.",
  },
];

export const songRecommendations = [
  {
    title: "Satu-Satunya yang Kuandalkan",
    artist: "Angel Pieters",
    url: "https://youtu.be/xwnBvaqC8DM?si=uIPImcn1IeEiE1iu",
  },
  {
    title: "Waktu Tuhan",
    artist: "NDC Worship",
    url: "https://youtu.be/inGJFNRyAwQ?si=DccjXNwXKld2G4NG",
  },
  {
    title: "Tetap Setia",
    artist: "Symphony Worship",
    url: "https://youtu.be/hMF8QmHTUzA?si=Rez84hHEHKzf9wVJ",
  },
  {
    title: "Bapa Engkau Sungguh Baik",
    artist: "Bambang Irwanto",
    url: "https://youtu.be/jxNEzCb-SFA?si=SwFetEKoFHNNLYBd",
  },
  {
    title: "Lingkupiku",
    artist: "Symphony Music",
    url: "https://youtu.be/KPmSWCeC6c0?si=0g3rbXSbLYOb_xYK",
  },
];
