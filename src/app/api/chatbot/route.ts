import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limiter";
import { askChatbotAI, type ChatMessage } from "@/lib/chatbot-ai";
import { getAdminAuth } from "@/lib/server/firebase-admin";
import { getCachedResponse, setCachedResponse } from "@/lib/server/chatbot-r2-cache";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      messages?: ChatMessage[];
    };

    const messages = body.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Pesan tidak boleh kosong." }, { status: 400 });
    }

    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || !lastMessage.content || typeof lastMessage.content !== "string" || !lastMessage.content.trim()) {
      return NextResponse.json({ error: "Isi pesan tidak valid." }, { status: 400 });
    }

    const userPrompt = lastMessage.content.trim();

    let userKey = "";
    let isLoggedIn = false;
    let maxLimit = 5; // Guest limit = 5 msgs/hour

    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace(/^Bearer\s+/i, "");

    if (token) {
      try {
        const adminAuth = getAdminAuth();
        if (adminAuth) {
          const decoded = await adminAuth.verifyIdToken(token);
          if (decoded && decoded.uid) {
            userKey = `user_${decoded.uid}`;
            isLoggedIn = true;
            maxLimit = 20; // Logged-in user limit = 20 msgs/hour
          }
        }
      } catch (authErr) {
        console.warn("[Chatbot API] Token verification failed, treating as guest:", authErr);
      }
    }

    if (!userKey) {
      const forwardedFor = request.headers.get("x-forwarded-for");
      const realIp = request.headers.get("x-real-ip");
      const clientIp = forwardedFor ? forwardedFor.split(",")[0].trim() : realIp || "unknown_ip";
      userKey = `guest_${clientIp}`;
    }

    const limitResult = checkRateLimit(userKey, maxLimit);

    if (!limitResult.allowed) {
      const userTypeLabel = isLoggedIn ? "Pengguna Login (20 pesan/jam)" : "Tamu (5 pesan/jam)";
      return NextResponse.json(
        {
          error: `Batas kuota obrolan tercapai untuk ${userTypeLabel}. Silakan coba lagi dalam ${limitResult.resetInMinutes} menit atau login ke akun Anda.`,
          allowed: false,
          remaining: 0,
          resetInMinutes: limitResult.resetInMinutes,
          maxLimit,
          isGuest: !isLoggedIn,
        },
        { status: 429 }
      );
    }

    // 1. Check R2 Cache first (saves AI quota if question is identical & not dynamic & not expired)
    const cachedResponse = await getCachedResponse(userPrompt);
    if (cachedResponse) {
      return NextResponse.json({
        answer: cachedResponse.answer,
        provider: `r2-cache (${cachedResponse.provider})`,
        isCached: true,
        remaining: limitResult.remaining,
        maxLimit,
        isGuest: !isLoggedIn,
      });
    }

    // 2. Cache miss / dynamic content / expired -> Call LLM provider
    const aiResult = await askChatbotAI(messages);

    // 3. Asynchronously save response to Cloudflare R2 cache (fire & forget)
    setCachedResponse(userPrompt, aiResult.answer, aiResult.provider).catch((err) => {
      console.warn("[Chatbot API] Background cache save failed:", err?.message || err);
    });

    return NextResponse.json({
      answer: aiResult.answer,
      provider: aiResult.provider,
      isCached: false,
      remaining: limitResult.remaining,
      maxLimit,
      isGuest: !isLoggedIn,
    });
  } catch (error: any) {
    console.error("[Chatbot API Error]:", error);
    return NextResponse.json(
      { error: error.message || "Gagal memproses pesan chatbot." },
      { status: 500 }
    );
  }
}

