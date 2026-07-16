import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/server/firebase-admin";
import { getDocWithFallback, getCollectionWithFallback } from "@/lib/server/db-fallback";
import {
  cleanEncyclopediaArticle,
  encyclopediaSlug,
  isLegacyEncyclopediaIllustrationUrl,
  isValidEncyclopediaIllustrationUrl,
} from "@/lib/encyclopedia";
import { ensureEncyclopediaBannerR2, ensureEncyclopediaIllustrationR2 } from "@/lib/server/encyclopedia-images";
import { askDeepSeek } from "@/lib/ai";
import { buildSeoFields } from "@/lib/seo";

export const runtime = "nodejs";

type UserData = {
  selectedPlan?: string;
  premiumExpiresAt?: unknown;
  premiumActivatedAt?: unknown;
  aiRequestsQuota?: number;
  aiRequestsRemaining?: number;
  encyclopediaRequestsQuota?: number;
  encyclopediaRequestsRemaining?: number;
  role?: string;
};

type PlanData = {
  name?: string;
  aiRequests?: number;
  allowedModes?: string[];
};

type VerifyResult = {
  uid: string;
  email: string;
  userData: UserData;
  planData: PlanData | null;
  adminDb: ReturnType<typeof getAdminDb>;
};

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (typeof value === "object" && value !== null) {
    const v: any = value;
    if (typeof v.toDate === "function") return v.toDate();
    if (typeof v.toMillis === "function") return new Date(v.toMillis());
    if (v.seconds) return new Date(v.seconds * 1000);
    if (v._seconds) return new Date(v._seconds * 1000);
  }
  if (typeof value === "string" || typeof value === "number" || value instanceof Date) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

async function verifyAndGetUser(token: string): Promise<VerifyResult | null> {
  const adminAuth = getAdminAuth();
  const adminDb = getAdminDb();
  if (!adminAuth) return null;

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    
    // Fetch userData using getDocWithFallback
    const userData = (await getDocWithFallback<any>("users", decoded.uid, "users.json")) as UserData || {};

    const selectedPlanName = userData.selectedPlan || "Free";
    
    // Fetch planData using getCollectionWithFallback
    const plans = await getCollectionWithFallback<any>("plans", "plans.json");
    const planData = (plans.find((p) => p.name === selectedPlanName) ?? null) as PlanData | null;

    return {
      uid: decoded.uid,
      email: decoded.email?.toLowerCase() ?? "",
      userData,
      planData,
      adminDb,
    };
  } catch (e) {
    console.error("[verifyAndGetUser] Failed to verify user/plan with fallback:", e);
    return null;
  }
}

