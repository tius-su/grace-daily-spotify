// Cloudflare Worker for Grace Daily AI Gateway
// Handles AI requests, chaining providers, and backing up history to R2.

const MODE_PROMPTS = {
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
  song_recommendation:
    "Kamu adalah asisten musik rohani Kristen. Berikan rekomendasi 3-5 lagu penyembahan/rohani (Indonesia atau Inggris) sesuai topik/pergumulan pengguna. Untuk setiap lagu, sebutkan Judul, Penyanyi/Band, alasan singkat mengapa cocok. Wajib sertakan link pencarian YouTube menggunakan format Markdown link persis seperti ini: [Buka di YouTube](https://www.youtube.com/results?search_query=JUDUL+LAGU+PENYANYI). Format spasi pada judul lagu dan penyanyi di dalam URL diganti dengan tanda plus (+).",
  sermon_guide:
    "Kamu membantu ketua komsel, pendeta, dan pelayan firman menyusun panduan pengajaran Kristen yang mendalam, praktis, dan siap dipakai. Jawab dalam bahasa Indonesia dengan struktur rapi. Wajib sertakan: judul, tujuan pengajaran, ayat utama, minimal 8 ayat pendukung, latar belakang teks, konteks historis singkat, ide besar, penjelasan teologis yang bertanggung jawab, outline khotbah 3-5 poin, naskah pengantar, transisi antar poin, contoh kasus nyata dalam keluarga/pekerjaan/gereja, minimal 3 ilustrasi kehidupan sehari-hari, pertanyaan diskusi komsel yang menggali hati, aplikasi praktis untuk pribadi/keluarga/komunitas, ajakan respons, doa penutup, dan catatan pastoral yang tidak menghakimi.",
  "bible-explanation":
    "Kamu menjelaskan ayat Alkitab Kristen secara mendalam, mencakup konteks historis, makna teologis, dan penerapan praktis dalam kehidupan sehari-hari. Jawab dalam bahasa Indonesia dengan bahasa yang hangat, mudah dipahami, dan pastoral.",
  "bible-commentary":
    "Kamu memberikan tafsiran rohani Kristen ayat-per-ayat yang solid, terpercaya, dan berpusat pada Kristus (Christ-centered). Jawab dalam bahasa Indonesia dengan bahasa yang mendalam dan relevan.",
  "journal-insights":
    "Kamu adalah konselor rohani Kristen yang empatik, hangat, dan bijaksana. Analisis catatan jurnal dan suasana hati (mood) pengguna untuk memberikan wawasan rohani (insights), dorongan iman yang lembut, serta rekomendasi ayat Alkitab pendukung yang menguatkan. Jawab dalam bahasa Indonesia dengan pendekatan pastoral."
};

function maxTokensForMode(mode) {
  return mode === "sermon_guide" ? 2400 : mode === "devotional_pdf" ? 1800 : 1000;
}

// Helper to handle CORS headers
function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
    "Access-Control-Max-Age": "86400",
  };
}

// Simple Base64Url decode helper
function base64UrlDecode(str) {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  return atob(base64);
}

// Verify Firebase ID Token
// Since Firebase Auth tokens are standard JWTs signed by Google, we can verify them using Web Crypto
let jwksCache = null;
let jwksCacheTime = 0;

async function getGoogleJwks() {
  const now = Date.now();
  if (jwksCache && now - jwksCacheTime < 3600000) {
    return jwksCache;
  }
  const res = await fetch("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com");
  if (!res.ok) {
    throw new Error("Failed to fetch Google JWKS");
  }
  const jwks = await res.json();
  jwksCache = jwks;
  jwksCacheTime = now;
  return jwks;
}

