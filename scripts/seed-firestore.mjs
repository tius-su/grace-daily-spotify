import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

function loadEnv() {
  for (const file of [resolve(".env.local"), resolve("../.env.local")]) {
    if (!existsSync(file)) {
      continue;
    }

    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);

      if (!match || process.env[match[1]]) {
        continue;
      }

      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  }
}

function readArg(name) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((value) => value.startsWith(prefix));
  return arg?.slice(prefix.length);
}

function serviceAccount() {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const file = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (json) {
    return JSON.parse(json);
  }

  if (file && existsSync(file)) {
    return JSON.parse(readFileSync(file, "utf8"));
  }

  throw new Error(
    "Tambahkan FIREBASE_SERVICE_ACCOUNT_JSON atau GOOGLE_APPLICATION_CREDENTIALS untuk seed Firestore.",
  );
}

function initAdmin() {
  if (getApps().length) {
    return;
  }

  initializeApp({
    credential: cert(serviceAccount()),
  });
}

const plans = [
  {
    id: "free",
    name: "Free",
    price: 0,
    durationDays: 7,
    aiRequests: 10,
    features: ["Ayat harian", "Renungan dasar", "Jurnal pribadi"],
    active: true,
  },
  {
    id: "premium",
    name: "Premium",
    price: 49000,
    durationDays: 30,
    aiRequests: 300,
    features: ["Pendeta", "Konseling rohani", "Export PDF", "Musik rohani"],
    active: true,
  },
  {
    id: "komunitas",
    name: "Komunitas",
    price: 149000,
    durationDays: 30,
    aiRequests: 1200,
    features: ["Admin komunitas", "Paket manual", "Blog kategori", "Dashboard user"],
    active: true,
  },
];

const devotions = [
  {
    id: "daily-yohanes-3-16",
    title: "Kasih yang Mendahului",
    verseRef: "Yohanes 3:16",
    status: "published",
    body:
      "Kasih Allah bukan respons terhadap kebaikan manusia, tetapi inisiatif Allah yang mencari dan menyelamatkan.",
    prayer:
      "Tuhan, ajar aku menerima kasih-Mu dan membagikannya dengan rendah hati hari ini.",
  },
];

const blogPosts = [
  {
    id: "saat-doa-terasa-sunyi",
    title: "Saat Doa Terasa Sunyi",
    category: "Doa",
    status: "published",
    excerpt:
      "Keheningan bukan selalu tanda Tuhan jauh. Kadang itu undangan untuk belajar mendengar dengan lebih jujur.",
    body:
      "Bawalah kejujuranmu kepada Tuhan. Mazmur menunjukkan bahwa doa boleh dimulai dari keluhan dan berakhir dalam pengharapan.",
  },
  {
    id: "membaca-mazmur-ketika-lelah",
    title: "Membaca Mazmur Ketika Lelah",
    category: "Renungan",
    status: "published",
    excerpt:
      "Mazmur memberi bahasa bagi iman yang sedang menangis, berharap, dan kembali percaya.",
    body:
      "Ketika kata-kata habis, Mazmur menolong kita meminjam bahasa doa dari umat Tuhan sepanjang zaman.",
  },
];

const goldenVerses = [
  {
    id: "golden-jhn-3-16",
    reference: "Yohanes 3:16",
    text:
      "Karena Allah sangat mengasihi dunia ini, Ia memberikan Anak-Nya yang tunggal supaya setiap orang yang percaya kepada-Nya tidak binasa, melainkan memperoleh hidup yang kekal.",
    themes: ["kasih", "keselamatan", "iman"],
    translation: "AYT",
  },
  {
    id: "golden-psa-23-1",
    reference: "Mazmur 23:1",
    text: "TUHAN adalah gembalaku, aku tidak akan kekurangan.",
    themes: ["pemeliharaan", "penghiburan"],
    translation: "AYT",
  },
];

const prayerRooms = [
  {
    id: "umum",
    name: "Doa Umum",
    description: "Pokok doa umum yang aman dibagikan ke komunitas.",
    moderation: "manual",
  },
  {
    id: "keluarga",
    name: "Keluarga",
    description: "Doa untuk relasi, pengampunan, dan pemulihan keluarga.",
    moderation: "manual",
  },
];

async function setCollection(db, collectionName, docs) {
  const batch = db.batch();

  for (const item of docs) {
    const ref = db.collection(collectionName).doc(item.id);
    batch.set(
      ref,
      {
        ...item,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  }

  await batch.commit();
  console.log(`Seeded ${collectionName}: ${docs.length} docs`);
}

async function main() {
  loadEnv();
  initAdmin();

  const db = getFirestore();
  const superAdminUid =
    readArg("super-admin-uid") ?? process.env.SUPER_ADMIN_UID;

  if (superAdminUid) {
    await db.collection("admin_users").doc(superAdminUid).set(
      {
        uid: superAdminUid,
        role: "super-admin",
        permissions: ["*"],
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    console.log(`Seeded admin_users/${superAdminUid}`);
  } else {
    console.log("Lewati admin_users: isi SUPER_ADMIN_UID atau --super-admin-uid=UID.");
  }

  await setCollection(db, "plans", plans);
  await setCollection(db, "daily_devotions", devotions);
  await setCollection(db, "blog_posts", blogPosts);
  await setCollection(db, "golden_verses", goldenVerses);
  await setCollection(db, "prayer_rooms", prayerRooms);

  console.log("Firestore bootstrap selesai.");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
