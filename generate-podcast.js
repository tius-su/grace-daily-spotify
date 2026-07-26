import admin from 'firebase-admin';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { UniversalEdgeTTS } from 'edge-tts-universal';
import { execSync } from 'child_process';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// ─────────────────────────────────────────────────────────────────────────────
// 1. ENVIRONMENT CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const parentEnvPath = path.join(__dirname, '../grace-daily/.env.local');
if (existsSync(parentEnvPath)) {
  dotenv.config({ path: parentEnvPath });
  console.log(`[Env] Loaded from ${parentEnvPath}`);
} else {
  dotenv.config();
}

const r2AccountId = process.env.R2_ACCOUNT_ID;
const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID;
const r2SecretKey = process.env.R2_SECRET_ACCESS_KEY;
const r2BucketName = process.env.R2_BUCKET_NAME;
const r2PublicUrl = (process.env.R2_PUBLIC_URL || process.env.NEXT_PUBLIC_R2_PUBLIC_URL || '').replace(/\/$/, '');

if (!r2AccountId || !r2AccessKeyId || !r2SecretKey || !r2BucketName || !r2PublicUrl) {
  console.error('❌ Missing Cloudflare R2 credentials in environment variables.');
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. LANGUAGE CONFIGURATIONS — Natural voice, tone & cengkok per bahasa
// ─────────────────────────────────────────────────────────────────────────────
// Voices selected for natural devotional warmth & clarity:
//   ID: GadisNeural  — warm, calm Indonesian female (natural devotional cengkok)
//   EN: JennyNeural  — gentle, empathetic US English female
//   ZH: XiaoxiaoNeural — affectionate, warm Mandarin female (supports style="calm")
//   ES: ElviraNeural  — expressive, warm Spanish female
const LANGUAGES = [
  {
    code: 'id',
    name: 'Bahasa Indonesia',
    feedFile: 'podcast-id.xml',
    jsonFile: 'podcast-id.json',
    devotionVoice: 'id-ID-GadisNeural',
    blogVoice: 'id-ID-ArdiNeural',
    ttsRate: '0.93',     // Slightly slower for devotional gravity
    ttsPitch: '+2%',     // Slight lift for warmth
    rssLang: 'id-id',
    channelTitle: 'Grace Daily Podcast',
    channelDesc: 'Renungan harian dan artikel blog Kristen dari Grace Daily. Diterbitkan setiap pagi untuk mendampingi waktu teduh Anda.',
    dateLocale: 'id-ID',
    buildDevotionText: (date, title, verseRef, verseText, body, prayer) =>
      `Renungan Harian Grace Daily.\n\nTanggal ${date}.\n\n` +
      `Judul...\n\n${title}.\n\n` +
      `Ayat hari ini diambil dari ${verseRef}, yang berbunyi...\n\n${verseText}.\n\n` +
      `Mari kita renungkan bersama.\n\n${body}` +
      (prayer ? `\n\nMari kita bersatu di dalam doa.\n\n${prayer}` : '') +
      `\n\nDemikianlah renungan harian dari Grace Daily. Kiranya firman Tuhan ini menguatkan langkah Anda hari ini. Tuhan memberkati.`,
    buildBlogText: (date, title, author, excerpt, body) =>
      `Artikel Blog Grace Daily.\n\nTanggal ${date}.\n\n` +
      `Judul: ${title}.\n\n` +
      `Ditulis oleh Grace Daily.\n\n` +
      (excerpt ? `Ringkasan: ${excerpt}.\n\n` : '') +
      `Berikut adalah isi artikel selengkapnya.\n\n${body}\n\n` +
      `Demikianlah artikel dari Grace Daily. Kiranya bermanfaat untuk perjalanan iman Anda.`,
  },
  {
    code: 'en',
    name: 'English',
    feedFile: 'podcast-en.xml',
    jsonFile: 'podcast-en.json',
    devotionVoice: 'en-US-JennyNeural',
    blogVoice: 'en-US-GuyNeural',
    ttsRate: '0.92',
    ttsPitch: '+0%',
    rssLang: 'en-us',
    channelTitle: 'Grace Daily Podcast (English)',
    channelDesc: 'Daily Christian devotions and blog articles from Grace Daily. Published every morning to accompany your quiet time.',
    dateLocale: 'en-US',
    buildDevotionText: (date, title, verseRef, verseText, body, prayer) =>
      `Daily Devotion from Grace Daily.\n\n${date}.\n\n` +
      `Title...\n\n${title}.\n\n` +
      `Today's verse is taken from ${verseRef}, which reads...\n\n${verseText}.\n\n` +
      `Let us reflect together.\n\n${body}` +
      (prayer ? `\n\nLet us pray together.\n\n${prayer}` : '') +
      `\n\nThis has been the Daily Devotion from Grace Daily. May God's Word strengthen your steps today. God bless you.`,
    buildBlogText: (date, title, author, excerpt, body) =>
      `Blog Article from Grace Daily.\n\n${date}.\n\n` +
      `Title...\n\n${title}.\n\n` +
      `Written by ${author}.\n\n` +
      (excerpt ? `Summary: ${excerpt}.\n\n` : '') +
      `Here is the full article.\n\n${body}\n\n` +
      `This has been an article from Grace Daily. May it bless your faith journey.`,
  },
  {
    code: 'zh',
    name: '中文',
    feedFile: 'podcast-zh.xml',
    jsonFile: 'podcast-zh.json',
    devotionVoice: 'zh-CN-XiaoxiaoNeural',   // Supports "calm" style — gentle devotional tone
    blogVoice: 'zh-CN-YunyangNeural',
    ttsRate: '0.90',    // Mandarin benefits from slightly slower pace for clarity
    ttsPitch: '+1%',
    rssLang: 'zh-cn',
    channelTitle: 'Grace Daily 播客（中文）',
    channelDesc: '来自Grace Daily的每日基督徒灵修和博客文章。每天早上发布，陪伴您的安静时光。',
    dateLocale: 'zh-CN',
    buildDevotionText: (date, title, verseRef, verseText, body, prayer) =>
      `Grace Daily 每日灵修。\n\n${date}。\n\n` +
      `题目...\n\n${title}。\n\n` +
      `今天的经文来自${verseRef}，经文这样说...\n\n${verseText}。\n\n` +
      `让我们一起来思想今天的信息。\n\n${body}` +
      (prayer ? `\n\n让我们一起来祷告。\n\n${prayer}` : '') +
      `\n\n以上就是Grace Daily今天的每日灵修。愿神的话语坚固您今天的脚步。神祝福您。`,
    buildBlogText: (date, title, author, excerpt, body) =>
      `Grace Daily 博客文章。\n\n${date}。\n\n` +
      `题目...\n\n${title}。\n\n` +
      `作者：${author}。\n\n` +
      (excerpt ? `摘要：${excerpt}。\n\n` : '') +
      `以下是文章全文。\n\n${body}\n\n` +
      `以上就是Grace Daily的文章。愿它对您的信仰旅程有所帮助。`,
  },
  {
    code: 'es',
    name: 'Español',
    feedFile: 'podcast-es.xml',
    jsonFile: 'podcast-es.json',
    devotionVoice: 'es-ES-ElviraNeural',   // Expressive, passionate Spanish female
    blogVoice: 'es-ES-AlvaroNeural',
    ttsRate: '0.93',
    ttsPitch: '+1%',
    rssLang: 'es-es',
    channelTitle: 'Grace Daily Podcast (Español)',
    channelDesc: 'Devociones cristianas diarias y artículos de blog de Grace Daily. Publicado cada mañana para acompañar tu tiempo de quietud.',
    dateLocale: 'es-ES',
    buildDevotionText: (date, title, verseRef, verseText, body, prayer) =>
      `Devoción Diaria de Grace Daily.\n\n${date}.\n\n` +
      `Título...\n\n${title}.\n\n` +
      `El versículo de hoy está tomado de ${verseRef}, que dice...\n\n${verseText}.\n\n` +
      `Reflexionemos juntos.\n\n${body}` +
      (prayer ? `\n\nOremos juntos.\n\n${prayer}` : '') +
      `\n\nEsta ha sido la Devoción Diaria de Grace Daily. Que la Palabra de Dios fortalezca tus pasos hoy. Dios te bendiga.`,
    buildBlogText: (date, title, author, excerpt, body) =>
      `Artículo de Blog de Grace Daily.\n\n${date}.\n\n` +
      `Título...\n\n${title}.\n\n` +
      `Escrito por ${author}.\n\n` +
      (excerpt ? `Resumen: ${excerpt}.\n\n` : '') +
      `Aquí está el artículo completo.\n\n${body}\n\n` +
      `Este ha sido un artículo de Grace Daily. Que sea de bendición para tu camino de fe.`,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 3. FIREBASE & R2 INITIALIZATION
// ─────────────────────────────────────────────────────────────────────────────
let serviceAccount;
if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    console.log('[Firebase] Initialized via FIREBASE_SERVICE_ACCOUNT_JSON env var.');
  } catch (e) {
    console.error('❌ FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON:', e.message);
    process.exit(1);
  }
} else {
  const localPath = path.join(__dirname, '../service-account.json');
  if (!existsSync(localPath)) {
    console.error('❌ Firebase credentials not found. Set FIREBASE_SERVICE_ACCOUNT_JSON or provide service-account.json.');
    process.exit(1);
  }
  const fileData = await fs.readFile(localPath, 'utf8');
  serviceAccount = JSON.parse(fileData);
  console.log(`[Firebase] Initialized via local service-account.json`);
}

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${r2AccountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: r2AccessKeyId, secretAccessKey: r2SecretKey },
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Get today's date string in Jakarta timezone (yyyy-mm-dd) */
function getJakartaDateStr() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

/** Format date for TTS speech in given locale */
function getFormattedDate(locale) {
  return new Intl.DateTimeFormat(locale, {
    timeZone: 'Asia/Jakarta',
    dateStyle: 'long',
  }).format(new Date());
}

/**
 * Get RFC 822 pubDate string in WIB (+0700).
 * FIX: Previous code had `5 - 7 = -2` which gave incorrect timezone offset display.
 * This function correctly constructs the date/time in +0700 timezone format.
 * @param {string} todayStr - Date string "yyyy-mm-dd" in Jakarta timezone
 * @param {number} hourWib - Hour in WIB (e.g. 5 for 05:00 WIB)
 * @param {number} minuteWib - Minute (default 0)
 */
function getWibPubDate(todayStr, hourWib = 5, minuteWib = 0) {
  const [y, m, d] = todayStr.split('-').map(Number);
  // WIB = UTC+7: hourWib WIB = (hourWib - 7) UTC of the same local day.
  // e.g., 05:00 WIB = -2 UTC → JS Date.UTC with -2 rolls back to previous day 22:00 UTC.
  // This UTC timestamp IS 05:00 WIB, just stored as UTC.
  const dateAsUtc = new Date(Date.UTC(y, m - 1, d, hourWib - 7, minuteWib, 0));

  // Get weekday name IN Jakarta timezone (not UTC, since UTC date is d-1)
  const dayName = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta', weekday: 'short',
  }).format(dateAsUtc);

  // Get day, month, year IN Jakarta timezone (confirms we get d/m/y, not d-1)
  const jakartaParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(dateAsUtc).split('-'); // ['2026', '07', '23']

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthName = months[parseInt(jakartaParts[1]) - 1];

  // Result: "Thu, 23 Jul 2026 05:00:00 +0700"
  return `${dayName}, ${jakartaParts[2]} ${monthName} ${jakartaParts[0]} ${String(hourWib).padStart(2, '0')}:${String(minuteWib).padStart(2, '0')}:00 +0700`;
}

