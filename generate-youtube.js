import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { google } from 'googleapis';
import { UniversalEdgeTTS } from 'edge-tts-universal';
import { execSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync, createReadStream, unlinkSync, readFileSync } from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─────────────────────────────────────────────────────────────────────────────
// 1. LOAD ENVIRONMENT VARIABLES
// ─────────────────────────────────────────────────────────────────────────────
const envLocalPath = path.join(__dirname, '../grace-daily/.env.local');
if (existsSync(envLocalPath)) {
  const envContent = readFileSync(envLocalPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?$/);
    if (match) {
      const key = match[1];
      let value = (match[2] || '').trim();
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  });
  console.log('[Env] Loaded from grace-daily/.env.local');
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. VALIDATE CREDENTIALS
// ─────────────────────────────────────────────────────────────────────────────
const r2AccountId       = process.env.R2_ACCOUNT_ID;
const r2AccessKeyId     = process.env.R2_ACCESS_KEY_ID;
const r2SecretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const r2BucketName      = process.env.R2_BUCKET_NAME;
const r2PublicUrl       = (process.env.R2_PUBLIC_URL || process.env.NEXT_PUBLIC_R2_PUBLIC_URL || '').replace(/\/$/, '');
const telegramBotToken  = process.env.TELEGRAM_BOT_TOKEN;
const telegramChatId    = process.env.TELEGRAM_CHAT_ID;
const ytRefreshToken    = process.env.YOUTUBE_REFRESH_TOKEN;

// Optional social sharing
const fbPageId          = process.env.FACEBOOK_PAGE_ID;
const fbAccessToken     = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
const igUserId          = process.env.INSTAGRAM_USER_ID;

let clientId     = process.env.YOUTUBE_CLIENT_ID;
let clientSecret = process.env.YOUTUBE_CLIENT_SECRET;

// Fallback: read client_secret from file (for local dev)
if (!clientId || !clientSecret) {
  const clientSecretPath = path.join(
    __dirname,
    '../grace-daily/client_secret_249330727164-v7hffhfcl06afqhqk0jhujiqf792631b.apps.googleusercontent.com.json'
  );
  if (existsSync(clientSecretPath)) {
    try {
      const creds = JSON.parse(readFileSync(clientSecretPath, 'utf8'));
      clientId     = creds.installed.client_id;
      clientSecret = creds.installed.client_secret;
      console.log('[YouTube] Loaded credentials from client_secret JSON file.');
    } catch (e) {
      console.warn('⚠️ Failed to parse client_secret JSON:', e.message);
    }
  }
}

if (!r2AccountId || !r2AccessKeyId || !r2SecretAccessKey || !r2BucketName || !r2PublicUrl) {
  console.error('❌ Missing Cloudflare R2 credentials.');
  process.exit(1);
}

if (!clientId || !clientSecret || !ytRefreshToken) {
  console.error('❌ Missing YouTube OAuth2 credentials (YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN).');
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. INITIALIZE FIREBASE
// ─────────────────────────────────────────────────────────────────────────────
let firebaseApp;
const serviceAccountPath = path.join(__dirname, '../service-account.json');
if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  firebaseApp = initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)) });
  console.log('[Firebase] Initialized via FIREBASE_SERVICE_ACCOUNT_JSON.');
} else if (existsSync(serviceAccountPath)) {
  firebaseApp = initializeApp({ credential: cert(JSON.parse(readFileSync(serviceAccountPath, 'utf-8'))) });
  console.log(`[Firebase] Initialized via local service-account.json`);
} else {
  console.error('❌ Firebase Service Account credentials not found.');
  process.exit(1);
}
const db = getFirestore(firebaseApp);

