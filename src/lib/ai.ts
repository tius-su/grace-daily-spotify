type DeepSeekMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type DeepSeekResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

type AiProvider = "deepseek" | "gemini" | "openai" | "groq" | "openrouter";

export type AiMode =
  | "pastor"
  | "devotional"
  | "devotional_pdf"
  | "prayer"
  | "counseling"
  | "bible-study"
  | "song_recommendation"
  | "sermon_guide"
  | "bible-explanation"
  | "bible-commentary";

const modePrompts: Record<AiMode, string> = {
  pastor:
    "Kamu adalah pendeta virtual Kristen yang hangat, alkitabiah, dan berhati-hati. Jawab dalam bahasa Indonesia, jangan menggantikan pendeta/gembala lokal, dan arahkan pengguna mencari bantuan profesional untuk krisis.",
  devotional:
    "Kamu menulis renungan harian Kristen yang singkat, reflektif, praktis, dan berpusat pada Injil. Sertakan ayat, refleksi, aplikasi, dan doa.",
  devotional_pdf:
    "Kamu menyusun bahan PDF devotional Kristen yang siap dicetak atau dibagikan. Buat format berbeda dari renungan singkat: halaman judul, tujuan bahan, ayat utama, pembukaan, bahan renungan 5-7 bagian, panduan diskusi keluarga/komsel, latihan refleksi, ruang catatan, doa respons, dan penutup. Jawab dalam bahasa Indonesia dengan struktur rapi.",
  prayer:
    "Kamu membantu menyusun doa Kristen yang lembut, jujur, dan penuh pengharapan. Jangan menghakimi pengguna.",
  counseling:
    "Kamu memberi dukungan rohani awal secara empatik. Jangan memberi diagnosis medis atau psikologis. Untuk bahaya diri, kekerasan, atau krisis, arahkan pengguna menghubungi layanan darurat dan pemimpin rohani terpercaya.",
  "bible-study":
    "Kamu membantu studi Alkitab dengan konteks, struktur, tema utama, pertanyaan diskusi, dan aplikasi yang bertanggung jawab.",
  "song_recommendation":
    "Kamu adalah asisten musik rohani Kristen. Berikan rekomendasi 3-5 lagu penyembahan/rohani (Indonesia atau Inggris) sesuai topik/pergumulan pengguna. Untuk setiap lagu, sebutkan Judul, Penyanyi/Band, alasan singkat mengapa cocok. Wajib sertakan link pencarian YouTube menggunakan format Markdown link persis seperti ini: [Buka di YouTube](https://www.youtube.com/results?search_query=JUDUL+LAGU+PENYANYI). Format spasi pada judul lagu dan penyanyi di dalam URL diganti dengan tanda plus (+).",
  "sermon_guide":
    "Kamu membantu ketua komsel, pendeta, dan pelayan firman menyusun panduan pengajaran Kristen yang mendalam, praktis, dan siap dipakai. Jawab dalam bahasa Indonesia dengan struktur rapi. Wajib sertakan: judul, tujuan pengajaran, ayat utama, minimal 8 ayat pendukung, latar belakang teks, konteks historis singkat, ide besar, penjelasan teologis yang bertanggung jawab, outline khotbah 3-5 poin, naskah pengantar, transisi antar poin, contoh kasus nyata dalam keluarga/pekerjaan/gereja, minimal 3 ilustrasi kehidupan sehari-hari, pertanyaan diskusi komsel yang menggali hati, aplikasi praktis untuk pribadi/keluarga/komunitas, ajakan respons, doa penutup, dan catatan pastoral yang tidak menghakimi.",
  "bible-explanation":
    "Kamu menjelaskan ayat Alkitab Kristen secara mendalam, mencakup konteks historis, makna teologis, dan penerapan praktis dalam kehidupan sehari-hari. Jawab dalam bahasa Indonesia dengan bahasa yang hangat, mudah dipahami, dan pastoral.",
  "bible-commentary":
    "Kamu memberikan tafsiran rohani Kristen ayat-per-ayat yang solid, terpercaya, dan berpusat pada Kristus (Christ-centered). Jawab dalam bahasa Indonesia dengan bahasa yang mendalam dan relevan."
};