/** Strip HTML/XML/SSML tags, markdown links, and URLs completely for clean TTS speech */
function cleanHtmlToText(html) {
  if (!html) return '';
  let text = String(html);

  // 1. Remove markdown links [text](url) -> keep only text
  text = text.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');
  text = text.replace(/\[([^\]]+)\]/g, '$1');

  // 2. Format HTML structure tags into pauses
  text = text.replace(/<\/h[1-6]>/gi, '.\n\n');
  text = text.replace(/<\/p>/gi, '\n\n');
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<blockquote[^>]*>/gi, '\n\n');
  text = text.replace(/<\/blockquote>/gi, '\n\n');
  text = text.replace(/<strong[^>]*>|<\/strong>/gi, '');
  text = text.replace(/<em[^>]*>|<\/em>/gi, '');

  // 3. Remove all HTML / XML / SSML tags completely (<break ...>, <prosody ...>, etc.)
  text = text.replace(/<[^>]*>/g, ' ');

  // 4. Remove all web links and domain URLs (http, https, www, gracedaily.my.id, with/without spaces)
  text = text.replace(/https?:\/\/[^\s]+/gi, '');
  text = text.replace(/www\.[^\s]+/gi, '');
  text = text.replace(/gracedaily\.my\.id[^\s]*/gi, '');
  text = text.replace(/https?\s*:\s*\/\s*\/\s*[^\s]+/gi, '');

  // 5. Clean HTML entities and symbols
  text = text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, ' dan ')
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, '')
    .replace(/&gt;/gi, '')
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");

  // 6. Fix Indonesian devotional capitalization & suffix pronunciation for TTS
  // Replaces "-Mu", " Mu", " MU" with "mu", "-Nya" with "nya", "-Ku" with "ku"
  // so Edge TTS pronounces them naturally as suffixes rather than spelling letters "M-U" / "N-Y-A"
  text = text
    .replace(/(\w+)-Mu\b/g, '$1mu')
    .replace(/(\w+)-MU\b/g, '$1mu')
    .replace(/(\w+)\s+Mu\b/g, '$1mu')
    .replace(/\bMu\b/g, 'mu')
    .replace(/\bMU\b/g, 'mu')
    .replace(/(\w+)-Nya\b/g, '$1nya')
    .replace(/(\w+)-NYA\b/g, '$1nya')
    .replace(/(\w+)\s+Nya\b/g, '$1nya')
    .replace(/\bNya\b/g, 'nya')
    .replace(/\bNYA\b/g, 'nya')
    .replace(/(\w+)-Ku\b/g, '$1ku')
    .replace(/(\w+)-KU\b/g, '$1ku')
    .replace(/(\w+)\s+Ku\b/g, '$1ku')
    .replace(/\bKu\b/g, 'ku');

  // 7. Remove leaked technical keywords if any (type tts ssml, break time, quot, etc.)
  text = text.replace(/\b(ssml|tts|type tts ssml|break time|breaktime)\b/gi, '');
  text = text.replace(/\bquot\b/gi, '');

  // 8. Clean "Grace Daily AI" to "Grace Daily" (tanpa AI)
  text = text.replace(/Grace Daily AI/gi, 'Grace Daily');
  text = text.replace(/GraceDailyAI/gi, 'Grace Daily');

  // 9. Clean markdown symbols
  text = text.replace(/[#*_`~]/g, ' ');

  return text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

/** Estimate audio duration in seconds based on word count */
function estimateDuration(text) {
  const wordCount = text.split(/\s+/).length;
  return Math.round(wordCount / 2.1); // ~130 words/min average
}

/** Escape XML special characters for RSS */
function escapeXml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. TRANSLATION — Google Translate free API (same approach as /api/translate)
// ─────────────────────────────────────────────────────────────────────────────
async function _translateChunk(text, gtLang) {
  const encoded = encodeURIComponent(text.trim());
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=id&tl=${gtLang}&dt=t&q=${encoded}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GraceDaily/1.0)' },
  });
  if (!res.ok) throw new Error(`Google Translate HTTP ${res.status}`);
  const data = await res.json();
  return data[0].map(chunk => chunk[0] ?? '').join('');
}

