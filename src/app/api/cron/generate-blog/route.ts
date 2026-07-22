import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { getAdminDb } from "@/lib/server/firebase-admin";
import { sendEmail } from "@/lib/server/email";
import { verifyAdmin } from "@/lib/server/auth";
import { sendPushNotification } from "@/lib/server/push-notification";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120; // 2 minutes — needed for AI generation and email blast

function slugify(text: string) {
  return text
    .toString()
    .toLowerCase()
    .replace(/\s+/g, "-") // Replace spaces with -
    .replace(/[^\w\-]+/g, "") // Remove all non-word chars
    .replace(/\-\-+/g, "-") // Replace multiple - with single -
    .replace(/^-+/, "") // Trim - from start
    .replace(/-+$/, ""); // Trim - from end
}

function jakartaDayKey(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date);
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/<[^>]*>/g, " ")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function bodyHash(body: string) {
  return createHash("sha256").update(normalizeText(body)).digest("hex");
}

const articleVerses = [
  { ref: "Yohanes 3:16", theme: "kasih Allah yang menyelamatkan" },
  { ref: "Mazmur 23:1", theme: "Tuhan sebagai gembala yang memelihara" },
  { ref: "Filipi 4:6", theme: "doa di tengah kekhawatiran" },
  { ref: "Roma 8:28", theme: "Allah bekerja dalam segala sesuatu" },
  { ref: "Yesaya 41:10", theme: "keberanian karena penyertaan Tuhan" },
  { ref: "Matius 6:33", theme: "mencari Kerajaan Allah lebih dahulu" },
  { ref: "Amsal 3:5", theme: "percaya kepada Tuhan dengan segenap hati" },
  { ref: "Yeremia 29:11", theme: "pengharapan dalam rancangan Allah" },
  { ref: "Mazmur 46:2", theme: "Allah tempat perlindungan" },
  { ref: "Matius 11:28", theme: "kelegaan bagi yang letih" },
  { ref: "2 Korintus 12:9", theme: "kasih karunia dalam kelemahan" },
  { ref: "Mazmur 119:105", theme: "firman sebagai terang jalan" },
  { ref: "Yosua 1:9", theme: "keteguhan hati dalam panggilan" },
  { ref: "1 Petrus 5:7", theme: "menyerahkan kekhawatiran" },
  { ref: "Kolose 3:23", theme: "bekerja seperti untuk Tuhan" },
  { ref: "Galatia 5:22-23", theme: "buah Roh dalam hidup sehari-hari" },
  { ref: "Ibrani 11:1", theme: "iman yang memegang pengharapan" },
  { ref: "Mazmur 121:1-2", theme: "pertolongan dari Tuhan" },
  { ref: "Ratapan 3:22-23", theme: "rahmat Tuhan yang baru setiap pagi" },
  { ref: "Efesus 2:8", theme: "keselamatan oleh kasih karunia" },
  { ref: "Yakobus 1:5", theme: "hikmat dari Allah" },
  { ref: "Mikha 6:8", theme: "keadilan, kesetiaan, dan kerendahan hati" },
  { ref: "1 Tesalonika 5:16-18", theme: "sukacita, doa, dan syukur" },
  { ref: "Yesaya 40:31", theme: "kekuatan baru bagi yang menanti Tuhan" },
  { ref: "Mazmur 34:19", theme: "Tuhan dekat kepada yang patah hati" },
  { ref: "Roma 12:2", theme: "pembaruan budi" },
  { ref: "Yohanes 14:27", theme: "damai sejahtera Kristus" },
  { ref: "Mazmur 37:5", theme: "menyerahkan hidup kepada Tuhan" },
  { ref: "Filipi 4:13", theme: "kekuatan di dalam Kristus" },
  { ref: "2 Timotius 1:7", theme: "roh kekuatan, kasih, dan ketertiban" },
  { ref: "Matius 5:14-16", theme: "menjadi terang dunia" },
  { ref: "Roma 5:8", theme: "kasih Kristus bagi orang berdosa" },
  { ref: "1 Yohanes 4:18", theme: "kasih yang mengusir ketakutan" },
  { ref: "Mazmur 27:1", theme: "Tuhan terang dan keselamatan" },
  { ref: "Ibrani 4:16", theme: "menghadap takhta kasih karunia" },
  { ref: "2 Korintus 5:17", theme: "ciptaan baru di dalam Kristus" },
  { ref: "Efesus 6:10", theme: "kuat di dalam Tuhan" },
  { ref: "Yakobus 4:8", theme: "mendekat kepada Allah" },
  { ref: "Mazmur 139:23-24", theme: "hati yang diperiksa Tuhan" },
  { ref: "Lukas 9:23", theme: "memikul salib setiap hari" },
  { ref: "Yohanes 15:5", theme: "tinggal di dalam Kristus" },
  { ref: "Roma 15:13", theme: "pengharapan oleh kuasa Roh Kudus" },
  { ref: "1 Korintus 13:4-7", theme: "kasih yang sabar dan murah hati" },
  { ref: "Mazmur 19:15", theme: "perkataan dan renungan yang berkenan" },
  { ref: "Amsal 16:3", theme: "menyerahkan pekerjaan kepada Tuhan" },
  { ref: "Yesaya 26:3", theme: "damai bagi hati yang teguh" },
  { ref: "Matius 28:19-20", theme: "hidup dalam amanat agung" },
  { ref: "Kisah Para Rasul 1:8", theme: "menjadi saksi oleh kuasa Roh" },
  { ref: "Roma 10:17", theme: "iman timbul dari pendengaran firman" },
  { ref: "2 Korintus 4:16", theme: "manusia batin diperbarui" },
  { ref: "Galatia 2:20", theme: "hidup oleh iman kepada Kristus" },
  { ref: "Efesus 4:32", theme: "mengampuni seperti Allah mengampuni" },
  { ref: "Filipi 1:6", theme: "Allah menyelesaikan pekerjaan baik" },
  { ref: "Kolose 3:2", theme: "memikirkan perkara yang di atas" },
  { ref: "1 Timotius 4:12", theme: "teladan dalam perkataan dan kasih" },
  { ref: "Ibrani 12:1-2", theme: "berlari dengan mata tertuju kepada Yesus" },
  { ref: "Yakobus 1:22", theme: "menjadi pelaku firman" },
  { ref: "1 Petrus 2:9", theme: "identitas umat kepunyaan Allah" },
  { ref: "Wahyu 21:4", theme: "pengharapan pemulihan akhir" },
  { ref: "Mazmur 90:12", theme: "hati yang bijaksana menghitung hari" },
];