function pickEncyclopediaRemaining(args: { userData: UserData; planData: PlanData | null }) {
  const { userData, planData } = args;
  const isFreePlan = !planData?.name || planData.name.toLowerCase() === "free";
  const defaultQuota = isFreePlan ? 5 : Number(planData?.aiRequests ?? 0);
  const quotaFromUser = Number(userData.encyclopediaRequestsQuota ?? 0);
  const remainingFromUser = Number(userData.encyclopediaRequestsRemaining);

  const quota = quotaFromUser || defaultQuota;
  const remaining = Number.isFinite(remainingFromUser) ? remainingFromUser : quota;

  // fallback jika quota plan unlimited (-1)
  if (!isFreePlan && (planData?.aiRequests === -1 || quota === -1)) {
    return { quota: -1 as const, remaining: -1 as const };
  }

  return { quota, remaining };
}

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const adminDb = getAdminDb();

    const { keyword, kategori, force } = (await request.json()) as {
      keyword?: string;
      kategori?: string;
      force?: boolean;
    };

    if (!keyword || !kategori) {
      return NextResponse.json({ error: "keyword dan kategori wajib diisi" }, { status: 400 });
    }

    const verified = token ? await verifyAndGetUser(token) : null;
    if (token && !verified) {
      return NextResponse.json({ error: "Akses paket tidak bisa diverifikasi." }, { status: 503 });
    }

    const uid = verified?.uid ?? "guest";
    const userData = verified?.userData ?? {};
    const planData = verified?.planData ?? null;

    // Check if generating user is admin
    const adminEmailListStr = process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? process.env.ADMIN_EMAILS ?? "";
    const adminEmails = adminEmailListStr.split(",").map(e => e.trim().toLowerCase()).filter(Boolean);
    const isEmailAdmin = adminEmails.includes(verified?.email ?? "");
    
    let isDbAdmin = false;
    if (verified && adminDb) {
      try {
        const adminUserDoc = await adminDb.collection("admin_users").doc(uid).get();
        isDbAdmin = adminUserDoc.exists;
      } catch (e) {
        console.warn("[Ensiklopedia Generate] Failed to query admin_users doc:", e);
      }
    }
    const isAdmin = !!(isDbAdmin || userData.role === "admin" || isEmailAdmin);

    // Blokir Akses Jika Bukan Admin (Cegah kebocoran kuota & AI dari publik/bot)
    if (!isAdmin) {
      return NextResponse.json({ error: "Akses ditolak. Fitur AI Ensiklopedia hanya untuk Admin." }, { status: 403 });
    }

    // Premium check
    const expiresAt = toDate(userData.premiumExpiresAt);

    // allowedModes check (sync dengan /api/ai)
    const allowedModes: string[] = Array.isArray(planData?.allowedModes) ? planData.allowedModes : [];
    const isFreePlan = !planData?.name || planData.name.toLowerCase() === "free";
    const hasModeAccess = isAdmin || !verified || isFreePlan || allowedModes.includes("bible-encyclopedia") || allowedModes.includes("bible");

    if (!hasModeAccess) {
      return NextResponse.json({ error: "Mode ensiklopedia tidak tersedia untuk paket kamu." }, { status: 403 });
    }

    // Cache check
    const slug = encyclopediaSlug(keyword);
    const cacheRef = adminDb ? adminDb.collection("ensiklopedia_cache").doc(`${kategori}-${slug}`) : null;
    let existingSnap: any = null;

    if (cacheRef) {
      try {
        existingSnap = await cacheRef.get();
      } catch (e) {
        console.warn("[Ensiklopedia Generate] Failed to read ensiklopedia_cache doc:", e);
      }
    }

    if (existingSnap && existingSnap.exists && !force) {
      const data = existingSnap.data() ?? {};
      const status = data.status || "review";

      const updates: Record<string, string | Date> = {};
      let bannerUrl = typeof data.bannerUrl === "string" ? data.bannerUrl : "";
      let illustrationUrl = typeof data.illustrationUrl === "string" ? data.illustrationUrl : "";

      if (!bannerUrl) {
        bannerUrl = await ensureEncyclopediaBannerR2({
          slug: `${kategori}-${slug}`,
          kategori,
          topik: keyword,
          force: false,
        });
        if (bannerUrl) updates.bannerUrl = bannerUrl;
      }

      const shouldRegenerateIllustration =
        !illustrationUrl ||
        isLegacyEncyclopediaIllustrationUrl(illustrationUrl) ||
        !isValidEncyclopediaIllustrationUrl(illustrationUrl);

      if (shouldRegenerateIllustration) {
        illustrationUrl = await ensureEncyclopediaIllustrationR2({
          slug: `${kategori}-${slug}-illustration`,
          kategori,
          topik: keyword,
          force: isLegacyEncyclopediaIllustrationUrl(illustrationUrl),
        });
        if (illustrationUrl) updates.illustrationUrl = illustrationUrl;
      }

      const cleanArticle = cleanEncyclopediaArticle(data.isi_artikel);
      if (cleanArticle && cleanArticle !== data.isi_artikel) updates.isi_artikel = cleanArticle;

      const article = {
        ...data,
        ...updates,
        isi_artikel: cleanArticle || cleanEncyclopediaArticle(data.isi_artikel),
        bannerUrl: bannerUrl || data.bannerUrl || "",
        illustrationUrl: illustrationUrl || data.illustrationUrl || "",
      };

      if (Object.keys(updates).length && cacheRef) {
        updates.updatedAt = new Date();
        try {
          await cacheRef.set(updates, { merge: true });
          
          // Trigger fast incremental R2 synchronization for updates
          try {
            const { syncSingleEncyclopediaItem } = await import("@/lib/server/backup-r2-service");
            await syncSingleEncyclopediaItem(article.id || `${kategori}-${slug}`, article, "upsert");
            console.log("[Ensiklopedia Generate] Fast incremental R2 synchronization completed successfully for updates.");
          } catch (syncErr) {
            console.error("[Ensiklopedia Generate] Failed to sync encyclopedia updates to R2:", syncErr);
          }
        } catch (e) {
          console.warn("[Ensiklopedia Generate] Failed to update cache doc:", e);
        }
      }

      return NextResponse.json({ ok: true, cacheHit: true, article: article });
    }

    // Generate artikel
    const prompt = [
      "Kamu adalah teolog dan ahli bahasa Alkitab yang berpengalaman, akurat, mendalam, dan berpusat pada Alkitab dengan sudut pandang Kristen yang sehat.",
      `Tulis artikel ensiklopedia Alkitab sepanjang 950 kata dalam bahasa Indonesia tentang: ${keyword} dalam kategori: ${kategori}.`,
      "",
      "Artikel HARUS menggunakan format sections berikut ini PERSIS (termasuk tanda ## dan nama section):",
      "",
      "## RINGKASAN KUNCI",
      `[Paragraf ringkasan 2-3 kalimat tentang ${keyword}, definisi dan penjelasan inti]`,
      "",
      "## INFORMASI SINGKAT",
      `Detail:[Tuliskan informasi singkat pertama tentang ${keyword}, misalnya asal-usul, latar belakang, atau fakta utama - dalam 2-4 kalimat]`,
      `Detail:[Tuliskan informasi singkat kedua yang melanjutkan penjelasan tentang ${keyword}, misalnya peran, konteks sejarah, atau fakta penting lainnya - dalam 2-4 kalimat]`,
      `Detail:[Tuliskan informasi singkat ketiga tentang ${keyword}, misalnya dampak, relevansi teologis, atau hubungan dengan tokoh/peristiwa lain - dalam 2-4 kalimat]`,
      "",
      "## PERISTIWA PENTING & KRONOLOGI",
      `[Deskripsi kronologi atau peristiwa-peristiwa penting yang berhubungan dengan ${keyword}. Gunakan angka atau bullet untuk setiap poin.]`,
      "",
      "## PELAJARAN ROHANI & PENERAPAN",
      `[Pelajaran iman Kristen dan penerapan praktis dari ${keyword} bagi kehidupan sehari-hari]`,
      "",
      "## DAFTAR AYAT REFERENSI",
      "[Daftar ayat Alkitab yang relevan, pisahkan dengan koma, contoh: Kejadian 1:1, Yohanes 3:16]",
      "",
      "Aturan penting:",
      "- Gunakan bahasa Indonesia yang baik dan benar",
      "- Hindari kesalahan teologis",
      "- Setiap section HARUS diisi dengan konten yang relevan",
      "- Jangan skip section manapun",
      "Kembalikan HANYA teks artikel dengan format markdown ## di atas. Jangan berikan pembuka atau penutup.",
    ].join("\n");

    const ai = await askDeepSeek("bible-study", prompt);

    if (ai.provider === "error") {
      return NextResponse.json(
        { error: ai.answer || "Gagal menghasilkan artikel ensiklopedia menggunakan AI." },
        { status: 502 }
      );
    }

    const bannerUrl = await ensureEncyclopediaBannerR2({
      slug: `${kategori}-${slug}`,
      kategori,
      topik: keyword,
      force: !!force,
    });

    const illustrationUrl = await ensureEncyclopediaIllustrationR2({
      slug: `${kategori}-${slug}-illustration`,
      kategori,
      topik: keyword,
      force: !!force,
    });

    const cleanArticle = cleanEncyclopediaArticle(ai.answer ?? "");
    const seoDescription = cleanArticle.replace(/\s+/g, " ").slice(0, 155).trim();

    const initialStatus = isAdmin ? "published" : "review";

    // Calculate dynamic theological confidence & source coverage scores
    const scriptureRefs = cleanArticle.match(/\b(Kejadian|Keluaran|Imamat|Bilangan|Ulangan|Yosua|Hakim|Rut|1\s*Samuel|2\s*Samuel|1\s*Raja|2\s*Raja|1\s*Tawarikh|2\s*Tawarikh|Ezra|Nehemia|Ester|Ayub|Mazmur|Amsal|Pengkhotbah|Kidung|Yesaya|Yeremia|Ratapan|Yehezkiel|Daniel|Hosea|Yoel|Amos|Obaja|Yunus|Mikha|Nahum|Habakuk|Zefanya|Hagai|Zakharia|Maleakhi|Matius|Markus|Lukas|Yohanes|Kisah|Roma|1\s*Korintus|2\s*Korintus|Galatia|Efesus|Filipi|Kolose|1\s*Tesalonika|2\s*Tesalonika|1\s*Timotius|2\s*Timotius|Titus|Filemon|Ibrani|Yakobus|1\s*Petrus|2\s*Petrus|1\s*Yohanes|2\s*Yohanes|3\s*Yohanes|Yudas|Wahyu)\b/gi) || [];
    const wordCount = cleanArticle.split(/\s+/).filter(Boolean).length;
    const confidenceScore = Math.min(100, Math.max(75, 80 + scriptureRefs.length * 3));
    const coverageScore = Math.min(100, Math.max(70, 70 + Math.round(wordCount / 15)));

    const articleDoc = {
      id: `${kategori}-${slug}`,
      kategori,
      keyword,
      slug,
      title: keyword,
      isi_artikel: cleanArticle,
      bannerUrl: bannerUrl || "",
      illustrationUrl: illustrationUrl || "",
      seo: buildSeoFields({
        title: `${keyword} - Ensiklopedia Alkitab Grace Daily`,
        description: seoDescription,
        keywords: [
          keyword,
          kategori,
          "Ensiklopedia Alkitab",
          "Grace Daily",
          "tokoh Alkitab",
          "studi Alkitab",
        ],
        slug,
        canonicalPath: `/ensiklopedia/${kategori}/${slug}`,
        image: bannerUrl || illustrationUrl || "",
        schemaType: "Article",
      }),
      status: initialStatus,
      confidenceScore,
      coverageScore,
      provider: ai.provider,
      providerErrors: ai.providerErrors ?? [],
      createdAt: new Date(),
      updatedAt: new Date(),
      generatedByUid: uid,
    };

    if (cacheRef) {
      try {
        await cacheRef.set(articleDoc, { merge: true });
        
        // Trigger fast incremental R2 synchronization for this article
        try {
          const { syncSingleEncyclopediaItem } = await import("@/lib/server/backup-r2-service");
          await syncSingleEncyclopediaItem(articleDoc.id, articleDoc, "upsert");
          console.log("[Ensiklopedia Generate] Fast incremental R2 synchronization completed successfully.");
        } catch (syncErr) {
          console.error("[Ensiklopedia Generate] Failed to sync encyclopedia to R2:", syncErr);
        }
      } catch (dbErr) {
        console.error("[Ensiklopedia Generate] Failed to save generated article to Firestore:", dbErr);
      }
    }

    return NextResponse.json({ ok: true, cacheHit: false, article: articleDoc });
  } catch (error: any) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal generate ensiklopedia" },
      { status: 500 },
    );
  }
}