async function verifyFirebaseToken(token, projectId = "renungan-life") {
  if (!token) return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const header = JSON.parse(base64UrlDecode(parts[0]));
    const payload = JSON.parse(base64UrlDecode(parts[1]));

    // Check expiration
    const nowSecs = Math.floor(Date.now() / 1000);
    if (payload.exp < nowSecs) {
      console.warn("Firebase token expired");
      return null;
    }

    // Check audience and issuer
    if (payload.aud !== projectId || payload.iss !== `https://securetoken.google.com/${projectId}`) {
      console.warn("Invalid Firebase token claims: audience or issuer mismatch");
      return null;
    }

    // Verify signature using the public key from JWKS
    const jwks = await getGoogleJwks();
    const keyInfo = jwks.keys.find((key) => key.kid === header.kid);
    if (!keyInfo) {
      console.warn("JWK key info not found for kid:", header.kid);
      return null;
    }

    // Import JWK to Web Crypto
    const publicKey = await crypto.subtle.importKey(
      "jwk",
      keyInfo,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"]
    );

    // Verify signature
    const textEncoder = new TextEncoder();
    const dataBuffer = textEncoder.encode(`${parts[0]}.${parts[1]}`);
    const signatureBytes = Uint8Array.from(atob(parts[2].replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

    const isValid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", publicKey, signatureBytes, dataBuffer);
    if (!isValid) {
      console.warn("JWT Signature verification failed");
      return null;
    }

    return payload; // contains uid, email, etc.
  } catch (err) {
    console.error("Error verifying token:", err);
    return null;
  }
}

function getSystemPrompt(mode, language = "id") {
  const basePrompt = MODE_PROMPTS[mode] || "";
  if (language === "en") {
    return `${basePrompt}\n\nIMPORTANT: Please respond in English. When quoting or referring to scripture, use the World English Bible (WEB) translation.`;
  }
  if (language === "zh") {
    return `${basePrompt}\n\nIMPORTANT: Please respond in Chinese (Simplified/简体中文). When quoting or referring to scripture, use the Chinese Union Version (CUV/和合本) translation.`;
  }
  return `${basePrompt}\n\nPENTING: Jawab dalam Bahasa Indonesia. Saat mengutip atau merujuk ayat Alkitab, gunakan World English Bible Terjemahan AI (WEB-AI) / Alkitab bahasa Indonesia.`;
}

// AI Call Helpers
async function askOpenAiCompatible(provider, mode, prompt, apiKey, modelName, language = "id") {
  const apiUrl =
    provider === "openai"
      ? "https://api.openai.com/v1/chat/completions"
      : provider === "groq"
        ? "https://api.groq.com/openai/v1/chat/completions"
        : provider === "nvidia"
          ? "https://integrate.api.nvidia.com/v1/chat/completions"
          : provider === "mistral"
            ? "https://api.mistral.ai/v1/chat/completions"
            : "https://openrouter.ai/api/v1/chat/completions";

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(provider === "openrouter" ? { "HTTP-Referer": "https://grace-daily.app", "X-Title": "Grace Daily" } : {}),
    },
    body: JSON.stringify({
      model: modelName,
      messages: [
        { role: "system", content: getSystemPrompt(mode, language) },
        { role: "user", content: prompt },
      ],
      temperature: 0.72,
      max_tokens: maxTokensForMode(mode),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`[${provider.toUpperCase()}] HTTP Error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error(`[${provider.toUpperCase()}] Empty response content.`);
  }
  return content;
}

async function askGemini(mode, prompt, apiKey, modelName, language = "id") {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
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
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`[GEMINI] HTTP Error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim();

  if (!content) {
    throw new Error("[GEMINI] Empty response content.");
  }
  return content;
}

export default {
  async fetch(request, env, ctx) {
    // Handle CORS Options preflight request
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(request),
      });
    }

    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed. Use POST." }), {
        status: 405,
        headers: { "Content-Type": "application/json", ...corsHeaders(request) },
      });
    }

    let mode = "pastor";
    let prompt = "";
    let token = "";
    let language = "id";
    let userId = "guest";
    let requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    let bibleContext = null;

    try {
      const body = await request.json();
      mode = body.mode || "pastor";
      prompt = body.prompt || "";
      token = body.token || "";
      language = body.language || "id";
      bibleContext = body.bibleContext || null;

      // Extract Auth Header token if body token is empty
      const authHeader = request.headers.get("Authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.substring(7);
      }
    } catch (e) {
      return new Response(JSON.stringify({ error: "Invalid JSON payload." }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders(request) },
      });
    }

    if (!prompt.trim()) {
      return new Response(JSON.stringify({ error: "Prompt is required." }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders(request) },
      });
    }

    if (!MODE_PROMPTS[mode]) {
      return new Response(JSON.stringify({ error: "Invalid AI mode." }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders(request) },
      });
    }

    // Token verification (resilient: failures won't block)
    if (token) {
      const decoded = await verifyFirebaseToken(token);
      if (decoded) {
        userId = decoded.uid;
      }
    }

    // 1. Gather all API keys and configure priorities
    // Providers: groq -> backup groq -> deepseek (openrouter model) -> openrouter -> backup openrouter -> mistral -> nvidia -> gemini -> openai
    const providersQueue = [];

    // Groq Priority
    if (env.GROQ_API_KEY) {
      providersQueue.push({
        provider: "groq",
        key: env.GROQ_API_KEY,
        model: env.GROQ_MODEL || "llama-3.3-70b-versatile",
      });
    }
    if (env.GROQ_API_KEY_BACKUP) {
      providersQueue.push({
        provider: "groq",
        key: env.GROQ_API_KEY_BACKUP,
        model: env.GROQ_MODEL || "llama-3.3-70b-versatile",
      });
    }

    // DeepSeek (via OpenRouter)
    if (env.OPENROUTER_API_KEY) {
      providersQueue.push({
        provider: "openrouter",
        key: env.OPENROUTER_API_KEY,
        model: "deepseek/deepseek-chat", // Deepseek V3 model
      });
    }

    // OpenRouter (standard)
    if (env.OPENROUTER_API_KEY) {
      providersQueue.push({
        provider: "openrouter",
        key: env.OPENROUTER_API_KEY,
        model: env.OPENROUTER_MODEL || "google/gemini-2.5-flash",
      });
    }
    if (env.OPENROUTER_API_KEY_BACKUP) {
      providersQueue.push({
        provider: "openrouter",
        key: env.OPENROUTER_API_KEY_BACKUP,
        model: env.OPENROUTER_MODEL || "google/gemini-2.5-flash",
      });
    }
    if (env.OPENROUTER_API_KEY_SECOND_BACKUP) {
      providersQueue.push({
        provider: "openrouter",
        key: env.OPENROUTER_API_KEY_SECOND_BACKUP,
        model: env.OPENROUTER_MODEL || "google/gemini-2.5-flash",
      });
    }

    // Mistral API
    if (env.MISTRAL_API_KEY) {
      providersQueue.push({
        provider: "mistral",
        key: env.MISTRAL_API_KEY,
        model: env.MISTRAL_MODEL || "mistral-small-latest",
      });
    }

    // Nvidia API
    if (env.NVIDIA_API_KEY) {
      providersQueue.push({
        provider: "nvidia",
        key: env.NVIDIA_API_KEY,
        model: env.NVIDIA_MODEL || "meta/llama-3.3-70b-instruct",
      });
    }
    if (env.NVIDIA_API_KEY_BACKUP) {
      providersQueue.push({
        provider: "nvidia",
        key: env.NVIDIA_API_KEY_BACKUP,
        model: env.NVIDIA_MODEL || "meta/llama-3.3-70b-instruct",
      });
    }

    // Gemini API
    if (env.GEMINI_API_KEY) {
      providersQueue.push({
        provider: "gemini",
        key: env.GEMINI_API_KEY,
        model: env.GEMINI_MODEL || "gemini-1.5-flash",
      });
    }

    // OpenAI API
    if (env.OPENROUTER_API_KEY_BACKUP) {
      providersQueue.push({
        provider: "openai",
        key: env.OPENROUTER_API_KEY_BACKUP,
        model: env.OPENAI_MODEL || "gpt-4o-mini",
      });
    }

    // Fallback if no keys configured
    if (providersQueue.length === 0) {
      return new Response(
        JSON.stringify({
          answer:
            "Mode demo aktif. Hubungkan kunci API di Cloudflare Worker untuk mendapatkan respon langsung.",
          provider: "demo",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders(request) },
        }
      );
    }

    // 2. Chaining AI providers execution
    let answer = "";
    let activeProvider = "";
    const errors = [];

    for (const item of providersQueue) {
      try {
        if (item.provider === "gemini") {
          answer = await askGemini(mode, prompt, item.key, item.model, language);
        } else {
          answer = await askOpenAiCompatible(item.provider, mode, prompt, item.key, item.model, language);
        }
        activeProvider = item.provider;
        break; // Success! Break the loop
      } catch (err) {
        const errMsg = `${item.provider.toUpperCase()} (${item.model}): ${err.message}`;
        console.warn("[AI Provider failed]", errMsg);
        errors.push(errMsg);
      }
    }

    // If all providers fail
    if (!answer) {
      return new Response(
        JSON.stringify({
          error: "Semua provider AI gagal memproses permintaan.",
          details: errors,
        }),
        {
          status: 502,
          headers: { "Content-Type": "application/json", ...corsHeaders(request) },
        }
      );
    }

    const payloadResult = {
      answer,
      provider: activeProvider,
      requestId,
      userId,
      providerErrors: errors,
      biblePage: null, // client will handle results parsing if needed
    };

    // 3. Save to Cloudflare R2 bucket directly (On-the-fly R2 sync)
    if (env.R2_BUCKET) {
      try {
        const fileKey = `ai_requests/${userId}/${requestId}.json`;
        const contentStr = JSON.stringify({
          ...payloadResult,
          mode,
          prompt,
          bibleContext,
          createdAt: new Date().toISOString(),
        });

        await env.R2_BUCKET.put(fileKey, contentStr, {
          httpMetadata: {
            contentType: "application/json",
            cacheControl: "public, max-age=300",
          },
        });
        console.log(`Saved AI history to R2: ${fileKey}`);
      } catch (r2Err) {
        console.error("Failed to save AI request log to R2 bucket:", r2Err);
      }
    }

    return new Response(JSON.stringify(payloadResult), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders(request) },
    });
  },
};
