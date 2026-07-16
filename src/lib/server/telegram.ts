import { getAdminDb } from "./firebase-admin";
import { CONFIG } from "./config";
import logger from "./logger";

/**
 * Telegram Notification Service for Grace Daily
 * Handles cron job notifications, channel reports, alerts, and chatbot webhook
 */

// ============================================================================
// INTERFACES
// ============================================================================

export interface TelegramCronReportData {
  date: string;
  cronType: string;
  target: number;
  success: number;
  duplicate: number;
  failed: number;
  entries: string[];
  totalCount?: number;
  totalDevotions?: number;
  totalArticles?: number;
}

export interface TelegramMessageResult {
  success: boolean;
  messageId?: number;
  error?: string;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const BOT_TOKEN = CONFIG.BOT_TOKEN;
const CHAT_ID = CONFIG.CHAT_ID; // Admin personal chat
const CHANNEL_ID = CONFIG.CHANNEL_ID; // Public channel
const GROUP_ID = CONFIG.GROUP_ID; // Grace Daily Community group
const APP_URL = CONFIG.APP_URL;
const API_BASE = "https://api.telegram.org/bot";
const R2_PUBLIC_URL = CONFIG.R2_PUBLIC_URL;

// ============================================================================
// FORMATTING FUNCTIONS
// ============================================================================

/**
 * Escape HTML special characters for Telegram HTML parse mode
 */
export function escapeHtml(unsafe: string | null | undefined): string {
  if (!unsafe) return "";
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Format cron report message for Telegram
 */
function formatCronReport(data: TelegramCronReportData): string {
  const { date, cronType, target, success, duplicate, failed, entries, totalCount, totalDevotions, totalArticles } = data;
  const status = failed > 0 ? "🔴 PERLU PERHATIAN" : "✅ BERHASIL";
  const entriesDisplay = entries.length > 0
    ? entries.slice(0, 20).join("\n")
    : "-";

  const message = `
📊 <b>Laporan Cron Grace Daily</b>

📅 <b>Tanggal:</b> ${escapeHtml(date)}
🔧 <b>Jenis Cron:</b> ${escapeHtml(cronType)}

━━━━━━━━━━━━━━━━━━━━
<b>📈 Ringkasan Statistik:</b>
━━━━━━━━━━━━━━━━━━━━
• Total Target: <b>${target}</b>
• Berhasil: <b>${success}</b> ✅
• Duplikat: <b>${duplicate}</b> ⚠️
• Gagal: <b>${failed}</b> ❌
${totalCount !== undefined && totalCount > 0 ? `• Total Ensiklopedia: <b>${totalCount.toLocaleString()}</b> 📚\n` : ""}${totalDevotions !== undefined && totalDevotions > 0 ? `• Total Renungan: <b>${totalDevotions.toLocaleString()}</b> 🌅\n` : ""}${totalArticles !== undefined && totalArticles > 0 ? `• Total Artikel: <b>${totalArticles.toLocaleString()}</b> ✍️\n` : ""}${entries.length > 0 ? `
━━━━━━━━━━━━━━━━━━━━
<b>📝 Daftar Entri Baru:</b>
━━━━━━━━━━━━━━━━━━━━
${entriesDisplay}
` : ""}
━━━━━━━━━━━━━━━━━━━━
<b>🎯 Status Akhir:</b> ${status}
━━━━━━━━━━━━━━━━━━━━

<i>Laporan otomatis Grace Daily Cron System</i>
`;

  return message;
}

// ============================================================================
// SEND FUNCTIONS
// ============================================================================

/**
 * Send message to Telegram
 */
async function sendToTelegram(
  chatId: string,
  text: string,
  parseMode: "HTML" | "Markdown" | "" = "HTML",
  disableNotification: boolean = false
): Promise<TelegramMessageResult> {
  if (!BOT_TOKEN || !chatId) {
    logger.warn("[Telegram] BOT_TOKEN or CHAT_ID not configured. Message not sent.");
    return { success: false, error: "Missing configuration" };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(`${API_BASE}${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode,
        disable_notification: disableNotification,
        disable_web_page_preview: true,
      }),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.description || `HTTP ${response.status}`
      );
    }

    const result = await response.json();
    
    if (result.ok && result.result) {
      const msgId = result.result.message_id;
      saveSentMessage(chatId, msgId).catch(() => {});
      return {
        success: true,
        messageId: msgId,
      };
    }

    return { success: false, error: "Unexpected response format" };
  } catch (error: any) {
    console.error("[Telegram] Failed to send message:", error.message);
    return {
      success: false,
      error: error.message || "Unknown error",
    };
  }
}
/* ---------------------------------------------------------------------------
 * Helper to send messages to both channel and group with logging and split handling
 * --------------------------------------------------------------------------- */
async function sendToChannelAndGroup(message: string): Promise<TelegramMessageResult> {
  // Send to channel
  let channelResult: TelegramMessageResult = { success: false };
  try {
    console.log('[Telegram] Sending message to channel');
    channelResult = message.length > 4096
      ? (await sendLongTelegramMessage(CHANNEL_ID, message, 'HTML'))[0]
      : await sendToTelegram(CHANNEL_ID, message, 'HTML');
    console.log('[Telegram] Channel send result:', channelResult);
  } catch (e) {
    console.error('[Telegram] Error sending to channel:', e);
  }

  // Send to group if configured
  if (GROUP_ID) {
    try {
      console.log('[Telegram] Sending message to group');
      const groupResult = message.length > 4096
        ? await sendLongTelegramMessage(GROUP_ID, message, 'HTML')
        : await sendToTelegram(GROUP_ID, message, 'HTML');
      console.log('[Telegram] Group send result:', groupResult);
    } catch (e) {
      // Duplicate block removed - old send logic replaced by unified helper
    }
  }
  return channelResult;
}

// ============================================================================
// R2 COUNT HELPERS
// ============================================================================

/**
 * Read count of devotions from R2 renungan.json
 */
async function getR2DevotionsCountFromIndex(): Promise<number> {
  if (!R2_PUBLIC_URL) return 0;
  try {
    const url = `${R2_PUBLIC_URL}/renungan.json`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return 0;
    const data = await res.json();
    if (Array.isArray(data)) return data.length;
    return 0;
  } catch {
    return 0;
  }
}

/**
 * Read count of articles from R2 articles/index.json
 */
async function getR2ArticlesCountFromIndex(): Promise<number> {
  if (!R2_PUBLIC_URL) return 0;
  try {
    const url = `${R2_PUBLIC_URL}/articles/index.json`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return 0;
    const data = await res.json();
    if (Array.isArray(data)) return data.length;
    return 0;
  } catch {
    return 0;
  }
}

/**
 * Get the count of devotions, querying Firestore first, falling back to R2
 */
async function getDevotionsCount(): Promise<number> {
  try {
    const db = getAdminDb();
    if (db) {
      const snap = await db.collection("daily_devotions").count().get();
      return snap.data().count;
    }
  } catch (err) {
    console.error("[Telegram] Failed to count devotions from Firestore:", err);
  }
  return getR2DevotionsCountFromIndex();
}

/**
 * Get the count of articles, querying Firestore first, falling back to R2
 */
async function getArticlesCount(): Promise<number> {
  try {
    const db = getAdminDb();
    if (db) {
      const snap = await db.collection("blog_posts").count().get();
      return snap.data().count;
    }
  } catch (err) {
    console.error("[Telegram] Failed to count articles from Firestore:", err);
  }
  return getR2ArticlesCountFromIndex();
}

/**
 * Read count of encyclopedia entries per category and total from R2
 */
async function getR2EncyclopediaCounts(): Promise<{ perCategory: Record<string, number>; total: number }> {
  const ALL_CATEGORIES = [
    "tokoh", "tempat", "kamus", "mukjizat", "perumpamaan",
    "kitab", "kronologi", "silsilah", "teologi", "teologi-2",
    "topikal_alkitab", "peristiwa", "peristiwa-2",
  ];

  if (!R2_PUBLIC_URL) return { perCategory: {}, total: 0 };

  const perCategory: Record<string, number> = {};
  let total = 0;

  await Promise.allSettled(
    ALL_CATEGORIES.map(async (cat) => {
      try {
        const url = `${R2_PUBLIC_URL}/backup/${cat}.json`;
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) { perCategory[cat] = 0; return; }
        const data = await res.json();
} catch {
        perCategory[cat] = 0;
      }
    })
  );

  return { perCategory, total };
}

// ============================================================================
// CHANNEL REPORT FUNCTIONS
// ============================================================================

/**
 * Report new devotion to Telegram channel
 */
export async function reportNewDevotionTelegram(devotion: {
  id: string;
  title?: string;
  verseRef?: string;
  verseText?: string;
}): Promise<TelegramMessageResult> {
  console.log('[Telegram] New devotion created:', devotion.title || devotion.id);
  const devCount = await getDevotionsCount();
  const artCount = await getArticlesCount();
  const devotionUrl = `${APP_URL}/renungan/${devotion.id}`;
  const verse = devotion.verseRef ? `\n📖 <b>Ayat:</b> ${escapeHtml(devotion.verseRef)}` : "";
  const verseText = devotion.verseText ? `\n<i>"${escapeHtml(String(devotion.verseText).substring(0, 120))}..."</i>` : "";

  const message = `🌅 <b>Renungan Harian Baru!</b>

📜 <b>${escapeHtml(devotion.title || "Renungan Baru")}</b>${verse}${verseText}

🔗 <a href="${devotionUrl}">Baca Renungan</a>

━━━━━━━━━━━━━━━━━━━━
📊 <b>Statistik Grace Daily:</b>
━━━━━━━━━━━━━━━━━━━━
• Total Renungan: <b>${devCount > 0 ? devCount.toLocaleString() : "~"}</b> 🌅
• Total Artikel: <b>${artCount > 0 ? artCount.toLocaleString() : "~"}</b> ✍️

<i>Grace Daily — Blog Rohani Kristen</i>`;
  
  return sendToChannelAndGroup(message);
}

/**
 * Report new article to Telegram channel
 */
export async function reportNewArticleTelegram(article: {
  slug: string;
  title?: string;
  excerpt?: string;
  category?: string;
}): Promise<TelegramMessageResult> {
  const devCount = await getDevotionsCount();
  const artCount = await getArticlesCount();
  const articleUrl = `${APP_URL}/blog/${article.slug}`;
  const excerptText = article.excerpt ? `\n<i>${escapeHtml(String(article.excerpt).substring(0, 150))}...</i>` : "";
  const categoryText = article.category ? ` • ${escapeHtml(article.category)}` : "";

  const message = `✍️ <b>Artikel Blog Baru!</b>

📰 <b>${escapeHtml(article.title || "Artikel Baru")}</b>${excerptText}

🏷️ Blog${categoryText}
🔗 <a href="${articleUrl}">Baca Artikel</a>

━━━━━━━━━━━━━━━━━━━━
📊 <b>Statistik Grace Daily:</b>
━━━━━━━━━━━━━━━━━━━━
• Total Renungan: <b>${devCount > 0 ? devCount.toLocaleString() : "~"}</b> 🌅
• Total Artikel: <b>${artCount > 0 ? artCount.toLocaleString() : "~"}</b> ✍️

<i>Grace Daily — Blog Rohani Kristen</i>`;

  return sendToChannelAndGroup(message);
}

/**
 * Report new encyclopedia entry to Telegram channel
 */
export async function reportNewEncyclopediaTelegram(entry: {
  id: string;
  keyword: string;
  kategori: string;
  slug: string;
  title?: string;
}): Promise<TelegramMessageResult> {
  const { perCategory, total } = await getR2EncyclopediaCounts();
  const entryUrl = `${APP_URL}/ensiklopedia/${entry.kategori}/${entry.slug}`;

  const categoryLabel = escapeHtml(entry.kategori.replace(/-/g, " ").replace(/_/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase()));

  const topCategories = Object.entries(perCategory)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([k, v]) => `• ${escapeHtml(k.replace(/_/g, " "))}: <b>${v}</b>`)
    .join("\n");

  const message = `📚 <b>Ensiklopedia Alkitab Baru!</b>\n\n🔖 <b>${escapeHtml(entry.title || entry.keyword)}</b>\n🏷️ Kategori: <b>${categoryLabel}</b>\n🔗 <a href="${entryUrl}">Baca Selengkapnya</a>\n\n━━━━━━━━━━━━━━━━━━━\n📊 <b>Statistik Ensiklopedia</b>\n━━━━━━━━━━━━━━━━━━━\n${topCategories}\n\n📖 Total Keseluruhan: <b>${total}</b> entri\n\n<i>Grace Daily — Ensiklopedia Alkitab Lengkap</i>`;

  // Send to channel and group using unified helper
  const result = await sendToChannelAndGroup(message);
  if (CHAT_ID && CHAT_ID !== CHANNEL_ID && CHAT_ID !== GROUP_ID) {
    await sendToTelegram(CHAT_ID, message, "HTML", true);
  }
  return result;
}

// ============================================================================
// EXPORTED FUNCTIONS
// ============================================================================

/**
 * Send cron job report to Telegram (admin chat)
 */
export async function sendTelegramCronReport(
  data: TelegramCronReportData
): Promise<TelegramMessageResult> {
  const totalDevotions = data.totalDevotions ?? await getDevotionsCount();
  const totalArticles = data.totalArticles ?? await getArticlesCount();
  const message = formatCronReport({
    ...data,
    totalDevotions,
    totalArticles,
  });
  return sendToTelegram(CHAT_ID, message, "HTML");
}

/**
 * Send simple notification to Telegram (admin chat)
 */
export async function sendTelegramNotification(
  text: string,
  parseMode: "HTML" | "Markdown" | "" = "HTML"
): Promise<TelegramMessageResult> {
  return sendToTelegram(CHAT_ID, text, parseMode);
}

/**
 * Send alert to Telegram (admin chat, high priority)
 */
export async function sendTelegramAlert(
  title: string,
  message: string
): Promise<TelegramMessageResult> {
  const formattedMessage = `🚨 <b>${title}</b>\n\n${message}`;
  return sendToTelegram(CHAT_ID, formattedMessage, "HTML", false);
}

/**
 * Send success notification to Telegram (admin chat)
 */
export async function sendTelegramSuccess(
  title: string,
  message: string
): Promise<TelegramMessageResult> {
  const formattedMessage = `✅ <b>${title}</b>\n\n${message}`;
  return sendToTelegram(CHAT_ID, formattedMessage, "HTML");
}

/**
 * Send message to Telegram channel (public channel)
 */
export async function sendToChannel(
  text: string,
  parseMode: "HTML" | "Markdown" | "" = "HTML"
): Promise<TelegramMessageResult> {
  return sendToTelegram(CHANNEL_ID, text, parseMode);
}

/**
 * Reply to a specific Telegram update (for webhook)
 */
export async function replyToTelegram(
  chatId: string | number,
  text: string,
  parseMode: "HTML" | "Markdown" | "" = "HTML"
): Promise<TelegramMessageResult> {
  return sendToTelegram(String(chatId), text, parseMode);
}

// ============================================================================
// BATCH SEND FUNCTIONS
// ============================================================================

/**
 * Send long message by splitting into multiple messages
 */
export async function sendLongTelegramMessage(
  chatId: string,
  text: string,
  parseMode: "HTML" | "Markdown" | "" = "HTML"
): Promise<TelegramMessageResult[]> {
  const MAX_LENGTH = 4096; // Telegram limit
  const chunks: string[] = [];
  const paragraphs = text.split("\n\n");
  let currentChunk = "";

  for (const paragraph of paragraphs) {
    if (currentChunk.length + paragraph.length + 2 > MAX_LENGTH) {
      chunks.push(currentChunk);
      currentChunk = paragraph;
    } else {
      currentChunk += (currentChunk ? "\n\n" : "") + paragraph;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  const results: TelegramMessageResult[] = [];
  for (const chunk of chunks) {
    const result = await sendToTelegram(chatId, chunk, parseMode);
    results.push(result);
  }

  return results;
}

/**
 * Send devotion or article auto-share report to Telegram (admin chat)
 */
export async function reportSocialShareStatusTelegram({
  title,
  description,
  imageUrl,
  type,
  results,
  success
}: {
  title: string;
  description: string;
  imageUrl?: string;
  type: "devotion" | "article";
  results: {
    facebook?: { success: boolean; error?: string };
    instagram?: { success: boolean; error?: string };
    bluesky?: { success: boolean; error?: string };
    mastodon?: { success: boolean; error?: string };
    discord?: { success: boolean; error?: string };
  };
  success: boolean;
}): Promise<TelegramMessageResult> {
  const statusEmoji = success ? "✅" : "⚠️";
  const statusText = success ? "BERHASIL DISHARE" : "ADA KEGAGALAN SHARE";
  
  const typeLabel = type === "devotion" ? "🌅 Renungan Harian" : "✍️ Artikel Blog";

  let resultsText = "";
  if (results.facebook) {
    resultsText += `\n• Facebook Page: ${
      results.facebook.success 
        ? "✅ Berhasil" 
        : (results.facebook.error === "Dinonaktifkan" || results.facebook.error === "Disabled" 
          ? "🚫 Dinonaktifkan" 
          : `❌ Gagal (${results.facebook.error || "Unknown"})`)
    }`;
  }
  if (results.instagram) {
    resultsText += `\n• Instagram: ${results.instagram.success ? "✅ Berhasil" : `❌ Gagal (${results.instagram.error || "Unknown"})`}`;
  }
  if (results.bluesky) {
    resultsText += `\n• Bluesky: ${results.bluesky.success ? "✅ Berhasil" : `❌ Gagal (${results.bluesky.error || "Unknown"})`}`;
  }
  if (results.mastodon) {
    resultsText += `\n• Mastodon: ${results.mastodon.success ? "✅ Berhasil" : `❌ Gagal (${results.mastodon.error || "Unknown"})`}`;
  }
  if (results.discord) {
    resultsText += `\n• Discord: ${results.discord.success ? "✅ Berhasil" : `❌ Gagal (${results.discord.error || "Unknown"})`}`;
  }

  const message = `${statusEmoji} <b>Laporan Auto-Share Grace Daily</b>
  
📢 <b>Status:</b> ${statusText}
🗂 <b>Tipe:</b> ${typeLabel}
📝 <b>Judul:</b> ${escapeHtml(title)}
📄 <b>Deskripsi:</b> ${escapeHtml(description)}

━━━━━━━━━━━━━━━━━━━━
<b>🌐 Hasil Share Platform:</b>
━━━━━━━━━━━━━━━━━━━━${resultsText}
━━━━━━━━━━━━━━━━━━━━
<i>Diproses otomatis oleh Grace Daily Scheduler</i>`;

  // 1. Send banner image if available
  if (imageUrl && BOT_TOKEN && CHAT_ID) {
    try {
      const absoluteImageUrl = imageUrl.startsWith("/") ? `${APP_URL}${imageUrl}` : imageUrl;
      const photoResponse = await fetch(`${API_BASE}${BOT_TOKEN}/sendPhoto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: CHAT_ID,
          photo: absoluteImageUrl,
          caption: `${statusEmoji} Banner untuk: <b>${escapeHtml(title)}</b>`,
          parse_mode: "HTML",
        }),
      });
      if (photoResponse.ok) {
        const photoResult = await photoResponse.json().catch(() => ({}));
        if (photoResult.ok && photoResult.result) {
          saveSentMessage(CHAT_ID, photoResult.result.message_id).catch(() => {});
        }
      }
    } catch (photoErr) {
      console.error("[Telegram] Failed to send report photo:", photoErr);
    }
  }

  // 2. Send the detailed text report
  return sendToTelegram(CHAT_ID, message, "HTML");
}