/**
 * Translate Indonesian text to target language.
 * Auto-chunks long texts (>3000 chars) to stay within API limits.
 */
async function translateText(text, targetLangCode) {
  if (!text || !text.trim() || targetLangCode === 'id') return text;
  const gtLang = targetLangCode === 'zh' ? 'zh-CN' : targetLangCode;
  const maxChunk = 3000;

  if (text.length <= maxChunk) {
    return _translateChunk(text, gtLang);
  }

  // Split by paragraph breaks for long content
  const paragraphs = text.split(/\n\n+/);
  const chunks = [];
  let current = '';
  for (const para of paragraphs) {
    if ((current + '\n\n' + para).length > maxChunk && current) {
      chunks.push(current.trim());
      current = para;
    } else {
      current = current ? current + '\n\n' + para : para;
    }
  }
  if (current.trim()) chunks.push(current.trim());

  const results = [];
  for (const chunk of chunks) {
    results.push(await _translateChunk(chunk, gtLang));
    await new Promise(r => setTimeout(r, 350)); // gentle rate limiting
  }
  return results.join('\n\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. TTS — SSML with prosody (natural cengkok/tone) + plain text fallback
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build SSML markup for natural devotional voice.
 * Uses <prosody> for rate/pitch control and <break> tags for natural pacing.
 * XiaoxiaoNeural (ZH) also gets mstts:express-as style="calm" for spiritual warmth.
 */
function buildSsml(text, langConfig, isDevotional) {
  const voice = isDevotional ? langConfig.devotionVoice : langConfig.blogVoice;
  const langCode = voice.split('-').slice(0, 2).join('-');

  // Escape XML special chars
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  // Convert line breaks to natural SSML pauses
  const withBreaks = escaped
    .replace(/\n\n+/g, '<break time="900ms"/>')
    .replace(/\n/g, '<break time="450ms"/>');

  // XiaoxiaoNeural supports mstts:express-as for extra warmth
  const expressOpen = (langConfig.code === 'zh' && isDevotional)
    ? `<mstts:express-as style="calm">`
    : '';
  const expressClose = (langConfig.code === 'zh' && isDevotional)
    ? `</mstts:express-as>`
    : '';

  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="${langCode}">
  <voice name="${voice}">
    ${expressOpen}
    <prosody rate="${langConfig.ttsRate}" pitch="${langConfig.ttsPitch}">${withBreaks}</prosody>
    ${expressClose}
  </voice>
</speak>`.trim();
}

/**
 * Generate TTS audio file.
 * Tries SSML first for natural tone; falls back gracefully to plain text.
 */
async function textToSpeech(text, langConfig, outputFilePath, isDevotional = true) {
  const voice = isDevotional ? langConfig.devotionVoice : langConfig.blogVoice;

  // Format text into clear sentences with natural punctuation pauses, ensuring all tags/URLs are stripped
  const cleanText = cleanHtmlToText(text)
    .replace(/\n\n+/g, '... ')
    .replace(/\n/g, '. ')
    .replace(/\s+/g, ' ')
    .trim();

  const tts = new UniversalEdgeTTS(cleanText, voice);
  const result = await tts.synthesize();
  let buffer = Buffer.from(await result.audio.arrayBuffer());

  // Optimize audio format if FFmpeg is available (MP3, Mono, 32 kbps, 24 kHz)
  const rawPath = outputFilePath + '.raw.mp3';
  await fs.writeFile(rawPath, buffer);
  try {
    execSync(`ffmpeg -y -i "${rawPath}" -vn -c:a libmp3lame -ac 1 -b:a 32k -ar 24000 "${outputFilePath}"`, { stdio: 'ignore' });
    buffer = await fs.readFile(outputFilePath);
    await fs.unlink(rawPath).catch(() => { });
    console.log(`[TTS] ✅ Audio synthesized & compressed (MP3 Mono 32k 24kHz) — ${(buffer.length / 1024).toFixed(0)}KB, voice: ${voice}`);
  } catch (ffmpegErr) {
    // Fallback: use raw TTS output if FFmpeg is not available
    await fs.rename(rawPath, outputFilePath).catch(() => fs.writeFile(outputFilePath, buffer));
    console.log(`[TTS] ✅ Audio synthesized (Raw TTS) — ${(buffer.length / 1024).toFixed(0)}KB, voice: ${voice}`);
  }

  return buffer;
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. CLOUDFLARE R2 HELPERS
// ─────────────────────────────────────────────────────────────────────────────
async function uploadToR2(localFilePath, r2Key, contentType) {
  const fileContent = await fs.readFile(localFilePath);
  await s3.send(new PutObjectCommand({
    Bucket: r2BucketName,
    Key: r2Key,
    Body: fileContent,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000',
  }));
  return `${r2PublicUrl}/${r2Key}`;
}

async function uploadStringToR2(content, r2Key, contentType) {
  await s3.send(new PutObjectCommand({
    Bucket: r2BucketName,
    Key: r2Key,
    Body: Buffer.from(content, 'utf8'),
    ContentType: contentType,
    CacheControl: 'no-cache, no-store, must-revalidate',
  }));
  return `${r2PublicUrl}/${r2Key}`;
}

async function downloadPodcastIndex(jsonFile) {
  try {
    const response = await s3.send(new GetObjectCommand({
      Bucket: r2BucketName,
      Key: `podcasts/${jsonFile}`,
    }));
    const dataStr = await response.Body.transformToString();
    return JSON.parse(dataStr);
  } catch {
    return [];
  }
}

async function ensureCoverImage() {
  const coverKey = 'podcasts/cover.jpg';
  const candidates = [
    { path: path.join(__dirname, 'assets/logo-gd-spotify.png'), mime: 'image/png' },
    { path: path.join(__dirname, '../grace-daily/public/logo-gd-spotify.png'), mime: 'image/png' },
    { path: path.join(__dirname, '../grace-daily/public/graced-logo.jpg'), mime: 'image/jpeg' },
    { path: path.join(__dirname, '../grace-daily/Grace-Daily.jpg'), mime: 'image/jpeg' },
  ];
  for (const c of candidates) {
    if (existsSync(c.path)) {
      await uploadToR2(c.path, coverKey, c.mime);
      if (c.mime === 'image/png') await uploadToR2(c.path, 'podcasts/cover.png', 'image/png');
      console.log(`[R2] Cover image uploaded: ${path.basename(c.path)}`);
      return;
    }
  }
  console.warn('[R2] No local cover image found — using existing R2 cover if available.');
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. RSS XML GENERATOR
// ─────────────────────────────────────────────────────────────────────────────
function generateRssXml(items, langConfig) {
  const coverUrl = `${r2PublicUrl}/podcasts/cover.jpg`;
  const year = new Date().getFullYear();
  const appUrl = 'https://www.gracedaily.my.id';

  const itemsXml = items.map(item => `
    <item>
      <title>${escapeXml(item.title)}</title>
      <description>${escapeXml(item.description)}</description>
      <pubDate>${item.pubDate}</pubDate>
      <guid isPermaLink="false">${escapeXml(item.id)}-${langConfig.code}</guid>
      <enclosure url="${escapeXml(item.audioUrl)}" length="${item.audioSize}" type="audio/mpeg"/>
      <itunes:author>Grace Daily</itunes:author>
      <itunes:explicit>false</itunes:explicit>
      <itunes:duration>${item.duration}</itunes:duration>
      <itunes:image href="${escapeXml(item.imageUrl || coverUrl)}"/>
    </item>`).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
     xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
     xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${escapeXml(langConfig.channelTitle)}</title>
    <link>${appUrl}</link>
    <language>${langConfig.rssLang}</language>
    <copyright>&#169; ${year} Grace Daily</copyright>
    <itunes:author>Grace Daily</itunes:author>
    <description>${escapeXml(langConfig.channelDesc)}</description>
    <itunes:subtitle>${escapeXml(langConfig.channelDesc.substring(0, 100))}</itunes:subtitle>
    <itunes:summary>${escapeXml(langConfig.channelDesc)}</itunes:summary>
    <itunes:type>episodic</itunes:type>
    <itunes:owner>
      <itunes:name>Grace Daily</itunes:name>
      <itunes:email>dailygrace168@gmail.com</itunes:email>
    </itunes:owner>
    <itunes:image href="${coverUrl}"/>
    <itunes:category text="Religion &amp; Spirituality">
      <itunes:category text="Christianity"/>
    </itunes:category>
    <itunes:explicit>false</itunes:explicit>
    ${itemsXml}
  </channel>
</rss>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. TELEGRAM NOTIFICATION
// ─────────────────────────────────────────────────────────────────────────────
async function sendTelegramMessage(text) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) {
    console.log('[Telegram] Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID — skipping.');
    return;
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('[Telegram] API error:', err.description || res.statusText);
    } else {
      console.log('[Telegram] ✅ Notification sent.');
    }
  } catch (err) {
    console.error('[Telegram] Request failed:', err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. MAIN EXECUTION FLOW
// ─────────────────────────────────────────────────────────────────────────────
async function run() {
  const todayStr = getJakartaDateStr();
  console.log('\n=========================================');
  console.log(`🎙️  Multilingual Podcast Generator`);
  console.log(`📅  Date (WIB): ${todayStr}`);
  console.log(`🌐  Languages: ID | EN | ZH | ES`);
  console.log('=========================================\n');

  await ensureCoverImage();

  const tempDir = path.join(__dirname, 'temp');
  await fs.mkdir(tempDir, { recursive: true });

  // ── Fetch source content from Firestore ──────────────────────────────────
  console.log('[Firestore] Fetching daily devotion from daily_devotions...');
  let devData = null;

  // 1. Direct doc ID lookups (golden-YYYY-MM-DD-05, golden-YYYY-MM-DD-00, YYYY-MM-DD)
  const docCandidates = [`golden-${todayStr}-05`, `golden-${todayStr}-00`, todayStr];
  for (const candidateId of docCandidates) {
    try {
      const docSnap = await db.collection('daily_devotions').doc(candidateId).get();
      if (docSnap.exists) {
        devData = docSnap.data();
        console.log(`[Firestore] Devotion found via doc ID "${candidateId}"`);
        break;
      }
    } catch (docErr) {
      console.warn(`[Firestore] Direct lookup for ${candidateId} failed:`, docErr.message);
    }
  }

  // 2. Query by dateId
  if (!devData) {
    try {
      const qSnap = await db.collection('daily_devotions')
        .where('dateId', '==', todayStr)
        .limit(1)
        .get();
      if (!qSnap.empty) {
        devData = qSnap.docs[0].data();
        console.log(`[Firestore] Devotion found via dateId query "${todayStr}"`);
      }
    } catch (qErr) {
      console.warn('[Firestore] Query by dateId failed:', qErr.message);
    }
  }

  // 3. Query by contentDayKey
  if (!devData) {
    try {
      const qSnap = await db.collection('daily_devotions')
        .where('contentDayKey', '==', todayStr)
        .limit(1)
        .get();
      if (!qSnap.empty) {
        devData = qSnap.docs[0].data();
        console.log(`[Firestore] Devotion found via contentDayKey query "${todayStr}"`);
      }
    } catch (qErr) {
      console.warn('[Firestore] Query by contentDayKey failed:', qErr.message);
    }
  }

  // 4. Fallback scan without index dependency
  if (!devData) {
    try {
      const devSnap = await db.collection('daily_devotions')
        .orderBy('generatedAt', 'desc')
        .limit(20)
        .get();

      if (!devSnap.empty) {
        const match = devSnap.docs.find(d => {
          const data = d.data();
          const key = data.contentDayKey || data.dateId || d.id;
          return key.includes(todayStr);
        });
        if (match) devData = match.data();
      }
    } catch (scanErr) {
      console.warn('[Firestore] Scan fallback error:', scanErr.message);
    }
  }

  if (devData) {
    console.log(`[Firestore] ✅ Devotion found: "${devData.title}"`);
  } else {
    console.log(`[Firestore] ⚠️  No devotion found for ${todayStr}`);
  }

  console.log('[Firestore] Fetching blog post from blog_posts...');
  let blogData = null;
  let blogDocId = null;
  try {
    const blogSnap = await db.collection('blog_posts')
      .where('contentDayKey', '==', todayStr)
      .limit(1)
      .get();
    if (!blogSnap.empty) {
      blogData = blogSnap.docs[0].data();
      blogDocId = blogSnap.docs[0].id;
    }
  } catch (blogErr) {
    console.warn('[Firestore] Blog lookup failed:', blogErr.message);
  }

  if (blogData) {
    console.log(`[Firestore] ✅ Blog found: "${blogData.title}"`);
  } else {
    console.log(`[Firestore] ⚠️  No blog post found for ${todayStr}`);
  }

  if (!devData && !blogData) {
    console.log('\n[Main] No content found for today. Nothing to publish.');
    await sendTelegramMessage(
      `⚠️ <b>Podcast Generator</b>\n` +
      `Tidak ada renungan atau artikel untuk tanggal <b>${todayStr}</b>.\n` +
      `RSS feed tidak diperbarui.`
    );
    process.exit(0);
  }

  const langResults = {};
  const globalErrors = [];

  // ── Process each language ─────────────────────────────────────────────────
  for (const lang of LANGUAGES) {
    console.log(`\n── Processing: ${lang.name} (${lang.code.toUpperCase()}) ──`);
    const langErrors = [];
    const newItems = [];
    const formattedDate = getFormattedDate(lang.dateLocale);

    // Rule for EN, ZH, ES: Max 60 devotion episodes to build initial collection.
    // After 60 days/episodes, stop generating new audio MP3s for EN/ZH/ES.
    let skipLanguageAudio = false;
    if (lang.code !== 'id') {
      try {
        const existingItems = await downloadPodcastIndex(lang.jsonFile);
        const devotionEpisodeCount = existingItems.filter(i => i.id && i.id.startsWith('devotion-')).length;
        if (devotionEpisodeCount >= 60) {
          console.log(`[${lang.code}] ℹ️  Koleksi ${lang.name} sudah mencapai ${devotionEpisodeCount} episode (>= 60). Tidak membuat podcast MP3 baru.`);
          skipLanguageAudio = true;
        }
      } catch (checkErr) {
        console.warn(`[${lang.code}] Failed to check existing index for 60-day limit:`, checkErr.message);
      }
    }

    if (!skipLanguageAudio) {
      // ── DEVOTION ──────────────────────────────────────────────────────
      if (devData) {
        try {
          console.log(`[${lang.code}] Preparing devotion content...`);

          let title = cleanHtmlToText(devData.title || 'Hari Ini');
          let verseRef = devData.verseRef || '';
          let verseText = cleanHtmlToText(devData.verseText || '');
          let body = cleanHtmlToText(devData.body || '');
          let prayer = cleanHtmlToText(devData.prayer || '');

          if (lang.code !== 'id') {
            console.log(`[${lang.code}] Translating devotion (title, verse, body, prayer)...`);
            [title, verseText, body] = await Promise.all([
              translateText(title, lang.code),
              translateText(verseText, lang.code),
              translateText(body, lang.code),
            ]);
            if (prayer) {
              prayer = await translateText(prayer, lang.code);
            }
            console.log(`[${lang.code}] Translation complete.`);
          }

          const spokenText = lang.buildDevotionText(
            formattedDate, title, verseRef, verseText, body, prayer
          );

          const audioFile = `devotion-${todayStr}-${lang.code}.mp3`;
          const localPath = path.join(tempDir, audioFile);
          const r2Key = `podcasts/${audioFile}`;

          console.log(`[${lang.code}] Synthesizing TTS — voice: ${lang.devotionVoice}...`);
          const buffer = await textToSpeech(spokenText, lang, localPath, true);

          console.log(`[${lang.code}] Uploading devotion audio to R2...`);
          const audioUrl = await uploadToR2(localPath, r2Key, 'audio/mpeg');
          console.log(`[${lang.code}] ✅ Uploaded: ${audioUrl}`);

          const podTitle = {
            id: `Renungan Harian: ${title}`,
            en: `Daily Devotion: ${title}`,
            zh: `每日灵修：${title}`,
            es: `Devoción Diaria: ${title}`,
          }[lang.code];

          newItems.push({
            id: `devotion-${todayStr}`,
            title: podTitle,
            description: verseRef
              ? `${verseRef}. ${body.substring(0, 200)}...`
              : body.substring(0, 250) + '...',
            pubDate: getWibPubDate(todayStr, 5, 0),
            audioUrl,
            audioSize: buffer.length,
            audioKey: r2Key,
            duration: estimateDuration(spokenText),
            createdAt: new Date().toISOString(),
            imageUrl: devData.bannerUrl || devData.imageUrl || null,
            lang: lang.code,
          });

          console.log(`[${lang.code}] ✅ Devotion item queued.`);
        } catch (err) {
          console.error(`[${lang.code}] ❌ Devotion failed:`, err.message);
          langErrors.push(`Devotion: ${err.message}`);
          globalErrors.push(`[${lang.code.toUpperCase()}] Devotion: ${err.message}`);
        }
      }

      // ── BLOG ARTICLE ──────────────────────────────────────────────────
      if (blogData) {
        try {
          console.log(`[${lang.code}] Preparing blog content...`);

          let title = cleanHtmlToText(blogData.title || 'Artikel Hari Ini');
          let excerpt = cleanHtmlToText(blogData.excerpt || '');
          let body = cleanHtmlToText(blogData.body || '');
          const author = blogData.authorName || 'Grace Daily';

          if (lang.code !== 'id') {
            console.log(`[${lang.code}] Translating blog article...`);
            [title, body] = await Promise.all([
              translateText(title, lang.code),
              translateText(body, lang.code),
            ]);
            if (excerpt) excerpt = await translateText(excerpt, lang.code);
            console.log(`[${lang.code}] Blog translation complete.`);
          }

          const spokenText = lang.buildBlogText(
            formattedDate, title, author, excerpt, body
          );

          const audioFile = `blog-${todayStr}-${lang.code}.mp3`;
          const localPath = path.join(tempDir, audioFile);
          const r2Key = `podcasts/${audioFile}`;

          console.log(`[${lang.code}] Synthesizing TTS — voice: ${lang.blogVoice}...`);
          const buffer = await textToSpeech(spokenText, lang, localPath, false);

          console.log(`[${lang.code}] Uploading blog audio to R2...`);
          const audioUrl = await uploadToR2(localPath, r2Key, 'audio/mpeg');
          console.log(`[${lang.code}] ✅ Uploaded: ${audioUrl}`);

          const podTitle = {
            id: `Artikel: ${title}`,
            en: `Article: ${title}`,
            zh: `文章：${title}`,
            es: `Artículo: ${title}`,
          }[lang.code];

          newItems.push({
            id: `blog-${blogDocId}`,
            title: podTitle,
            description: (excerpt || body).substring(0, 250) + '...',
            pubDate: getWibPubDate(todayStr, 6, 0),
            audioUrl,
            audioSize: buffer.length,
            audioKey: r2Key,
            duration: estimateDuration(spokenText),
            createdAt: new Date().toISOString(),
            imageUrl: blogData.imageUrl || null,
            lang: lang.code,
          });

          console.log(`[${lang.code}] ✅ Blog item queued.`);
        } catch (err) {
          console.error(`[${lang.code}] ❌ Blog failed:`, err.message);
          langErrors.push(`Blog: ${err.message}`);
          globalErrors.push(`[${lang.code.toUpperCase()}] Blog: ${err.message}`);
        }
      }
    }

    langResults[lang.code] = { items: newItems, errors: langErrors };

    // ── Update RSS feed for this language ─────────────────────────────
    if (newItems.length > 0 || lang.code === 'id') {
      try {
        console.log(`[${lang.code}] Updating RSS feed...`);
        const existingItems = await downloadPodcastIndex(lang.jsonFile);

        // Merge: remove existing items with same IDs, put new ones first
        const newIds = new Set(newItems.map(i => i.id));
        const filtered = existingItems.filter(i => !newIds.has(i.id));
        const merged = [...newItems, ...filtered];

        // Sort by pubDate descending
        merged.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

        let active = merged;
        let expired = [];

        if (lang.code === 'id') {
          // Retention rule for Indonesian: Keep only last 300 days of podcast items
          const cutoffTime = Date.now() - 300 * 24 * 60 * 60 * 1000;
          active = merged.filter(item => {
            const itemDate = new Date(item.pubDate).getTime();
            return !isNaN(itemDate) ? itemDate >= cutoffTime : true;
          });
          expired = merged.filter(item => {
            const itemDate = new Date(item.pubDate).getTime();
            return !isNaN(itemDate) ? itemDate < cutoffTime : false;
          });
        } else {
          // Keep all created episodes for EN, ZH, ES forever
          active = merged;
          expired = [];
        }

        console.log(`[${lang.code}] Active: ${active.length}, Expired: ${expired.length}`);

        // Delete expired MP3s from R2
        for (const item of expired) {
          if (item.audioKey) {
            try {
              await s3.send(new DeleteObjectCommand({ Bucket: r2BucketName, Key: item.audioKey }));
              console.log(`[${lang.code}] Deleted expired (>300 days): ${item.audioKey}`);
            } catch (delErr) {
              console.warn(`[${lang.code}] Could not delete ${item.audioKey}: ${delErr.message}`);
            }
          }
        }

        if (newItems.length > 0 || expired.length > 0) {
          // Upload updated JSON index
          const indexJson = JSON.stringify(active, null, 2);
          await uploadStringToR2(indexJson, `podcasts/${lang.jsonFile}`, 'application/json; charset=UTF-8');
          console.log(`[${lang.code}] Index saved: podcasts/${lang.jsonFile}`);

          // Upload RSS XML
          const rssXml = generateRssXml(active, lang);
          await uploadStringToR2(rssXml, `podcasts/${lang.feedFile}`, 'application/xml; charset=UTF-8');
          console.log(`[${lang.code}] RSS feed saved: podcasts/${lang.feedFile} ✅`);

          // ID feed also updates legacy podcast.xml (backward compatibility for Spotify)
          if (lang.code === 'id') {
            await uploadStringToR2(rssXml, 'podcasts/podcast.xml', 'application/xml; charset=UTF-8');
            await uploadStringToR2(indexJson, 'podcasts/podcast.json', 'application/json; charset=UTF-8');
            console.log(`[ID] ✅ Legacy podcast.xml and podcast.json also updated.`);
          }
        } else {
          console.log(`[${lang.code}] Index and feed are already up to date.`);
        }

      } catch (feedErr) {
        console.error(`[${lang.code}] ❌ Feed update failed:`, feedErr.message);
        globalErrors.push(`[${lang.code.toUpperCase()}] Feed: ${feedErr.message}`);
      }
    } else {
      console.log(`[${lang.code}] No new items for this language — feed unchanged.`);
    }
  }

  // ── Cleanup temp directory ────────────────────────────────────────────────
  try {
    const files = await fs.readdir(tempDir);
    for (const file of files) await fs.unlink(path.join(tempDir, file));
    await fs.rmdir(tempDir);
    console.log('\n[Temp] Local temp files cleaned up.');
  } catch (cleanErr) {
    console.warn('[Temp] Cleanup failed:', cleanErr.message);
  }

  // ── Telegram report ───────────────────────────────────────────────────────
  const totalNewItems = Object.values(langResults).reduce((sum, r) => sum + r.items.length, 0);

  if (totalNewItems > 0 || globalErrors.length > 0) {
    let msg = `🎙️ <b>Podcast Multilingual Grace Daily</b>\n📅 ${todayStr}\n\n`;

    if (totalNewItems > 0) {
      msg += `✅ <b>Episode baru diterbitkan:</b>\n`;
      for (const [code, result] of Object.entries(langResults)) {
        if (result.items.length > 0) {
          const lang = LANGUAGES.find(l => l.code === code);
          const flag = { id: '🇮🇩', en: '🇬🇧', zh: '🇨🇳', es: '🇪🇸' }[code];
          msg += `\n${flag} <b>${lang.name}</b>:\n`;
          result.items.forEach(item => { msg += `  • ${item.title}\n`; });
        }
      }
      msg += `\n📡 <b>RSS Feeds (gracedaily.my.id):</b>\n`;
      msg += `  🇮🇩 <a href="https://www.gracedaily.my.id/podcast.xml">Bahasa Indonesia</a>\n`;
      msg += `  🇬🇧 <a href="https://www.gracedaily.my.id/podcast-en.xml">English</a>\n`;
      msg += `  🇨🇳 <a href="https://www.gracedaily.my.id/podcast-zh.xml">中文</a>\n`;
      msg += `  🇪🇸 <a href="https://www.gracedaily.my.id/podcast-es.xml">Español</a>\n`;
      msg += `\n🎵 <b>Spotify Show:</b> <a href="https://open.spotify.com/show/033VlYDoXnGLvwQEfe4CnP">Grace Daily Podcast</a>`;
    }

    if (globalErrors.length > 0) {
      msg += `\n\n⚠️ <b>Errors (${globalErrors.length}):</b>\n`;
      msg += globalErrors.map(e => `• ${e}`).join('\n');
    }

    await sendTelegramMessage(msg);
  } else {
    console.log('\n[Main] No new items generated today. No Telegram notification sent.');
  }

  console.log('\n=========================================');
  console.log('✅ Podcast generation complete.');
  console.log('=========================================\n');
}

run().catch(async err => {
  console.error('❌ Fatal error:', err);
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (botToken && chatId) {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: `❌ <b>Fatal Podcast Generator Error</b>\n<code>${err.message}</code>`,
        parse_mode: 'HTML',
      }),
    }).catch(() => { });
  }
  process.exit(1);
});
