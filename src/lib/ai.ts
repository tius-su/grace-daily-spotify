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

type AiProvider = "deepseek" | "gemini" | "openai" | "groq" | "openrouter" | "nvidia" | "mistral";

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
  | "bible-commentary"
  | "journal-insights";

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
    "Kamu memberikan tafsiran rohani Kristen ayat-per-ayat yang solid, terpercaya, dan berpusat pada Kristus (Christ-centered). Jawab dalam bahasa Indonesia dengan bahasa yang mendalam dan relevan.",
  "journal-insights":
    "Kamu adalah konselor rohani Kristen yang empatik, hangat, dan bijaksana. Analisis catatan jurnal dan suasana hati (mood) pengguna untuk memberikan wawasan rohani (insights), dorongan iman yang lembut, serta rekomendasi ayat Alkitab pendukung yang menguatkan. Jawab dalam bahasa Indonesia dengan pendekatan pastoral."
};

function getApiKeysForProvider(provider: "deepseek" | "openai" | "groq" | "openrouter" | "nvidia" | "mistral"): string[] {
  const keys: string[] = [];
  if (provider === "openrouter") {
    if (process.env.OPENROUTER_API_KEY) keys.push(process.env.OPENROUTER_API_KEY);
    if (process.env.OPENROUTER_API_KEY_BACKUP) keys.push(process.env.OPENROUTER_API_KEY_BACKUP);
    if (process.env.OPENROUTER_API_KEY_SECOND_BACKUP) keys.push(process.env.OPENROUTER_API_KEY_SECOND_BACKUP);
    if (process.env.OPENROUTER_API_KEY_BACKUP2) keys.push(process.env.OPENROUTER_API_KEY_BACKUP2);
    if (process.env.OPENROUTER_API_KEY_BACKUP3) keys.push(process.env.OPENROUTER_API_KEY_BACKUP3);
    if (process.env.DEEPSEEK_API_KEY && process.env.DEEPSEEK_API_KEY.startsWith("sk-or-")) {
      keys.push(process.env.DEEPSEEK_API_KEY);
    }
  } else if (provider === "deepseek") {
    if (process.env.DEEPSEEK_API_KEY && !process.env.DEEPSEEK_API_KEY.startsWith("sk-or-")) {
      keys.push(process.env.DEEPSEEK_API_KEY);
    }
    if (process.env.DEEPSEEK_API_KEY_BACKUP) keys.push(process.env.DEEPSEEK_API_KEY_BACKUP);
  } else if (provider === "groq") {
    if (process.env.GROQ_API_KEY) keys.push(process.env.GROQ_API_KEY);
    if (process.env.GROQ_API_KEY_BACKUP) keys.push(process.env.GROQ_API_KEY_BACKUP);
    if (process.env.GROQ_API_KEY_BACKUP2) keys.push(process.env.GROQ_API_KEY_BACKUP2);
  } else if (provider === "openai") {
    if (process.env.OPENAI_API_KEY) keys.push(process.env.OPENAI_API_KEY);
    if (process.env.OPENAI_API_KEY_BACKUP) keys.push(process.env.OPENAI_API_KEY_BACKUP);
  } else if (provider === "nvidia") {
    if (process.env.NVIDIA_API_KEY) keys.push(process.env.NVIDIA_API_KEY);
    if (process.env.NVIDIA_API_KEY_BACKUP) keys.push(process.env.NVIDIA_API_KEY_BACKUP);
  } else if (provider === "mistral") {
    if (process.env.MISTRAL_API_KEY) keys.push(process.env.MISTRAL_API_KEY);
  }
  return Array.from(new Set(keys)).filter(Boolean);
}

function configuredProviders(): AiProvider[] {
  const preferredRaw = process.env.AI_PROVIDER?.toLowerCase() as AiProvider | undefined;
  const providers: AiProvider[] = [];

  // Jika DEEPSEEK_API_KEY pakai prefix sk-or- (OpenRouter), remap preferred ke openrouter
  const deepseekKey = process.env.DEEPSEEK_API_KEY || "";
  const deepseekIsOpenRouter = deepseekKey.startsWith("sk-or-");

  const preferred: AiProvider | undefined =
    preferredRaw === "deepseek" && deepseekIsOpenRouter ? "openrouter" : preferredRaw;

  // Helper to verify if a provider has at least one configured API key
  const hasKey = (prov: AiProvider): boolean => {
    if (prov === "openrouter") {
      return !!(
        process.env.OPENROUTER_API_KEY ||
        process.env.OPENROUTER_API_KEY_BACKUP ||
        process.env.OPENROUTER_API_KEY_SECOND_BACKUP ||
        process.env.OPENROUTER_API_KEY_BACKUP2 ||
        process.env.OPENROUTER_API_KEY_BACKUP3 ||
        deepseekIsOpenRouter
      );
    }
    if (prov === "deepseek") {
      return !!(
        (process.env.DEEPSEEK_API_KEY && !deepseekIsOpenRouter) ||
        process.env.DEEPSEEK_API_KEY_BACKUP
      );
    }
    if (prov === "groq") {
      return !!(
        process.env.GROQ_API_KEY ||
        process.env.GROQ_API_KEY_BACKUP ||
        process.env.GROQ_API_KEY_BACKUP2
      );
    }
    if (prov === "openai") {
      return !!(process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_BACKUP);
    }
    if (prov === "nvidia") {
      return !!(process.env.NVIDIA_API_KEY || process.env.NVIDIA_API_KEY_BACKUP);
    }
    if (prov === "mistral") {
      return !!process.env.MISTRAL_API_KEY;
    }
    if (prov === "gemini") {
      return !!process.env.GEMINI_API_KEY;
    }
    return false;
  };

  // Push preferred provider ONLY if it has configured keys
  if (preferred && hasKey(preferred)) {
    providers.push(preferred);
  }

  // Push backup providers in priority order
  if (hasKey("groq")) providers.push("groq");
  if (hasKey("deepseek")) providers.push("deepseek");
  if (hasKey("openrouter")) providers.push("openrouter");
  if (hasKey("mistral")) providers.push("mistral");
  if (hasKey("nvidia")) providers.push("nvidia");
  if (hasKey("gemini")) providers.push("gemini");
  if (hasKey("openai")) providers.push("openai");

  return Array.from(new Set(providers));
}


