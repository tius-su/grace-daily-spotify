import { readFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Load Environment & Firebase
for (const file of [resolve(".env.local"), resolve("../.env.local")]) {
    if (existsSync(file)) {
        readFileSync(file, "utf8").split(/\r?\n/).forEach(line => {
            const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
            if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
        });
    }
}
if (!getApps().length) initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, "utf8"))) });

async function check() {
    const db = getFirestore();
    // Mengambil data unik bookShort yang sudah berhasil masuk
    const snapshot = await db.collection("bible_verses").select("bookShort").get();
    const uploadedBooks = new Set();
    snapshot.forEach(doc => uploadedBooks.add(doc.data().bookShort));

    // Baca master file local
    const apiDir = existsSync(resolve("scripts")) ? resolve("scripts") : resolve("public/bible");
    const { books } = JSON.parse(readFileSync(join(apiDir, "ind_ayt", "books.json"), "utf8"));

    console.log(`\n📊 PROGRESS DATABASE ANDA:`);
    console.log(`===========================`);
    console.log(`Total kitab yang sudah masuk: ${uploadedBooks.size} dari 66 kitab.`);

    // Cari index kitab pertama yang belum masuk
    const nextBookIndex = books.findIndex(b => !uploadedBooks.has(b.id));

    if (nextBookIndex === -1) {
        console.log("🎉 Semua 66 kitab (Kejadian - Wahyu) sudah 100% masuk ke Firestore!");
    } else {
        console.log(`Kitab terakhir yang terisi: ${books[nextBookIndex - 1]?.name || 'Belum ada'}`);
        console.log(`👉 BESOK LANJUTKAN DENGAN PERINTAH:`);
        console.log(`\x1b[36mnode scripts/seeder-local.mjs --source=scripts --skip-books=${nextBookIndex}\x1b[0m\n`);
    }
}
check().catch(console.error);