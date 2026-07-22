export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

const SYSTEM_PROMPT = `Kamu adalah "Grace Daily Chatbot", asisten AI Kristen yang ramah, hangat, berpendidikan teologi Alkitabiah, empatik, dan penuh kasih.

ATURAN WAJIB LINK NAVIGASI:
Setiap kali pengguna bertanya atau kamu menyebutkan tentang fitur, renungan, artikel, ensiklopedia, Alkitab, doa, atau halaman aplikasi lainnya, kamu WAJIB menyertakan link markdown yang dapat diklik secara langsung!

Gunakan format Markdown Link berikut:
- 🕊️ **Renungan Harian**: 👉 [Buka Renungan Hari Ini](/renungan) (tersedia Renungan Pagi, Siang, dan Malam)
- 📖 **Alkitab Digital**: 👉 [Baca Alkitab Digital](/alkitab)
- 📅 **Rencana Baca Alkitab**: 👉 [Lihat Rencana Baca Alkitab](/rencana-baca)
- 🏛️ **Ensiklopedia Kristen**: 👉 [Buka Ensiklopedia Kristen](/ensiklopedia)
- 📰 **Blog & Artikel Rohani**: 👉 [Baca Artikel & Berita Terbaru](/blog)
- 🙏 **Komunitas & Tembok Doa**: 👉 [Kirim & Lihat Tembok Doa](/komunitas-doa)
- 📝 **Jurnal Spiritual**: 👉 [Buka Jurnal Spiritual](/jurnal)
- ⛪ **Tanya Pendeta**: 👉 [Konsultasi Tanya Pendeta](/tanya-pendeta)
- 📜 **Asisten Khotbah**: 👉 [Buka Asisten Khotbah](/sermon-assistant)
- 👥 **Grup Renungan**: 👉 [Buka Grup Renungan](/grup-renungan)
- 💖 **Donasi & Dukungan**: 👉 [Dukung Pelayanan](/donasi)

CONTOH RESPONS:
Jika user bertanya: "Saya mau baca renungan hari ini" atau "di mana artikel terbaru?"
Jawab secara singkat & hangat, lalu WAJIB berikan link langsung yang bisa diklik:
"Syalom! Kamu bisa langsung membaca renungan harian terbaru (Pagi, Siang, dan Malam) di sini: 👉 [Buka Renungan Hari Ini](/renungan)"

Tugas utama kamu:
1. Membantu memberikan refleksi renungan harian, doa Kristen yang menguatkan, pemahaman ayat Alkitab, dan wawasan rohani.
2. Membimbing pengguna untuk menavigasi aplikasi dengan memberikan LINK LANGSUNG YANG BISA DIKLIK ([Nama Fitur](/rute)).
3. Memberikan rekomendasi lagu rohani jika diminta.
4. Menjaga batas-batas pastoral: Jawab secara ringkas (maksimal 2-3 paragraf pendek), hangat, sopan, menguatkan, dan berpatokan pada kebenaran Alkitab. Untuk krisis berat atau kesehatan mental mendesak, arahkan dengan kasih untuk berkonsultasi dengan pendeta lokal atau profesional kesehatan.
5. Gunakan bahasa Indonesia yang baik, santun, dan mudah dipahami.`;

type ApiProviderResult = {
  answer: string;
  provider: string;
};

async function callOpenRouter(apiKey: string, messages: ChatMessage[], modelOverride?: string): Promise<string> {
  const model = modelOverride || process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash";
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://grace-daily.app",
      "X-Title": "Grace Daily Chatbot",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
      max_tokens: 550,
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`OpenRouter HTTP ${response.status}: ${errText.slice(0, 100)}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("OpenRouter mengembalikan respons kosong.");
  return content;
}

async function callMistral(apiKey: string, messages: ChatMessage[]): Promise<string> {
  const model = process.env.MISTRAL_MODEL || "mistral-small-latest";
  const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
      max_tokens: 550,
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`Mistral HTTP ${response.status}: ${errText.slice(0, 100)}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("Mistral mengembalikan respons kosong.");
  return content;
}

/**
 * Executes Chatbot response generation with automatic failover:
 * Primary: OPENROUTER_API_KEY_BACKUP2
 * Backup 1: OPENROUTER_API_KEY_SECOND_BACKUP
 * Backup 2: MISTRAL_API_KEY
 */
export async function askChatbotAI(userHistory: ChatMessage[]): Promise<ApiProviderResult> {
  // Truncate history to last 6 messages to keep tokens low
  const recentHistory = userHistory.slice(-6);

  const formattedMessages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...recentHistory,
  ];

  const errors: string[] = [];

  // Key 1: Primary OpenRouter (OPENROUTER_API_KEY_BACKUP2)
  const primaryKey = process.env.OPENROUTER_API_KEY_BACKUP2 || process.env.OPENROUTER_API_KEY;
  if (primaryKey) {
    try {
      const answer = await callOpenRouter(primaryKey, formattedMessages);
      return { answer, provider: "openrouter-primary" };
    } catch (e: any) {
      console.warn("[Chatbot AI] Primary OpenRouter failed:", e.message);
      errors.push(`Primary OR: ${e.message}`);
    }
  }

  // Key 2: Backup OpenRouter (OPENROUTER_API_KEY_SECOND_BACKUP)
  const backupKey1 = process.env.OPENROUTER_API_KEY_SECOND_BACKUP || process.env.OPENROUTER_API_KEY_BACKUP;
  if (backupKey1 && backupKey1 !== primaryKey) {
    try {
      const answer = await callOpenRouter(backupKey1, formattedMessages);
      return { answer, provider: "openrouter-backup" };
    } catch (e: any) {
      console.warn("[Chatbot AI] Second OpenRouter failed:", e.message);
      errors.push(`Backup OR: ${e.message}`);
    }
  }

  // Key 3: Mistral AI (MISTRAL_API_KEY)
  const mistralKey = process.env.MISTRAL_API_KEY;
  if (mistralKey) {
    try {
      const answer = await callMistral(mistralKey, formattedMessages);
      return { answer, provider: "mistral" };
    } catch (e: any) {
      console.warn("[Chatbot AI] Mistral failed:", e.message);
      errors.push(`Mistral: ${e.message}`);
    }
  }

  throw new Error(`Semua layanan AI sedang mengalami kendala. Detail: ${errors.join(" | ")}`);
}
