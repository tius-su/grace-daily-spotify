import { config } from "dotenv";
import { resolve } from "path";
import readline from "readline";

// 1. Load Environment Variables dari file .env proyek Next.js Anda
config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

/**
 * FUNGSI OTOMATIS: Mengubah Yahweh/Yehova menjadi TUHAN menggunakan Regex.
 * Menggunakan kata kunci case-insensitive agar aman dari variasi penulisan.
 */
function autoCorrectTuhan(text) {
  if (!text) return "";
  return text
    .replace(/\b(yahweh|yehova|jehova|jehovah)\b/gi, "TUHAN")
    // Mengantisipasi jika AI menulis "Tuhan" (huruf kecil) untuk pengganti Yahweh
    .replace(/\b(Tuhan)\b/g, "TUHAN"); 
}

async function askGroqTerminal(prompt) {
  const apiKey = process.env.GROQ_API_KEY;
  const model = "llama-3.1-8b-instant"; 

  if (!apiKey) {
    console.error("\n❌ Error: GROQ_API_KEY tidak ditemukan di file .env atau .env.local Anda.");
    process.exit(1);
  }

  const systemPromptText = `Kamu adalah seorang Ahli Linguistik Translatologi dan Konsultan Penerjemahan Alkitab standar Lembaga Alkitab Indonesia (LAI).
Tugas utamanya adalah membandingkan secara kritis Teks Sumber (WEB) dengan Teks Target (Terjemahan AI) berdasarkan Referensi Ayat yang diberikan.

PANDUAN EVALUASI:
1. JANGAN menceritakan isi Alkitab dari ingatanmu.
2. JANGAN PERNAH menyarankan mengubah nama manusia (seperti Yehuda, Yusuf, Musa, Peres) menjadi "TUHAN". Analisis nama manusia dengan teliti!
3. Jika pada Teks Terjemahan AI sudah menggunakan kata "TUHAN" (kapital semua) untuk menerjemahkan nama teofani/tetragrammaton, berikan nilai 100% pada Istilah Alkitab.

Berikan output penilaian dengan format terstruktur sebagai berikut:

Referensi:
[Tulis ulang referensi]

Nilai:
- Kesetaraan makna: [0-100%] + alasan singkat.
- Kelancaran bahasa: [0-100%] + analisis ketepatan tata bahasa Indonesia modern.
- Istilah Alkitab: [0-100%] + analisis laras bahasa Alkitab Kristen Indonesia standar LAI.

Rekomendasi & Perbaikan Istilah:
[Tunjukkan perbaikan kata khusus teologis saja jika ada. Jika teks sudah benar dan menggunakan istilah standar LAI, tulis: "✓ Teks sudah bersih dan sesuai standar LAI."]`;

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPromptText },
          { role: "user", content: prompt }
        ],
        temperature: 0.1, 
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error?.message || `HTTP Error ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "Konten kosong.";
  } catch (error) {
    throw new Error(`Gagal menghubungi API Groq: ${error.message}`);
  }
}

// Setup Interface Terminal Input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.clear();
console.log("====================================================");
console.log("🌅 GRACE DAILY — BIBLE TRANSLATION CRITIQUE TOOLS");
console.log("🤖 Mode: Auto-Correct TUHAN & Text Critique");
console.log("====================================================\n");

rl.question("📖 1. Masukkan Referensi (Contoh: Kejadian 4:6): ", (referensi) => {
  console.log("\n🇺🇸 2. Masukkan Teks Sumber / WEB (Inggris):");
  
  rl.question("   > ", (teksWeb) => {
    console.log("\n🇮🇩 3. Masukkan Teks Terjemahan AI (Indonesia):");
    
    rl.question("   > ", async (teksAiRaw) => {
      
      if (!referensi.trim() || !teksWeb.trim() || !teksAiRaw.trim()) {
        console.log("\n❌ Semua input wajib diisi!");
        rl.close();
        process.exit(0);
      }

      // PROSES OTOMATISASI: Memperbaiki teks input sebelum dikirim ke AI
      const teksAiCorrected = autoCorrectTuhan(teksAiRaw);

      console.log(`\n⚙️  [Sistem] Menjalankan pembersihan kata otomatis...`);
      if (teksAiRaw !== teksAiCorrected) {
        console.log(`✨ [Sistem] Berhasil mendeteksi dan mengubah otomatis kata Yahweh/Yehova menjadi "TUHAN"!`);
      } else {
        console.log(`👍 [Sistem] Tidak ditemukan kata Yahweh/Yehova yang melanggar baku.`);
      }

      console.log(`⏳ Sedang menghitung skor kualitas hasil akhir...`);
      
      const prompt = `Referensi:
${referensi}

WEB:
${teksWeb}

Terjemahan AI (Sudah Diproses Sistem):
${teksAiCorrected}

Tugas:
Bandingkan dua teks di atas berdasarkan parameter Nilai dan berikan Rekomendasi perbaikan istilah jika masih ada yang terlewat.`;

      try {
        const hasilReview = await askGroqTerminal(prompt);
        
        console.log("\n====================================================");
        console.log(`📊 HASIL EVALUASI & PELACAKAN PENERJEMAHAN`);
        console.log("====================================================\n");
        console.log(`📝 TEKS HASIL PERBAIKAN SISTEM:`);
        console.log(`"${teksAiCorrected}"\n`);
        console.log(hasilReview);
        console.log("\n====================================================");
      } catch (err) {
        console.error(`\n❌ Terjadi kesalahan: ${err.message}`);
      } finally {
        rl.close();
      }
    });
  });
});