// ============================================================================
// CONFIGURATION CHECK
// ============================================================================

export function isTelegramConfigured(): boolean {
  return !!(BOT_TOKEN && CHAT_ID);
}

export function getTelegramConfig(): {
  hasToken: boolean;
  hasChatId: boolean;
  hasChannelId: boolean;
  chatId: string;
  channelId: string;
} {
  return {
    hasToken: !!BOT_TOKEN,
    hasChatId: !!CHAT_ID,
    hasChannelId: !!CHANNEL_ID,
    chatId: CHAT_ID,
    channelId: CHANNEL_ID,
  };
}

/**
 * Save sent Telegram message ID to Firestore for cleanup tracking
 */
export async function saveSentMessage(chatId: string, messageId: number) {
  try {
    const db = getAdminDb();
    if (db) {
      await db.collection("telegram_sent_messages").add({
        chatId,
        messageId,
        sentAt: new Date(),
      });
    }
  } catch (err) {
    console.error("[Telegram] Failed to save sent message ID in Firestore:", err);
  }
}

/**
 * Delete a message from Telegram
 */
export async function deleteTelegramMessage(
  chatId: string,
  messageId: number
): Promise<boolean> {
  if (!BOT_TOKEN || !chatId) return false;

  try {
    const response = await fetch(`${API_BASE}${BOT_TOKEN}/deleteMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.warn(`[Telegram] Failed to delete message ${messageId}:`, err.description || response.statusText);
      return false;
    }

    return true;
  } catch (error: any) {
    console.error("[Telegram] Error deleting message:", error.message);
    return false;
  }
}

/**
 * Clean up sent Telegram messages that are older than 48 hours
 */
export async function cleanupTelegramMessages(): Promise<{ success: boolean; deletedCount: number }> {
  const db = getAdminDb();
  if (!db) return { success: false, deletedCount: 0 };

  try {
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const snapshot = await db
      .collection("telegram_sent_messages")
      .where("sentAt", "<", fortyEightHoursAgo)
      .limit(100) // process in small batches
      .get();

    let deletedCount = 0;

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const chatId = data.chatId;
      const messageId = data.messageId;

      if (chatId && messageId) {
        // Attempt Telegram API deletion
        await deleteTelegramMessage(chatId, messageId);
        // Delete Firestore tracker document
        await doc.ref.delete();
        deletedCount++;
      }
    }

    return { success: true, deletedCount };
  } catch (error: any) {
    console.error("[Telegram Cleanup] Error running cleanup:", error.message);
    return { success: false, deletedCount: 0 };
  }
}