function getSystemPrompt(mode: AiMode, language: string = "id"): string {
  const basePrompt = modePrompts[mode] || "";
  if (language === "en") {
    return `${basePrompt}\n\nIMPORTANT: Please respond in English. When quoting or referring to scripture, use the World English Bible (WEB) translation.`;
  }
  if (language === "zh") {
    return `${basePrompt}\n\nIMPORTANT: Please respond in Chinese (Simplified/简体中文). When quoting or referring to scripture, use the Chinese Union Version (CUV/和合本) translation.`;
  }
  return `${basePrompt}\n\nPENTING: Jawab dalam Bahasa Indonesia. Saat mengutip atau merujuk ayat Alkitab, gunakan World English Bible Terjemahan AI (WEB-AI) / Alkitab bahasa Indonesia.`;
}

function maxTokensForMode(mode: AiMode) {
  return mode === "sermon_guide" ? 2400 : mode === "devotional_pdf" ? 1800 : 1000;
}

async function askOpenAiCompatible(
  provider: "deepseek" | "openai" | "groq" | "openrouter" | "nvidia" | "mistral",
  mode: AiMode,
  prompt: string,
  language: string = "id",
) {
  const apiKeys = getApiKeysForProvider(provider);
  if (!apiKeys.length) {
    throw new Error(`${provider.toUpperCase()}_API_KEY belum diisi.`);
  }

  const errors: string[] = [];

  for (let i = 0; i < apiKeys.length; i++) {
    const apiKey = apiKeys[i];
    try {
      const isOpenRouter = provider === "openrouter" || (provider === "deepseek" && apiKey.startsWith("sk-or-"));
      const apiUrl =
        provider === "openai"
          ? "https://api.openai.com/v1/chat/completions"
          : provider === "groq"
            ? "https://api.groq.com/openai/v1/chat/completions"
            : provider === "nvidia"
              ? "https://integrate.api.nvidia.com/v1/chat/completions"
              : provider === "mistral"
                ? "https://api.mistral.ai/v1/chat/completions"
                : isOpenRouter
                  ? "https://openrouter.ai/api/v1/chat/completions"
                  : "https://api.deepseek.com/chat/completions";

      const model =
        provider === "openai"
          ? process.env.OPENAI_MODEL ?? "gpt-4o-mini"
          : provider === "groq"
            ? process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile"
            : provider === "nvidia"
              ? process.env.NVIDIA_MODEL ?? "meta/llama-3.3-70b-instruct"
              : provider === "mistral"
                ? process.env.MISTRAL_MODEL ?? "mistral-small-latest"
                : provider === "openrouter"
                  ? process.env.OPENROUTER_MODEL ?? "google/gemini-2.5-flash"
                  : process.env.DEEPSEEK_MODEL ?? (isOpenRouter ? "deepseek/deepseek-chat" : "deepseek-chat");

      const messages: DeepSeekMessage[] = [
        { role: "system", content: getSystemPrompt(mode, language) },
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
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error("Content empty");
      }
      return content;
    } catch (e: any) {
      const errMsg = `Key ${i + 1} failed: ${e.message}`;
      console.warn(`[AI Key Failed] ${provider} - ${errMsg}`);
      errors.push(errMsg);
    }
  }

  throw new Error(`Semua API Key ${provider} gagal: ${errors.join(" | ")}`);
}

async function askGemini(mode: AiMode, prompt: string, language: string = "id") {
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
          parts: [{ text: getSystemPrompt(mode, language) }],
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

export async function askDeepSeek(mode: AiMode, prompt: string, language: string = "id") {
  const providers = configuredProviders();

  if (!providers.length) {
    return {
      answer:
        "Mode demo aktif. Tambahkan minimal satu API key AI yang valid (contoh: GROQ_API_KEY, OPENROUTER_API_KEY, MISTRAL_API_KEY, atau NVIDIA_API_KEY) ke environment variables untuk mengaktifkan fitur ini.",
      provider: "demo",
    };
  }

  const errors: string[] = [];

  for (const provider of providers) {
    try {
      const answer =
        provider === "gemini"
          ? await askGemini(mode, prompt, language)
          : await askOpenAiCompatible(provider, mode, prompt, language);

      return {
        answer: answer ?? "Maaf, jawaban belum tersedia. Coba ulangi sebentar lagi.",
        provider,
        providerErrors: errors,
      };
    } catch (error: any) {
      const message = `${provider}: ${error.message}`;
      console.warn(`[AI provider failed] ${message}`);
      errors.push(message);
    }
  }

  return {
    answer: `Terjadi kesalahan sistem: ${errors.join(" | ")}`,
    provider: "error",
    providerErrors: errors,
  };
}