// ─────────────────────────────────────────────────────────────────────────────
// 4. INITIALIZE R2 AND YOUTUBE
// ─────────────────────────────────────────────────────────────────────────────
const s3 = new S3Client({
  endpoint: `https://${r2AccountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: r2AccessKeyId, secretAccessKey: r2SecretAccessKey },
  region: 'auto',
});

const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, 'http://localhost');
oauth2Client.setCredentials({ refresh_token: ytRefreshToken });
const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

// Ensure temp and assets directories exist
const tempDir   = path.join(__dirname, 'temp');
const assetsDir = path.join(__dirname, 'assets');
if (!existsSync(tempDir))   mkdirSync(tempDir);
if (!existsSync(assetsDir)) mkdirSync(assetsDir);

// ─────────────────────────────────────────────────────────────────────────────
// 5. HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * FIX: Use Asia/Jakarta timezone — previous version used server local time (UTC in GitHub Actions),
 * causing the script to search for yesterday's data when running at 22:30 UTC (= 05:30 WIB next day).
 */
function formatDate(date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function getIndonesianDateString(date) {
  const months = ['Januari','Februari','Maret','April','Mei','Juni',
                  'Juli','Agustus','September','Oktober','November','Desember'];
  const days = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
  // Use Intl to get correct Jakarta day/date
  const jakartaFormatter = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return jakartaFormatter.format(date);
}

function cleanHtmlToText(html) {
  if (!html) return '';
  let text = html;
  text = text.replace(/<\/h[1-6]>/gi, '. ');
  text = text.replace(/<\/p>/gi, '\n');
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<blockquote[^>]*>/gi, ' Kutipan: "');
  text = text.replace(/<\/blockquote>/gi, '" ');
  text = text.replace(/<[^>]*>/g, ' ');
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'");
  text = text.replace(/[#*_\[\]()\-+=:,]/g, ' ');
  return text.replace(/\s+/g, ' ').trim();
}

async function downloadFileFromUrl(url, dest) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  });
  if (!response.ok) {
    throw new Error(`Download failed: HTTP ${response.status} ${response.statusText}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  writeFileSync(dest, buffer);
}

async function uploadToR2(localPath, key, contentType) {
  await s3.send(new PutObjectCommand({
    Bucket: r2BucketName,
    Key: key,
    Body: createReadStream(localPath),
    ContentType: contentType,
    CacheControl: 'public, max-age=2592000',
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. FIREBASE DATA FETCHERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * FIX: Collection was 'devotions' — correct collection is 'daily_devotions'.
 * This was causing the YouTube generator to find no data every day.
 */
async function fetchDevotion(dateStr) {
  const docRef = db.collection('daily_devotions').doc(dateStr);
  const doc = await docRef.get();
  if (doc.exists) return doc.data();

  // Fallback: search by dateId/contentDayKey
  const snap = await db.collection('daily_devotions')
    .where('status', '==', 'published')
    .orderBy('generatedAt', 'desc')
    .limit(10)
    .get();

  if (!snap.empty) {
    const match = snap.docs.find(d => {
      const data = d.data();
      const key = data.contentDayKey || data.dateId || d.id;
      return key.includes(dateStr);
    });
    if (match) return match.data();
  }
  return null;
}

async function fetchBlogPosts(dateStr) {
  const snapshot = await db.collection('blog_posts')
    .where('contentDayKey', '==', dateStr)
    .where('status', '==', 'published')
    .get();
  if (snapshot.empty) return [];
  const posts = [];
  snapshot.forEach(doc => posts.push({ id: doc.id, ...doc.data() }));
  return posts;
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. ASSETS & VIDEO GENERATION
// ─────────────────────────────────────────────────────────────────────────────
async function ensureBgMusic() {
  const bgMusicPath = path.join(assetsDir, 'bg-music.mp3');
  if (existsSync(bgMusicPath)) return bgMusicPath;

  console.log('[Assets] Downloading royalty-free background music...');
  const musicUrl = 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Gymnopedie%20No%201.mp3';
  try {
    await downloadFileFromUrl(musicUrl, bgMusicPath);
    console.log('[Assets] Background music downloaded successfully.');
    return bgMusicPath;
  } catch (e) {
    console.error('⚠️ Failed to download background music:', e.message);
    return null;
  }
}

function mixAndCreateVideo(imagePath, ttsPath, bgMusicPath, outputPath) {
  try {
    console.log(`[FFmpeg] Building video: ${path.basename(outputPath)}`);
    execSync('ffmpeg -version', { stdio: 'ignore' });
    const cmd = `ffmpeg -y -loop 1 -i "${imagePath}" -i "${ttsPath}" -i "${bgMusicPath}" ` +
      `-filter_complex "[2:a]volume=0.15[bg];[1:a][bg]amix=inputs=2:duration=first[a]" ` +
      `-map 0:v -map "[a]" -c:v libx264 -tune stillimage -c:a aac -b:a 192k -pix_fmt yuv420p -shortest "${outputPath}"`;
    execSync(cmd, { stdio: 'inherit' });
    console.log(`[FFmpeg] ✅ Video created: ${path.basename(outputPath)}`);
    return true;
  } catch (e) {
    console.error('❌ FFmpeg failed:', e.message);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. PLATFORM UPLOAD FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/** Upload video to YouTube */
async function uploadToYouTube(videoPath, title, description) {
  console.log(`[YouTube] Uploading: "${title}"`);
  const res = await youtube.videos.insert({
    part: 'snippet,status',
    requestBody: {
      snippet: {
        title: title.slice(0, 100),
        description,
        categoryId: '22',
        defaultLanguage: 'id',
        defaultAudioLanguage: 'id',
      },
      status: {
        privacyStatus: 'public',
        selfDeclaredMadeForKids: false,
      },
    },
    media: { body: createReadStream(videoPath) },
  });
  const ytUrl = `https://www.youtube.com/watch?v=${res.data.id}`;
  console.log(`[YouTube] ✅ Uploaded: ${ytUrl}`);
  return ytUrl;
}

/**
 * Share video to Facebook Pages using file_url (R2 public URL).
 * Requires env vars: FACEBOOK_PAGE_ID, FACEBOOK_PAGE_ACCESS_TOKEN
 */
async function shareToFacebook(videoR2Url, title, description) {
  if (!fbPageId || !fbAccessToken) {
    console.log('[Facebook] Missing FACEBOOK_PAGE_ID or FACEBOOK_PAGE_ACCESS_TOKEN — skipping.');
    return null;
  }

  console.log('[Facebook] Uploading video to Page...');
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${fbPageId}/videos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file_url: videoR2Url,
        title: title.slice(0, 255),
        description: description.slice(0, 2000),
        published: true,
        access_token: fbAccessToken,
      }),
    });

    const data = await res.json();
    if (!res.ok || data.error) {
      throw new Error(data.error?.message || `HTTP ${res.status}`);
    }

    const fbUrl = `https://www.facebook.com/video/${data.id}`;
    console.log(`[Facebook] ✅ Video published: ${fbUrl}`);
    return fbUrl;
  } catch (e) {
    console.error('[Facebook] ❌ Upload failed:', e.message);
    throw e;
  }
}

/**
 * Share video as Instagram Reels using R2 public URL.
 * Requires env vars: INSTAGRAM_USER_ID, FACEBOOK_PAGE_ACCESS_TOKEN
 * Note: Instagram processes videos asynchronously — polls for up to 5 minutes.
 */
async function shareToInstagram(videoR2Url, caption) {
  if (!igUserId || !fbAccessToken) {
    console.log('[Instagram] Missing INSTAGRAM_USER_ID or FACEBOOK_PAGE_ACCESS_TOKEN — skipping.');
    return null;
  }

  console.log('[Instagram] Creating Reels media container...');
  try {
    // Step 1: Create media container
    const containerRes = await fetch(`https://graph.facebook.com/v21.0/${igUserId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        media_type: 'REELS',
        video_url: videoR2Url,
        caption: caption.slice(0, 2200),
        access_token: fbAccessToken,
      }),
    });

    const containerData = await containerRes.json();
    if (!containerRes.ok || containerData.error) {
      throw new Error(containerData.error?.message || `Container creation HTTP ${containerRes.status}`);
    }
    const creationId = containerData.id;
    console.log(`[Instagram] Container created: ${creationId} — waiting for processing...`);

    // Step 2: Poll for processing status (max 5 min)
    let status = 'IN_PROGRESS';
    let attempts = 0;
    const maxAttempts = 20; // 20 × 15s = 5 minutes max wait

    while (status === 'IN_PROGRESS' && attempts < maxAttempts) {
      await new Promise(r => setTimeout(r, 15000)); // wait 15 seconds
      attempts++;

      const statusRes = await fetch(
        `https://graph.facebook.com/v21.0/${creationId}?fields=status_code&access_token=${fbAccessToken}`
      );
      const statusData = await statusRes.json();
      status = statusData.status_code || 'ERROR';
      console.log(`[Instagram] Status: ${status} (${attempts}/${maxAttempts})`);

      if (status === 'ERROR') {
        throw new Error(`Instagram media processing error: ${JSON.stringify(statusData)}`);
      }
    }

    if (status !== 'FINISHED') {
      throw new Error(`Instagram media processing timeout after ${maxAttempts} attempts. Last status: ${status}`);
    }

    // Step 3: Publish the Reel
    console.log('[Instagram] Publishing Reel...');
    const publishRes = await fetch(`https://graph.facebook.com/v21.0/${igUserId}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creation_id: creationId, access_token: fbAccessToken }),
    });

    const publishData = await publishRes.json();
    if (!publishRes.ok || publishData.error) {
      throw new Error(publishData.error?.message || `Publish HTTP ${publishRes.status}`);
    }

    console.log(`[Instagram] ✅ Reel published. Media ID: ${publishData.id}`);
    return publishData.id;
  } catch (e) {
    console.error('[Instagram] ❌ Failed:', e.message);
    throw e;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. TELEGRAM REPORTER
// ─────────────────────────────────────────────────────────────────────────────
async function sendTelegramMessage(text) {
  if (!telegramBotToken || !telegramChatId) {
    console.warn('⚠️ TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID missing — skipping notification.');
    return;
  }
  const url = `https://api.telegram.org/bot${telegramBotToken}/sendMessage`;
  const postData = JSON.stringify({
    chat_id: telegramChatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  });

  return new Promise(resolve => {
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    }, res => { resolve(); });
    req.on('error', () => resolve());
    req.write(postData);
    req.end();
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. R2 CLEANUP (delete videos older than 3 days)
// ─────────────────────────────────────────────────────────────────────────────
async function cleanupOldVideos() {
  console.log('[Cleanup] Scanning R2 for expired videos...');
  const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
  try {
    const listResult = await s3.send(new ListObjectsV2Command({
      Bucket: r2BucketName,
      Prefix: 'videos/',
    }));

    if (!listResult.Contents || listResult.Contents.length === 0) {
      console.log('[Cleanup] No video files found.');
      return;
    }

    let deletedCount = 0;
    for (const item of listResult.Contents) {
      if (item.Key === 'videos/') continue;
      const lastModified = new Date(item.LastModified).getTime();
      if (lastModified < threeDaysAgo) {
        console.log(`[Cleanup] Deleting expired: ${item.Key}`);
        await s3.send(new DeleteObjectCommand({ Bucket: r2BucketName, Key: item.Key }));
        deletedCount++;
      }
    }
    console.log(`[Cleanup] Deleted ${deletedCount} expired video(s).`);
  } catch (e) {
    console.warn('⚠️ Video cleanup failed:', e.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 11. MAIN EXECUTION FLOW
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  const targetDate = new Date();
  // FIX: formatDate() now uses Asia/Jakarta timezone
  const dateStr     = formatDate(targetDate);
  const dateIndoStr = getIndonesianDateString(targetDate);

  console.log('\n=========================================');
  console.log(`🎬  YouTube Video Generator`);
  console.log(`📅  Date (WIB): ${dateStr}`);
  console.log(`📅  Date (ID):  ${dateIndoStr}`);
  console.log('=========================================\n');

  const bgMusicFile = await ensureBgMusic();
  if (!bgMusicFile) {
    await sendTelegramMessage('❌ <b>YouTube Generator Error</b>\nGagal mengunduh musik latar. Proses dihentikan.');
    process.exit(1);
  }

  // Load cover/logo image
  const selfCoverPath    = path.join(assetsDir, 'default-cover.jpg');
  const defaultCoverPath = path.join(__dirname, '../grace-daily/public/graced-logo.jpg');
  const fallbackCoverPath = path.join(__dirname, '../grace-daily/Grace-Daily.jpg');
  let localImagePath = existsSync(selfCoverPath) ? selfCoverPath
    : existsSync(defaultCoverPath) ? defaultCoverPath
    : existsSync(fallbackCoverPath) ? fallbackCoverPath
    : null;

  const successList = [];
  const errorList   = [];

  // ── A. DEVOTION VIDEO ───────────────────────────────────────────────────
  try {
    // FIX: Collection was 'devotions' — now correctly 'daily_devotions'
    const devotion = await fetchDevotion(dateStr);
    if (devotion) {
      console.log(`[Devotion] Found: "${devotion.title}"`);
      const title     = `Renungan Harian: ${devotion.title || 'Hari Ini'}`;
      const cleanBody  = cleanHtmlToText(devotion.body);
      const cleanPrayer = cleanHtmlToText(devotion.prayer);

      const fullText = `Renungan Harian Grace Daily, ${dateIndoStr}. ` +
        `Judul: ${devotion.title || 'Hari Ini'}. ` +
        `Ayat hari ini diambil dari ${devotion.verseRef || ''}, yang berbunyi: ${devotion.verseText || ''}. ` +
        `Mari kita dengarkan renungannya. ` +
        `${cleanBody} ` +
        (cleanPrayer ? `Mari kita bersatu di dalam doa. ${cleanPrayer}` : '');

      const cleanText    = cleanHtmlToText(fullText);
      const tempTtsPath  = path.join(tempDir, `devotion-${dateStr}.mp3`);

      console.log('[Devotion] Synthesizing speech (id-ID-GadisNeural)...');
      const tts = new UniversalEdgeTTS(cleanText, 'id-ID-GadisNeural');
      const result = await tts.synthesize();
      writeFileSync(tempTtsPath, Buffer.from(await result.audio.arrayBuffer()));
      console.log('[Devotion] Speech synthesis complete.');

      // Resolve background image (custom banner or fallback logo)
      let videoImagePath = localImagePath;
      let devotionImgDownloaded = false;
      const tempImagePath = path.join(tempDir, `devotion-${dateStr}.jpg`);
      if (devotion.bannerUrl || devotion.imageUrl) {
        try {
          await downloadFileFromUrl(devotion.bannerUrl || devotion.imageUrl, tempImagePath);
          videoImagePath = tempImagePath;
          devotionImgDownloaded = true;
          console.log('[Devotion] Custom banner downloaded.');
        } catch (e) {
          console.warn('⚠️ Custom banner download failed — using fallback logo.');
        }
      }
      if (!videoImagePath) throw new Error('No background image found (logo/banner).');

      // Generate video
      const tempVideoPath = path.join(tempDir, `devotion-${dateStr}.mp4`);
      const mixSuccess = mixAndCreateVideo(videoImagePath, tempTtsPath, bgMusicFile, tempVideoPath);
      if (!mixSuccess) throw new Error('FFmpeg video compilation failed.');

      // Upload to R2 first (needed for Facebook & Instagram)
      const r2Key  = `videos/devotion-${dateStr}.mp4`;
      console.log('[Devotion] Uploading MP4 to R2...');
      await uploadToR2(tempVideoPath, r2Key, 'video/mp4');
      const r2VideoUrl = `${r2PublicUrl}/${r2Key}`;
      console.log(`[Devotion] R2 URL: ${r2VideoUrl}`);

      // Upload to YouTube
      const ytDesc = `${title}\n\nAyat Hari Ini: ${devotion.verseRef || ''}\n\n` +
        `${devotion.verseText || ''}\n\n${cleanBody.substring(0, 500)}\n\n` +
        `Baca renungan lengkap & artikel Kristen setiap hari:\n👉 https://gracedaily.my.id\n\n` +
        `#renunganharian #alkitab #kristen #gracedaily #devotional`;
      const ytUrl = await uploadToYouTube(tempVideoPath, `${title} - ${dateIndoStr}`, ytDesc);

      const successEntry = { type: 'Renungan', title: devotion.title, ytUrl, r2Url: r2VideoUrl };

      // Share to Facebook Pages
      try {
        const fbUrl = await shareToFacebook(r2VideoUrl, `${title} - ${dateIndoStr}`, ytDesc);
        if (fbUrl) successEntry.fbUrl = fbUrl;
      } catch (fbErr) {
        console.error('[Devotion/Facebook] Failed:', fbErr.message);
        errorList.push(`Devotion Facebook: ${fbErr.message}`);
      }

      // Share to Instagram Reels
      const igCaption = `${title}\n\nAyat: ${devotion.verseRef || ''}\n"${(devotion.verseText || '').substring(0, 100)}"\n\n` +
        `Baca selengkapnya di gracedaily.my.id\n\n#renunganharian #kristen #gracedaily #alkitab #devotional`;
      try {
        const igMediaId = await shareToInstagram(r2VideoUrl, igCaption);
        if (igMediaId) successEntry.igMediaId = igMediaId;
      } catch (igErr) {
        console.error('[Devotion/Instagram] Failed:', igErr.message);
        errorList.push(`Devotion Instagram: ${igErr.message}`);
      }

      successList.push(successEntry);

      // Cleanup temp files
      if (existsSync(tempTtsPath)) unlinkSync(tempTtsPath);
      if (devotionImgDownloaded && existsSync(tempImagePath)) unlinkSync(tempImagePath);
      if (existsSync(tempVideoPath)) unlinkSync(tempVideoPath);

    } else {
      console.log(`[Devotion] No daily_devotions/${dateStr} found — skipping.`);
    }
  } catch (e) {
    console.error('❌ Devotion video failed:', e.message);
    errorList.push(`Renungan Harian: ${e.message}`);
  }

  // ── B. BLOG ARTICLE VIDEOS ──────────────────────────────────────────────
  try {
    const articles = await fetchBlogPosts(dateStr);
    if (articles.length > 0) {
      console.log(`\n[Blog] Found ${articles.length} article(s).`);

      for (const article of articles) {
        console.log(`\n[Blog] Processing: "${article.title}"`);
        try {
          const title       = `Artikel: ${article.title || 'Hari Ini'}`;
          const cleanExcerpt = cleanHtmlToText(article.excerpt);
          const cleanBody    = cleanHtmlToText(article.body);
          const author      = article.authorName || 'Grace Daily';

          const fullText = `Artikel Blog Grace Daily, ${dateIndoStr}. ` +
            `Judul: ${article.title || 'Hari Ini'}. ` +
            `Ditulis oleh: ${author}. ` +
            (cleanExcerpt ? `Ringkasan: ${cleanExcerpt}. ` : '') +
            `Berikut adalah isi artikel selengkapnya. ${cleanBody}`;

          const cleanText   = cleanHtmlToText(fullText);
          const tempTtsPath = path.join(tempDir, `blog-${article.id}.mp3`);

          console.log('[Blog] Synthesizing speech (id-ID-ArdiNeural)...');
          const tts = new UniversalEdgeTTS(cleanText, 'id-ID-ArdiNeural');
          const result = await tts.synthesize();
          writeFileSync(tempTtsPath, Buffer.from(await result.audio.arrayBuffer()));
          console.log('[Blog] Speech synthesis complete.');

          let videoImagePath = localImagePath;
          let blogImgDownloaded = false;
          const tempImagePath = path.join(tempDir, `blog-${article.id}.jpg`);
          if (article.imageUrl) {
            try {
              await downloadFileFromUrl(article.imageUrl, tempImagePath);
              videoImagePath = tempImagePath;
              blogImgDownloaded = true;
              console.log('[Blog] Banner image downloaded.');
            } catch (e) {
              console.warn('⚠️ Blog banner download failed — using fallback logo.');
            }
          }
          if (!videoImagePath) throw new Error('No background image found (logo/banner).');

          const tempVideoPath = path.join(tempDir, `blog-${article.id}.mp4`);
          const mixSuccess = mixAndCreateVideo(videoImagePath, tempTtsPath, bgMusicFile, tempVideoPath);
          if (!mixSuccess) throw new Error('FFmpeg video compilation failed.');

          // Upload to R2 first
          const r2Key = `videos/blog-${dateStr}-${article.id}.mp4`;
          console.log('[Blog] Uploading MP4 to R2...');
          await uploadToR2(tempVideoPath, r2Key, 'video/mp4');
          const r2VideoUrl = `${r2PublicUrl}/${r2Key}`;

          // Upload to YouTube
          const ytDesc = `${title}\n\n${article.excerpt || ''}\n\n` +
            `Baca artikel selengkapnya:\n👉 https://gracedaily.my.id/blog/${article.id}\n\n` +
            `#renunganharian #artikelkristen #alkitab #kristen #gracedaily`;
          const ytUrl = await uploadToYouTube(tempVideoPath, `${title} - ${dateIndoStr}`, ytDesc);

          const successEntry = { type: 'Artikel Blog', title: article.title, ytUrl, r2Url: r2VideoUrl };

          // Share to Facebook Pages
          try {
            const fbUrl = await shareToFacebook(r2VideoUrl, `${title} - ${dateIndoStr}`, ytDesc);
            if (fbUrl) successEntry.fbUrl = fbUrl;
          } catch (fbErr) {
            console.error('[Blog/Facebook] Failed:', fbErr.message);
            errorList.push(`Blog Facebook (${article.title}): ${fbErr.message}`);
          }

          // Share to Instagram Reels
          const igCaption = `${title}\n\n${(cleanExcerpt || '').substring(0, 150)}\n\n` +
            `Baca selengkapnya di gracedaily.my.id\n\n#artikelkristen #kristen #gracedaily #alkitab`;
          try {
            const igMediaId = await shareToInstagram(r2VideoUrl, igCaption);
            if (igMediaId) successEntry.igMediaId = igMediaId;
          } catch (igErr) {
            console.error('[Blog/Instagram] Failed:', igErr.message);
            errorList.push(`Blog Instagram (${article.title}): ${igErr.message}`);
          }

          successList.push(successEntry);

          if (existsSync(tempTtsPath)) unlinkSync(tempTtsPath);
          if (blogImgDownloaded && existsSync(tempImagePath)) unlinkSync(tempImagePath);
          if (existsSync(tempVideoPath)) unlinkSync(tempVideoPath);

        } catch (articleErr) {
          console.error(`❌ Article "${article.title}" failed:`, articleErr.message);
          errorList.push(`Artikel Blog (${article.title}): ${articleErr.message}`);
        }
      }
    } else {
      console.log(`[Blog] No published articles found for ${dateStr}.`);
    }
  } catch (e) {
    console.error('❌ Blog fetch failed:', e.message);
    errorList.push(`Fetch Blog Posts: ${e.message}`);
  }

  // R2 video cleanup
  await cleanupOldVideos();

  // ── TELEGRAM REPORT ──────────────────────────────────────────────────────
  if (successList.length > 0 || errorList.length > 0) {
    let report = `🎬 <b>Laporan Video Harian Grace Daily</b>\n📅 ${dateIndoStr}\n\n`;

    if (successList.length > 0) {
      report += `✅ <b>Berhasil Dipublikasikan:</b>\n`;
      for (const item of successList) {
        report += `\n📌 <b>${item.type}</b>: "${item.title}"\n`;
        report += `  📺 <a href="${item.ytUrl}">YouTube</a>`;
        if (item.fbUrl)    report += ` | 📘 <a href="${item.fbUrl}">Facebook</a>`;
        if (item.igMediaId) report += ` | 📸 Instagram (ID: ${item.igMediaId})`;
        report += `\n  📦 <a href="${item.r2Url}">Download MP4</a>\n`;
      }
    }

    if (errorList.length > 0) {
      report += `\n⚠️ <b>Error (${errorList.length}):</b>\n`;
      errorList.forEach(err => { report += `• ${err}\n`; });
    }

    if (!fbPageId || !fbAccessToken) {
      report += `\n💡 <i>Facebook/Instagram belum dikonfigurasi. Tambahkan FACEBOOK_PAGE_ID, FACEBOOK_PAGE_ACCESS_TOKEN, INSTAGRAM_USER_ID ke GitHub Secrets.</i>`;
    }

    console.log('[Telegram] Sending report...');
    await sendTelegramMessage(report);
  } else {
    console.log('[Main] No devotions or articles found — no report sent.');
  }

  console.log('\n=========================================');
  console.log('✅ YouTube video generator finished.');
  console.log('=========================================\n');
}

main().catch(err => {
  console.error('❌ Fatal Error:', err);
  sendTelegramMessage(
    `❌ <b>Fatal Error — YouTube Video Generator</b>\n<code>${err.message}</code>`
  ).then(() => process.exit(1));
});
