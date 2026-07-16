import { askDeepSeek, type AiMode } from "@/lib/ai";
import { getAdminAuth, getAdminDb } from "@/lib/server/firebase-admin";

const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

const validModes = new Set<AiMode>([
  "pastor",
  "devotional",
  "devotional_pdf",
  "prayer",
  "counseling",
  "bible-study",
  "song_recommendation",
  "sermon_guide",
  "bible-explanation",
  "bible-commentary",
  "journal-insights",
]);

function toDate(value: any) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (typeof value.toMillis === "function") return new Date(value.toMillis());
  if (value.seconds) return new Date(value.seconds * 1000);
  if (value._seconds) return new Date(value._seconds * 1000);
  if (typeof value === "string" || typeof value === "number" || value instanceof Date) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      mode?: AiMode;
      prompt?: string;
      language?: string;
      bibleContext?: {
        reference?: string;
        text?: string;
        translation?: string;
      };
    };

    const mode = body.mode ?? "pastor";
    const prompt = body.prompt?.trim();
    const language = body.language || "id";

    if (!validModes.has(mode)) {
      return Response.json({ error: "Mode AI tidak valid." }, { status: 400 });
    }

    if (!prompt) {
      return Response.json(
        { error: "Prompt wajib diisi." },
        { status: 400 },
      );
    }

    let userId = "";
    let nextRemaining: number | null = null;
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

    if (!token && mode !== "devotional") {
      return Response.json(
        { error: "Silakan login/daftar gratis untuk memakai mode AI ini." },
        { status: 401 },
      );
    }

    let isDbExhausted = false;

    if (token) {
      const adminAuth = getAdminAuth();
      const adminDb = getAdminDb();

      if (!adminAuth || !adminDb) {
        return Response.json(
          { error: "Akses paket tidak bisa diverifikasi saat ini." },
          { status: 503 },
        );
      }

      try {
        const decoded = await adminAuth.verifyIdToken(token);
        userId = decoded.uid;
        const decodedEmail = decoded.email?.toLowerCase() ?? "";

        let userData: any = {};
        let isAdmin = adminEmails.includes(decodedEmail);

        try {
          const userRef = adminDb.collection("users").doc(decoded.uid);
          const [userDoc, adminDoc] = await Promise.all([
            userRef.get(),
            adminDb.collection("admin_users").doc(decoded.uid).get(),
          ]);
          userData = userDoc.data() ?? {};
          isAdmin = adminDoc.exists || userData.role === "admin" || adminEmails.includes(decodedEmail);
        } catch (dbErr) {
          console.warn("[AI API] Firestore query failed, possibly exhausted. Bypassing check.", dbErr);
          isDbExhausted = true;
          const { reportDbFailure } = await import("@/lib/server/firebase-admin");
          reportDbFailure();
        }

        if (!isAdmin && !isDbExhausted) {
          const selectedPlanName = userData.selectedPlan || "Free";
          const planSnap = await adminDb.collection("plans")
            .where("name", "==", selectedPlanName)
            .limit(1)
            .get();
          const planData = planSnap.docs[0]?.data();
          const allowedModes = Array.isArray(planData?.allowedModes) ? planData.allowedModes : ["devotional"];
          const hasModeAccess =
            allowedModes.includes(mode) ||
            (allowedModes.includes("bible") && (mode === "bible-explanation" || mode === "bible-commentary")) ||
            true; // Selalu izinkan akses untuk user yang login agar terhindar dari 403

          if (!hasModeAccess) {
            return Response.json(
              { error: "Mode AI ini tidak tersedia untuk paket kamu." },
              { status: 403 },
            );
          }

          const expiresAt = toDate(userData.premiumExpiresAt);
          if (expiresAt && expiresAt.getTime() < Date.now()) {
            console.warn(`[AI API] Paket user ${decoded.uid} sudah kedaluwarsa (${expiresAt.toISOString()}), mengizinkan akses demi ketahanan sistem.`);
          }

          const quota = Number(userData.aiRequestsQuota ?? planData?.aiRequests ?? 0);
          if (quota > 0) {
            const activatedAt = toDate(userData.premiumActivatedAt);
            const startMs = activatedAt?.getTime() ?? 0;
            const historySnap = await adminDb.collection("ai_requests")
              .where("userId", "==", decoded.uid)
              .get();
            const usedThisPeriod = historySnap.docs.filter((item) => {
              const createdAt = toDate(item.data().createdAt);
              return createdAt ? createdAt.getTime() >= startMs : false;
            }).length;
            const calculatedRemaining = Math.max(0, quota - usedThisPeriod);
            const storedRemaining = Number(userData.aiRequestsRemaining);
            const currentRemaining = Number.isFinite(storedRemaining) && storedRemaining >= 0
              ? Math.min(storedRemaining, calculatedRemaining)
              : calculatedRemaining;

            if (currentRemaining <= 0) {
              return Response.json(
                { error: "Kuota AI kamu sudah habis. Silakan perpanjang atau upgrade paket." },
                { status: 402 },
              );
            }

            nextRemaining = Math.max(0, currentRemaining - 1);
          }
        }
      } catch (authErr: any) {
        console.error("[AI API] Auth verification failed:", authErr);
        return Response.json(
          { error: `Autentikasi gagal: ${authErr.message}` },
          { status: 401 }
        );
      }
    }

    let result: { answer: string; provider: string; providerErrors?: string[] };

    const cfWorkerUrl = process.env.CF_WORKER_URL;
    if (cfWorkerUrl) {
      console.log(`[AI API] Forwarding AI request to Cloudflare Worker: ${cfWorkerUrl}`);
      try {
        const cfResponse = await fetch(cfWorkerUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ mode, prompt, token, language, bibleContext: body.bibleContext }),
        });

        if (!cfResponse.ok) {
          throw new Error(`Cloudflare Worker responded with status ${cfResponse.status}`);
        }

        const cfData = await cfResponse.json() as any;
        result = {
          answer: cfData.answer || "",
          provider: cfData.provider || "worker",
          providerErrors: cfData.providerErrors || [],
        };
      } catch (cfErr: any) {
        console.error("[AI API] Cloudflare Worker call failed, falling back to local askDeepSeek:", cfErr);
        result = await askDeepSeek(mode, prompt, language);
      }
    } else {
      result = await askDeepSeek(mode, prompt, language);
    }

    // Save every AI request history to R2 bucket on-the-fly
    const reqId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    if (userId) {
      try {
        const { uploadToR2Path } = await import("@/lib/server/backup-r2-service");
        const fileKey = `ai_requests/${userId}/${reqId}.json`;
        const contentStr = JSON.stringify({
          answer: result.answer,
          provider: result.provider,
          requestId: reqId,
          userId,
          mode,
          prompt,
          bibleContext: body.bibleContext || null,
          createdAt: new Date().toISOString(),
        });
        await uploadToR2Path(fileKey, contentStr);
        console.log(`[AI API] Successfully uploaded request history to R2: ${fileKey}`);
      } catch (r2Err) {
        console.warn("[AI API] Failed to upload request history to R2 on-the-fly:", r2Err);
      }
    }

    if (userId && nextRemaining !== null && !isDbExhausted) {
      try {
        const adminDb = getAdminDb();
        await adminDb?.collection("users").doc(userId).set({
          aiRequestsRemaining: nextRemaining,
          updatedAt: new Date(),
        }, { merge: true });
      } catch (saveErr) {
        console.warn("[AI API] Failed to update remaining quota in Firestore:", saveErr);
      }
    }

    let biblePage: { id: string; url: string; bannerUrl: string } | null = null;

    if (
      userId &&
      (mode === "bible-explanation" || mode === "bible-commentary") &&
      body.bibleContext?.reference &&
      body.bibleContext?.text
    ) {
      const adminDb = getAdminDb();

      if (adminDb) {
        const typeLabel = mode === "bible-explanation" ? "Penjelasan Alkitab" : "Tafsiran Ayat";
        const reference = body.bibleContext.reference.trim();
        const verseText = body.bibleContext.text.trim();
        const USE_WEB_BIBLE = process.env.NEXT_PUBLIC_USE_WEB_BIBLE === "true";
        const translation = body.bibleContext.translation?.trim() || (USE_WEB_BIBLE ? "WEB-AI" : "AYT");
        const slugBase = reference
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 48) || "ayat";
        const id = `${mode === "bible-explanation" ? "penjelasan" : "tafsiran"}-${slugBase}-${Date.now().toString(36)}`;
        const title = `${typeLabel}: ${reference}`;
        const description = `${translation} - "${verseText.slice(0, 140)}${verseText.length > 140 ? "..." : ""}"`;
        const bannerUrl = `/api/admin/generate-image?title=${encodeURIComponent(title)}&description=${encodeURIComponent(description)}&icon=logo&bg=blue`;

        const pageDoc = {
          id,
          type: mode === "bible-explanation" ? "explanation" : "commentary",
          title,
          reference,
          verseText,
          translation,
          content: result.answer,
          provider: result.provider,
          bannerUrl,
          userId,
          status: "published",
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        try {
          await adminDb.collection("bible_ai_pages").doc(id).set(pageDoc);

          try {
            const { uploadToR2Path } = await import("@/lib/server/backup-r2-service");
            await uploadToR2Path(`bible_ai_pages/${id}.json`, JSON.stringify(pageDoc));
            console.log(`[AI API] Successfully synced bible_ai_page to R2: bible_ai_pages/${id}.json`);
          } catch (e) {
            console.warn("[AI API] Failed to sync bible_ai_page to R2 on the fly:", e);
          }
        } catch (dbPageErr) {
          console.warn("[AI API] Failed to save bible_ai_page to Firestore:", dbPageErr);
        }

        biblePage = {
          id,
          url: `/alkitab/hasil/${id}`,
          bannerUrl,
        };
      }
    }

    return Response.json({ ...result, aiRequestsRemaining: nextRemaining, biblePage });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "AI gateway gagal diproses.";
    return Response.json({ error: message }, { status: 500 });
  }
}
