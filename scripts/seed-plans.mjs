import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { existsSync, readFileSync } from "fs";
import path from "path";

// Define the new donation/partnership plans (2 CARDS)
const plans = [
  {
    name: "Sahabat Grace Daily",
    price: "0", // Hilangkan Rp
    durationDays: 36500, // selamanya
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
    price: "Bebas", // Hilangkan Rp
    durationDays: 30, // Proporsional
    aiRequests: 50, // Proporsional
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

async function main() {
  const keyPath = path.join(process.cwd(), "scripts", "serviceAccountKey.json");
  if (!existsSync(keyPath)) {
    console.error("scripts/serviceAccountKey.json not found.");
    process.exit(1);
  }

  initializeApp({ credential: cert(JSON.parse(readFileSync(keyPath, "utf8"))) });
  const db = getFirestore();

  console.log("Seeding plans to Firestore...");

  for (const plan of plans) {
    const planRef = db.collection("plans").doc(plan.name);
    await planRef.set(plan, { merge: true });
    console.log(`Plan saved: ${plan.name}`);
  }

  console.log("Done.");
}

main().catch(console.error);
