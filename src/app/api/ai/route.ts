import { askDeepSeek, type AiMode } from "@/lib/ai";
import { getAdminAuth, getAdminDb } from "@/lib/server/firebase-admin";

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
    };

    const mode = body.mode ?? "pastor";
    const prompt = body.prompt?.trim();

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
        { error: "Silakan login untuk memakai mode AI premium." },
        { status: 401 },
      );
    }

    if (token) {
      const adminAuth = getAdminAuth();
      const adminDb = getAdminDb();

      if (!adminAuth || !adminDb) {
        return Response.json(
          { error: "Akses paket tidak bisa diverifikasi saat ini." },
          { status: 503 },
        );
      }

      const decoded = await adminAuth.verifyIdToken(token);
      userId = decoded.uid;

      const userRef = adminDb.collection("users").doc(decoded.uid);
      const [userDoc, adminDoc] = await Promise.all([
        userRef.get(),
        adminDb.collection("admin_users").doc(decoded.uid).get(),
      ]);
      const userData = userDoc.data() ?? {};
      const isAdmin = adminDoc.exists || userData.role === "admin";

      if (!isAdmin) {
        const selectedPlanName = userData.selectedPlan || "Free";
        const planSnap = await adminDb.collection("plans")
          .where("name", "==", selectedPlanName)
          .limit(1)
          .get();
        const planData = planSnap.docs[0]?.data();
        const allowedModes = Array.isArray(planData?.allowedModes) ? planData.allowedModes : ["devotional"];

        if (!allowedModes.includes(mode)) {
          return Response.json(
            { error: "Mode AI ini tidak tersedia untuk paket kamu." },
            { status: 403 },
          );
        }

        const expiresAt = toDate(userData.premiumExpiresAt);
        if (expiresAt && expiresAt.getTime() < Date.now()) {
          return Response.json(
            { error: "Paket kamu sudah kedaluwarsa. Silakan perpanjang paket." },
            { status: 403 },
          );
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
    }

    const result = await askDeepSeek(mode, prompt);

    if (userId && nextRemaining !== null) {
      const adminDb = getAdminDb();
      await adminDb?.collection("users").doc(userId).set({
        aiRequestsRemaining: nextRemaining,
        updatedAt: new Date(),
      }, { merge: true });
    }

    return Response.json({ ...result, aiRequestsRemaining: nextRemaining });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "AI gateway gagal diproses.";
    return Response.json({ error: message }, { status: 500 });
  }
}