function articleVerseForDay(dayKey: string, offset = 0) {
  const seed = dayKey
    .split("")
    .reduce((total, char) => total + char.charCodeAt(0), 0);

  return articleVerses[(seed + offset) % articleVerses.length];
}

function parseJSONContent(content: string) {
  let cleaned = content.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(json)?/i, "").replace(/```$/, "").trim();
  }

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    console.error("Failed to parse JSON directly. Content was:", cleaned);

    // Fallback regex parsing
    const titleMatch = cleaned.match(/"title"\s*:\s*"([^"]+)"/);
    const excerptMatch = cleaned.match(/"excerpt"\s*:\s*"([^"]+)"/);
    const bodyMatch = cleaned.match(/"body"\s*:\s*"([\s\S]+?)"\s*\n*\s*\}/);

    if (titleMatch && bodyMatch) {
      return {
        title: titleMatch[1],
        excerpt: excerptMatch ? excerptMatch[1] : "",
        body: bodyMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n'),
      };
    }

    throw new Error("Could not parse AI output as JSON.");
  }
}

async function generateArticleAI(
  category: string,
  verse: { ref: string; theme: string },
  avoidTitles: string[] = [],
): Promise<{ title: string; excerpt: string; body: string; provider: string }> {
  const titleAvoidance = avoidTitles.length
    ? `\n\nJangan gunakan atau meniru judul berikut:\n${avoidTitles.slice(0, 20).map((title) => `- ${title}`).join("\n")}`
    : "";
  const prompt = `Tulis sebuah artikel blog Kristen yang mendalam, praktis, teologis yang sehat, dan berpusat pada Injil (minimal 500 kata) dalam bahasa Indonesia untuk kategori: "${category}".

Ayat utama wajib: ${verse.ref}
Tema utama wajib: ${verse.theme}

Pastikan judul spesifik, segar, dan tidak generik. Artikel harus berbeda dari artikel Grace Daily sebelumnya, dengan sudut pandang pastoral yang unik untuk ayat dan tema utama ini.${titleAvoidance}

Wajib mengembalikan output dalam format JSON valid (pastikan escape karakter kutip dua di dalam teks HTML dilakukan dengan benar menggunakan \\" atau \\n jika ada baris baru) dengan struktur:
{
  "title": "Judul Artikel yang Menarik",
  "excerpt": "Ringkasan singkat artikel 1-2 kalimat.",
  "body": "Isi artikel dalam format HTML mentah. Gunakan tag <h3> untuk subjudul, <p> untuk paragraf, <strong> untuk penekanan, dan <blockquote> untuk kutipan ayat atau poin penting. Jangan gunakan tag <html> atau <body>."
}

Kembalikan HANYA string JSON tersebut. Jangan ada penjelasan pembuka atau penutup.`;

  const errors: string[] = [];

  const providersOrder = [
    {
      name: "groq",
      keys: [process.env.GROQ_API_KEY, process.env.GROQ_API_KEY_BACKUP].filter(Boolean) as string[],
      endpoint: "https://api.groq.com/openai/v1/chat/completions",
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
      headers: (key: string) => ({
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json"
      })
    },
    {
      name: "openai",
      keys: [process.env.OPENROUTER_API_KEY_BACKUP, process.env.OPENROUTER_API_KEY_BACKUP_BACKUP].filter(Boolean) as string[],
      endpoint: "https://api.openai.com/v1/chat/completions",
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      headers: (key: string) => ({
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json"
      })
    },
    {
      name: "gemini",
      keys: [process.env.GEMINI_API_KEY].filter(Boolean) as string[],
      endpoint: "",
      model: process.env.GEMINI_MODEL || "gemini-1.5-flash",
      headers: () => ({})
    },
    {
      name: "openrouter",
      keys: [
        process.env.OPENROUTER_API_KEY,
        process.env.OPENROUTER_API_KEY_BACKUP,
        process.env.OPENROUTER_API_KEY_BACKUP2,
        process.env.OPENROUTER_API_KEY_BACKUP3,
        process.env.OPENROUTER_API_KEY_BACKUP2 && process.env.OPENROUTER_API_KEY_BACKUP2.startsWith("sk-or-") ? process.env.OPENROUTER_API_KEY_BACKUP2 : null
      ].filter(Boolean) as string[],
      endpoint: "https://openrouter.ai/api/v1/chat/completions",
      model: process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash",
      headers: (key: string) => ({
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://grace-daily.app",
        "X-Title": "Grace Daily"
      })
    },
    {
      name: "deepseek",
      keys: [
        process.env.OPENROUTER_API_KEY_BACKUP2 && !process.env.OPENROUTER_API_KEY_BACKUP2.startsWith("sk-or-") ? process.env.OPENROUTER_API_KEY_BACKUP2 : null,
        process.env.OPENROUTER_API_KEY_BACKUP2_BACKUP
      ].filter(Boolean) as string[],
      endpoint: "https://api.deepseek.com/chat/completions",
      model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
      headers: (key: string) => ({
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json"
      })
    },
    {
      name: "openrouter_second_backup",
      keys: [
        process.env.OPENROUTER_API_KEY_SECOND_BACKUP
      ].filter(Boolean) as string[],
      endpoint: "https://openrouter.ai/api/v1/chat/completions",
      model: process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash",
      headers: (key: string) => ({
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://grace-daily.app",
        "X-Title": "Grace Daily"
      })
    },
    {
      name: "mistral",
      keys: [process.env.MISTRAL_API_KEY].filter(Boolean) as string[],
      endpoint: "https://api.mistral.ai/v1/chat/completions",
      model: process.env.MISTRAL_MODEL || "mistral-large-latest",
      headers: (key: string) => ({
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json"
      })
    },
    {
      name: "nvidia",
      keys: [
        process.env.NVIDIA_API_KEY,
        process.env.NVIDIA_API_KEY_BACKUP
      ].filter(Boolean) as string[],
      endpoint: "https://integrate.api.nvidia.com/v1/chat/completions",
      model: process.env.NVIDIA_MODEL || "meta/llama-3.3-70b-instruct",
      headers: (key: string) => ({
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json"
      })
    },
  ];

  // All AI providers are used as backup for each other
  // Priority order: groq -> openai -> gemini -> openrouter -> deepseek -> openrouter_second_backup -> mistral -> nvidia
  // Synchronized with generate-encyclopedia.ts as requested

  for (const provider of providersOrder) {
    if (provider.keys.length === 0) {
      continue;
    }

    for (let i = 0; i < provider.keys.length; i++) {
      const key = provider.keys[i];
      try {
        let response;
        if (provider.name === "gemini") {
          response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${provider.model}:generateContent?key=${key}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                systemInstruction: {
                  parts: [{ text: "Anda adalah penulis blog Kristen, teolog, dan pastor yang berpengalaman. Anda menulis artikel mendalam, inspiratif, dan aplikatif." }],
                },
                contents: [
                  {
                    role: "user",
                    parts: [{ text: prompt }],
                  },
                ],
                generationConfig: {
                  temperature: 0.75,
                  maxOutputTokens: 3000,
                },
              })
            }
          );
        } else {
          response = await fetch(provider.endpoint, {
            method: "POST",
            headers: provider.headers(key),
            body: JSON.stringify({
              model: provider.model,
              messages: [
                {
                  role: "system",
                  content:
                    "Anda adalah penulis blog Kristen, teolog, dan pastor yang berpengalaman. Anda menulis artikel mendalam, inspiratif, dan aplikatif."
                },
                { role: "user", content: prompt }
              ],
              temperature: 0.75,
              max_tokens: 3000
            })
          });
        }

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.error?.message || response.statusText);
        }

        const data = await response.json();
        let content;
        if (provider.name === "gemini") {
          content = data.candidates?.[0]?.content?.parts
            ?.map((part: { text?: string }) => part.text ?? "")
            .join("")
            .trim();
        } else {
          content = data.choices?.[0]?.message?.content?.trim();
        }

        if (!content) {
          throw new Error("Empty content");
        }

        const article = parseJSONContent(content);
        return { ...article, provider: provider.name };
      } catch (error: any) {
        console.warn(`${provider.name} Key ${i + 1} failed:`, error.message);
        errors.push(`${provider.name} Key ${i + 1}: ${error.message}`);
      }
    }
  }

  console.error(`Semua provider AI gagal memproses artikel. Menggunakan fallback lokal: ${errors.join(" | ")}`);
  return generateFallbackArticle(category, verse, errors);
}

function generateFallbackArticle(category: string, verse: { ref: string; theme: string }, errors: string[]) {
  const day = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    dateStyle: "long",
  }).format(new Date());

  return {
    title: `${verse.theme.charAt(0).toUpperCase()}${verse.theme.slice(1)} - ${verse.ref}`,
    excerpt: `Artikel ${category} untuk ${day}: merenungkan ${verse.ref} tentang ${verse.theme}.`,
    body: `
      <p>Setiap hari membawa pertanyaan dan tanggung jawabnya sendiri. Namun ${verse.ref} menolong kita melihat kembali tema penting ini: ${verse.theme}. Iman Kristen mengingatkan kita bahwa kekuatan utama kita bukan berasal dari kemampuan mengatur semua hal, melainkan dari anugerah Allah yang menopang hidup. Injil menempatkan Kristus sebagai pusat pengharapan: Ia mengasihi, menebus, memimpin, dan memampukan umat-Nya berjalan dalam kesetiaan.</p>
      <h3>Mulai dari Firman</h3>
      <p>Ketika hati terasa penuh, firman Tuhan menolong kita membedakan suara kekhawatiran dari suara Gembala yang baik. Membaca satu bagian Alkitab dengan perlahan, merenungkannya, lalu meresponsnya dalam doa adalah tindakan kecil yang membentuk arah hari.</p>
      <blockquote>${verse.ref} mengarahkan kita untuk melihat hidup dari sudut pandang kasih karunia Allah, bukan sekadar tekanan keadaan.</blockquote>
      <h3>Berjalan dalam Ketaatan Sederhana</h3>
      <p>Ketaatan tidak selalu tampak besar. Kadang bentuknya adalah mengampuni, menghubungi seseorang yang sedang lemah, bekerja dengan jujur, atau berhenti sejenak untuk berdoa sebelum mengambil keputusan. Dalam hal-hal sederhana itu, iman menjadi nyata.</p>
      <p>Hari ini, bawalah satu kekhawatiran kepada Tuhan dan pilih satu tindakan kasih yang konkret. Percayalah, Allah yang memulai pekerjaan baik di dalam hidup kita setia menyelesaikannya menurut waktu dan hikmat-Nya.</p>
    `.trim(),
    provider: `local-fallback${errors.length ? ` (${errors.length} provider failed)` : ""}`,
  };
}

async function loadExistingArticleFingerprints() {
  const { getCollectionWithFallback } = await import("@/lib/server/db-fallback");
  const blogPosts = await getCollectionWithFallback<any>("blog_posts", "blog_posts.json");
  const normalizedTitles = new Set<string>();
  const bodyHashes = new Set<string>();
  const recentTitles: string[] = [];

  blogPosts.forEach((data) => {
    const title = typeof data.title === "string" ? data.title : "";
    const body = typeof data.body === "string" ? data.body : "";
    const normalizedTitle = typeof data.normalizedTitle === "string" ? data.normalizedTitle : normalizeText(title);
    const existingBodyHash = typeof data.bodyHash === "string" ? data.bodyHash : "";
    const computedBodyHash = body ? bodyHash(body) : "";

    if (normalizedTitle) {
      normalizedTitles.add(normalizedTitle);
      recentTitles.push(title);
    }
    if (existingBodyHash) {
      bodyHashes.add(existingBodyHash);
    }
    if (computedBodyHash) {
      bodyHashes.add(computedBodyHash);
    }
  });

  return { normalizedTitles, bodyHashes, recentTitles };
}

function isDuplicateArticle(
  article: { title: string; body: string },
  existing: { normalizedTitles: Set<string>; bodyHashes: Set<string> },
) {
  return (
    existing.normalizedTitles.has(normalizeText(article.title)) ||
    existing.bodyHashes.has(bodyHash(article.body))
  );
}

export async function GET(request: Request) {
  return handleRequest(request);
}

export async function POST(request: Request) {
  return handleRequest(request);
}

async function handleRequest(request: Request) {
  const adminDb = getAdminDb();
  if (!adminDb) {
    return NextResponse.json({ error: "Firebase Admin belum dikonfigurasi." }, { status: 503 });
  }

  // 1. Verify Authorization
  // Supports: 
  //   - Vercel built-in cron: header x-vercel-cron: 1
  //   - Query param secret: ?secret=CRON_SECRET or ?cron_secret=CRON_SECRET
  //   - Authorization header: Bearer CRON_SECRET
  //   - Custom header: X-Cron-Secret: CRON_SECRET (for cron-job.org)
  let isCron = false;
  const authHeader = request.headers.get("authorization") || "";
  const customCronHeader = request.headers.get("x-cron-secret") || "";
  const cronSecret = process.env.CRON_SECRET;
  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret") || url.searchParams.get("cron_secret");
  const force = url.searchParams.get("force") === "true";
  const userAgent = request.headers.get("user-agent") || "";

  // Log auth attempt for debugging (remove in production if needed)
  console.log(`[generate-blog] Auth attempt — UA: ${userAgent.substring(0, 80)}, hasSecret: ${Boolean(cronSecret)}, querySecret: ${Boolean(querySecret)}, authHeader: ${authHeader.substring(0, 20)}`);

  if (cronSecret) {
    if (
      authHeader === `Bearer ${cronSecret}` ||
      querySecret === cronSecret ||
      customCronHeader === cronSecret
    ) {
      isCron = true;
      console.log("[generate-blog] Authorized as cron via secret.");
    }
  } else {
    // No CRON_SECRET configured — allow Vercel internal cron or any trusted header
    if (
      request.headers.get("x-vercel-cron") === "1" ||
      userAgent.toLowerCase().includes("vercel") ||
      userAgent.toLowerCase().includes("cron-job.org")
    ) {
      isCron = true;
      console.log("[generate-blog] Authorized as cron (no secret configured, trusting UA/header).");
    }
  }

  let adminUser = null;
  if (!isCron) {
    adminUser = await verifyAdmin(request);
    if (!adminUser) {
      console.warn("[generate-blog] Unauthorized request rejected.");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // 2. Check settings/auto_blog toggle via R2/D1 fallback
  try {
    const { getDocWithFallback, getCollectionWithFallback } = await import("@/lib/server/db-fallback");
    const autoBlogData = await getDocWithFallback<any>("settings", "auto_blog", "settings.json");
    const autoBlogEnabled = autoBlogData?.enabled !== false;

    // If it is Cron and disabled, skip
    if (isCron && !autoBlogEnabled) {
      return NextResponse.json({ message: "Auto-blog is disabled. Skipping generation." }, { status: 200 });
    }

    const autoRunKey = jakartaDayKey();

    if (isCron && !force) {
      const blogPosts = await getCollectionWithFallback<any>("blog_posts", "blog_posts.json");
      const existingDailyPost = blogPosts.find(p => p.contentDayKey === autoRunKey);

      if (existingDailyPost) {
        const title = existingDailyPost.title ?? "";

        try {
          const { sendTelegramCronReport, escapeHtml } = await import("@/lib/server/telegram");
          await sendTelegramCronReport({
            date: new Intl.DateTimeFormat("id-ID", {
              timeZone: "Asia/Jakarta",
              dateStyle: "long",
            }).format(new Date()),
            cronType: "generate-blog",
            target: 1,
            success: 0,
            duplicate: 1,
            failed: 0,
            entries: [`- ✍️ <b>${escapeHtml(title)}</b> — ⚠️ Duplikat (Skipped)`],
          });
        } catch (telegramErr) {
          console.error("[generate-blog] Failed to send Telegram cron report:", telegramErr);
        }

        return NextResponse.json({
          success: true,
          skipped: true,
          reason: "Artikel untuk hari ini sudah ada, sehingga cron otomatis dilewati.",
          article: {
            slug: existingDailyPost.id || existingDailyPost.slug,
            title,
          },
        });
      }

      const existingAutoPost = blogPosts.find(p => p.autoRunKey === autoRunKey);

      if (existingAutoPost) {
        const title = existingAutoPost.title ?? "";

        try {
          const { sendTelegramCronReport, escapeHtml } = await import("@/lib/server/telegram");
          await sendTelegramCronReport({
            date: new Intl.DateTimeFormat("id-ID", {
              timeZone: "Asia/Jakarta",
              dateStyle: "long",
            }).format(new Date()),
            cronType: "generate-blog",
            target: 1,
            success: 0,
            duplicate: 1,
            failed: 0,
            entries: [`- ✍️ <b>${escapeHtml(title)}</b> — ⚠️ Duplikat (Skipped)`],
          });
        } catch (telegramErr) {
          console.error("[generate-blog] Failed to send Telegram cron report:", telegramErr);
        }

        return NextResponse.json({
          success: true,
          skipped: true,
          reason: "Artikel otomatis untuk hari ini sudah ada.",
          article: {
            slug: existingAutoPost.id || existingAutoPost.slug,
            title,
          },
        });
      }
    }

    // 3. Fetch categories from settings/blog_categories
    const blogCatsData = await getDocWithFallback<any>("settings", "blog_categories", "settings.json");
    let categories = ["Renungan", "Doa", "Keluarga", "Teologi", "Kesaksian", "Bible Study"];
    if (blogCatsData && Array.isArray(blogCatsData.list) && blogCatsData.list.length > 0) {
      categories = blogCatsData.list;
    }

    // Pick one category randomly
    const selectedCategory = categories[Math.floor(Math.random() * categories.length)];
    const existingArticles = await loadExistingArticleFingerprints();

    // 4. Generate AI Article with Failover
    let selectedVerse = articleVerseForDay(autoRunKey);
    let article = await generateArticleAI(selectedCategory, selectedVerse, existingArticles.recentTitles);

    for (let attempt = 1; attempt <= 3 && isDuplicateArticle(article, existingArticles); attempt++) {
      selectedVerse = articleVerseForDay(autoRunKey, attempt);
      article = await generateArticleAI(selectedCategory, selectedVerse, existingArticles.recentTitles);
    }

    if (isDuplicateArticle(article, existingArticles)) {
      const uniqueSuffix = new Intl.DateTimeFormat("id-ID", {
        timeZone: "Asia/Jakarta",
        dateStyle: "long",
      }).format(new Date());
      article = {
        ...article,
        title: `${article.title} (${selectedVerse.ref} - ${uniqueSuffix})`,
        body: `${article.body}\n<p><strong>Catatan Grace Daily:</strong> Artikel ini disusun khusus untuk ${uniqueSuffix} dengan ayat utama ${selectedVerse.ref} dan tema ${selectedVerse.theme}, agar pembaca menerima sudut pandang yang baru dan tidak mengulang bahan sebelumnya.</p>`,
      };
    }

    // BLOKIR: Jangan simpan artikel fallback lokal ke database
    if (article.provider && article.provider.includes("local-fallback")) {
      throw new Error(`Semua AI provider gagal. Artikel fallback lokal tidak akan dipublikasikan. Provider: ${article.provider}`);
    }

    const normalizedTitle = normalizeText(article.title);
    const articleBodyHash = bodyHash(article.body);

    // Pick one of background color keys randomly (including new landing page colors)
    const bgColors = ["cream", "sage", "blue", "rose", "amber", "gray", "green", "teal", "beige", "warmwhite", "dark"];
    const randomBg = bgColors[Math.floor(Math.random() * bgColors.length)];

    const slug = `${Date.now()}-${slugify(article.title)}`;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.gracedaily.my.id";
    // 5. Generate Banner URL and upload to Cloudflare R2
    const { generateBlogBanner } = await import("@/lib/server/daily-devotion");
    const bannerUrl = await generateBlogBanner(slug, article.title, article.excerpt);
    await adminDb.collection("blog_posts").doc(slug).set({
      title: article.title,
      category: selectedCategory,
      createdAt: new Date(),
      updatedAt: new Date(),
      excerpt: article.excerpt,
      body: article.body,
      imageUrl: bannerUrl,
      status: "published",
      authorName: "Grace Daily AI",
      authorId: "system-auto",
      provider: article.provider,
      autoGenerated: isCron,
      autoRunKey: isCron ? autoRunKey : null,
      contentDayKey: autoRunKey,
      normalizedTitle,
      bodyHash: articleBodyHash,
      mainVerseRef: selectedVerse.ref,
      mainVerseTheme: selectedVerse.theme,
      socialsShareStatus: "pending",
      scheduledShareAt: new Date(Date.now() + 30 * 60 * 1000),
    });

    // Trigger all integrations and notifications in parallel to optimize execution speed
    const absoluteBannerUrl = bannerUrl.startsWith("http") ? bannerUrl : `${appUrl}${bannerUrl}`;
    const emailSubject = `Artikel Baru: ${article.title}`;
    const emailHtml = `
      <div style="font-family: 'Georgia', serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #FAF6EE; color: #2D2924; border: 1px solid #E5D5C0;">
        <h2 style="text-align: center; color: #9C7C54; font-family: sans-serif; font-size: 24px; letter-spacing: 2px;">GRACE DAILY</h2>
        <hr style="border: 0; border-top: 1px solid #E5D5C0; margin-bottom: 20px;" />
        
        <img src="${absoluteBannerUrl}" alt="${article.title}" style="width: 100%; border-radius: 8px; margin-bottom: 20px;" />
        
        <span style="font-size: 12px; font-weight: bold; color: #9C7C54; text-transform: uppercase; letter-spacing: 1px;">Kategori: ${selectedCategory}</span>
        <h1 style="font-size: 28px; margin-top: 10px; margin-bottom: 15px; color: #2D2924; line-height: 1.3;">${article.title}</h1>
        
        <p style="font-size: 16px; font-style: italic; color: #61574C; margin-bottom: 25px; line-height: 1.6;">"${article.excerpt}"</p>
        
        <div style="font-size: 16px; line-height: 1.8; color: #332F2A;">
          ${article.body}
        </div>
        
        <p style="text-align: center; margin-top: 30px;">
          <a href="${appUrl}/blog/${slug}" style="background-color: #9C7C54; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; font-family: sans-serif; display: inline-block;">Baca Selengkapnya di Website</a>
        </p>
        <!-- UNSUBSCRIBE_LINK_PLACEHOLDER -->
      </div>
    `;

    let blastResult = { sentCount: 0, failedCount: 0 };

    await Promise.allSettled([
      // 1. Push notifications
      (async () => {
        try {
          await sendPushNotification({
            preferenceKey: "article",
            title: `🔔 Artikel Baru: ${article.title}`,
            body: article.excerpt || "Baca artikel selengkapnya di website Grace Daily.",
            url: `/blog/${slug}`,
          });
          console.log("[generate-blog] Push notification sent successfully.");
        } catch (err) {
          console.error("[generate-blog] Failed to send push notification:", err);
        }
      })(),
      // 2. Email newsletter blast
      (async () => {
        try {
          const { sendNewsletterBlast } = await import("@/lib/server/email");
          blastResult = await sendNewsletterBlast({
            subject: emailSubject,
            htmlTemplate: emailHtml,
            preferenceKey: "article",
          });
          console.log("[generate-blog] Email newsletter blast completed.");
        } catch (err) {
          console.error("[generate-blog] Email blast failed:", err);
        }
      })(),
      // 3. Cloudflare R2 Index Backup
      (async () => {
        try {
          const { syncSingleBlogArticle } = await import("@/lib/server/backup-r2-service");
          await syncSingleBlogArticle(slug, {
            id: slug,
            title: article.title,
            category: selectedCategory,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            excerpt: article.excerpt,
            body: article.body,
            imageUrl: bannerUrl,
            status: "published",
            authorName: "Grace Daily AI",
            authorId: "system-auto",
            provider: article.provider,
            autoGenerated: isCron,
            autoRunKey: isCron ? autoRunKey : null,
            contentDayKey: autoRunKey,
            normalizedTitle,
            bodyHash: articleBodyHash,
            mainVerseRef: selectedVerse.ref,
            mainVerseTheme: selectedVerse.theme,
            socialsShareStatus: "pending",
          });
          console.log("[generate-blog] Incremental R2 and D1 sync completed successfully.");
        } catch (err) {
          console.error("[generate-blog] Incremental R2 and D1 sync failed:", err);
        }
      })(),
      // 4. Telegram channel post
      (async () => {
        try {
          const { reportNewArticleTelegram } = await import("@/lib/server/telegram");
          await reportNewArticleTelegram({
            slug,
            title: article.title,
            excerpt: article.excerpt,
            category: selectedCategory,
          });
          console.log("[generate-blog] Telegram channel post completed.");
        } catch (err) {
          console.error("[generate-blog] Telegram posting failed:", err);
        }
      })()
    ]);

    // Trigger Telegram Cron Report for success
    try {
      const { sendTelegramCronReport, escapeHtml } = await import("@/lib/server/telegram");
      await sendTelegramCronReport({
        date: new Intl.DateTimeFormat("id-ID", {
          timeZone: "Asia/Jakarta",
          dateStyle: "long",
        }).format(new Date()),
        cronType: "generate-blog",
        target: 1,
        success: 1,
        duplicate: 0,
        failed: 0,
        entries: [`- ✍️ <b>${escapeHtml(article.title)}</b> — ✅ Berhasil`],
      });
    } catch (telegramErr) {
      console.error("[generate-blog] Failed to send Telegram cron report:", telegramErr);
    }

    return NextResponse.json({
      success: true,
      article: {
        slug,
        title: article.title,
        category: selectedCategory,
        provider: article.provider,
        autoRunKey: isCron ? autoRunKey : null,
        contentDayKey: autoRunKey,
        mainVerseRef: selectedVerse.ref,
        mainVerseTheme: selectedVerse.theme,
      },
      emailBlast: {
        sent: blastResult.sentCount > 0,
        recipientsCount: blastResult.sentCount + blastResult.failedCount,
      }
    });
  } catch (error: any) {
    console.error("Cron content generation failed:", error);

    // Trigger Telegram Cron Failure Report
    try {
      const { sendTelegramCronReport, escapeHtml } = await import("@/lib/server/telegram");
      await sendTelegramCronReport({
        date: new Intl.DateTimeFormat("id-ID", {
          timeZone: "Asia/Jakarta",
          dateStyle: "long",
        }).format(new Date()),
        cronType: "generate-blog",
        target: 1,
        success: 0,
        duplicate: 0,
        failed: 1,
        entries: [`- ❌ <b>Error:</b> ${escapeHtml(error.message || "Gagal membuat konten otomatis.")}`],
      });
    } catch (telegramErr) {
      console.error("[generate-blog] Failed to send Telegram failure cron report:", telegramErr);
    }

    return NextResponse.json({ error: error.message || "Gagal membuat konten otomatis." }, { status: 500 });
  }
}