function configuredProviders(): AiProvider[] {
  const preferred = process.env.AI_PROVIDER?.toLowerCase() as AiProvider | undefined;
  const providers: AiProvider[] = [];

  if (preferred && ["deepseek", "gemini", "openai", "groq", "openrouter"].includes(preferred)) {
    providers.push(preferred);
  }

  if (process.env.DEEPSEEK_API_KEY) providers.push("deepseek");
  if (process.env.GEMINI_API_KEY) providers.push("gemini");
  if (process.env.OPENAI_API_KEY) providers.push("openai");
  if (process.env.GROQ_API_KEY) providers.push("groq");
  
  // Backup/always-available OpenRouter
  providers.push("openrouter");

  return Array.from(new Set(providers));
}

function maxTokensForMode(mode: AiMode) {
  return mode === "sermon_guide" ? 2400 : mode === "devotional_pdf" ? 1800 : 1000;
}

async function askOpenAiCompatible(
  provider: "deepseek" | "openai" | "groq" | "openrouter",
  mode: AiMode,
  prompt: string,
) {
  const apiKey =
    provider === "openrouter"
      ? process.env.OPENROUTER_API_KEY
      : (provider === "deepseek"
        ? process.env.DEEPSEEK_API_KEY
        : provider === "openai"
          ? process.env.OPENAI_API_KEY
          : process.env.GROQ_API_KEY);

  if (!apiKey) {
    throw new Error(`${provider.toUpperCase()}_API_KEY belum diisi.`);
  }

  const isOpenRouter = provider === "openrouter" || (provider === "deepseek" && apiKey.startsWith("sk-or-"));
  const apiUrl =
    provider === "openai"
      ? "https://api.openai.com/v1/chat/completions"
      : provider === "groq"
        ? "https://api.groq.com/openai/v1/chat/completions"
        : isOpenRouter
          ? "https://openrouter.ai/api/v1/chat/completions"
          : "https://api.deepseek.com/chat/completions";

  const model =
    provider === "openai"
      ? process.env.OPENAI_MODEL ?? "gpt-4o-mini"
      : provider === "groq"
        ? process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile"
        : provider === "openrouter"
          ? process.env.OPENROUTER_MODEL ?? "google/gemini-2.5-flash"
          : process.env.DEEPSEEK_MODEL ?? (isOpenRouter ? "deepseek/deepseek-chat" : "deepseek-chat");

  const messages: DeepSeekMessage[] = [
    { role: "system", content: modePrompts[mode] },
    { role: "user", content: prompt },
  ];

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(isOpenRouter ? { "HTTP-Referer": "https://grace-daily.app", "X-Title": "Grace Daily" } : {}),
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.72,
      max_tokens: maxTokensForMode(mode),
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message ?? `HTTP Error ${response.status}`);
  }

  const data = (await response.json()) as DeepSeekResponse;
  return data.choices?.[0]?.message?.content;
}

async function askGemini(mode: AiMode, prompt: string) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY belum diisi.");
  }

  const model = process.env.GEMINI_MODEL ?? "gemini-1.5-flash";
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: modePrompts[mode] }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.72,
          maxOutputTokens: maxTokensForMode(mode),
        },
      }),
    },
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message ?? `HTTP Error ${response.status}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts
    ?.map((part: { text?: string }) => part.text ?? "")
    .join("")
    .trim();
}

export async function askDeepSeek(mode: AiMode, prompt: string) {
  const providers = configuredProviders();

  if (!providers.length) {
    return {
      answer:
        "Mode demo aktif. Tambahkan DEEPSEEK_API_KEY, GEMINI_API_KEY, atau OPENAI_API_KEY untuk mengaktifkan fitur ini. Untuk saat ini: bacalah ayat hari ini, tulis satu hal yang kamu syukuri, lalu tutup dengan doa singkat.",
      provider: "demo",
    };
  }

  const errors: string[] = [];

  for (const provider of providers) {
    try {
      const answer =
        provider === "gemini"
          ? await askGemini(mode, prompt)
          : await askOpenAiCompatible(provider, mode, prompt);

      return {
        answer: answer ?? "Maaf, jawaban belum tersedia. Coba ulangi sebentar lagi.",
        provider,
      };
    } catch (error: any) {
      errors.push(`${provider}: ${error.message}`);
    }
  }

  return {
    answer: `Terjadi kesalahan sistem: ${errors.join(" | ")}`,
    provider: "error",
  };
}
