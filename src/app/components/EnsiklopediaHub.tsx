"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { collection, getDocs, query, where, doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { plans as defaultPlans } from "@/lib/data";
import { BIBLE_MASTER_DATA } from "@/lib/bible-master-data";
import { useLanguage } from "@/lib/i18n";

type EncyclopediaCategory = {
  key: string;
  label: string;
  icon: string;
};

type EncyclopediaArticle = {
  id: string;
  kategori: string;
  keyword: string;
  slug: string;
  title: string;
  isi_artikel: string;
  bannerUrl?: string;
  illustrationUrl?: string;
};

type GenerateResponse =
  | { ok: true; cacheHit: boolean; article: EncyclopediaArticle }
  | { error: string; code?: string };

const CATEGORIES: EncyclopediaCategory[] = [
  { key: "tokoh", label: "Tokoh", icon: "👤" },
  { key: "tempat", label: "Tempat", icon: "📍" },
  { key: "kamus", label: "Kamus", icon: "📚" },
  { key: "mukjizat", label: "Mukjizat", icon: "🔥" },
  { key: "perumpamaan", label: "Perumpamaan", icon: "📖" },
  { key: "kitab", label: "Kitab", icon: "📜" },
  { key: "kronologi", label: "Kronologi", icon: "🗓️" },
  { key: "silsilah", label: "Silsilah", icon: "👨‍👩‍👧‍👦" },
  { key: "teologi", label: "Teologi", icon: "⛪" },
  { key: "teologi-2", label: "Teologi 2", icon: "⛪" },
  { key: "topikal_alkitab", label: "Topikal Alkitab", icon: "📖" },
  { key: "peristiwa", label: "Peristiwa", icon: "🎭" },
  { key: "peristiwa-2", label: "Peristiwa 2", icon: "🎭" },
];

const GUEST_LIMIT = 5;
const GUEST_USAGE_KEY = "grace-daily-encyclopedia-guest-searches";

function toSlugFromKeyword(keyword: string) {
  return keyword
    .toLowerCase()
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function EnsiklopediaHub() {
  const { language } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryParam = searchParams ? searchParams.get("q") || "" : "";
  const categoryParam = searchParams ? searchParams.get("category") || searchParams.get("cat") || "tokoh" : "tokoh";

  const getCategoryLabel = (key: string) => {
    const map: Record<string, Record<string, string>> = {
      tokoh: { id: "Tokoh", en: "People/Characters", zh: "人物" },
      tempat: { id: "Tempat", en: "Places", zh: "地点" },
      kamus: { id: "Kamus", en: "Dictionary/Terms", zh: "词汇字典" },
      mukjizat: { id: "Mukjizat", en: "Miracles", zh: "神迹" },
      perumpamaan: { id: "Perumpamaan", en: "Parables", zh: "比喻" },
      kitab: { id: "Kitab", en: "Books of the Bible", zh: "书卷" },
      kronologi: { id: "Kronologi", en: "Chronology", zh: "年代记" },
      silsilah: { id: "Silsilah", en: "Genealogy", zh: "家谱" },
      teologi: { id: "Teologi", en: "Theology", zh: "神学" },
      "teologi-2": { id: "Teologi 2", en: "Theology 2", zh: "神学 2" },
      topikal_alkitab: { id: "Topikal Alkitab", en: "Biblical Topics", zh: "圣经主题" },
      peristiwa: { id: "Peristiwa", en: "Events", zh: "事件" },
      "peristiwa-2": { id: "Peristiwa 2", en: "Events 2", zh: "事件 2" },
    };
    return map[key]?.[language] || key;
  };

  const [currentUser, setCurrentUser] = useState<User | null>(auth?.currentUser ?? null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [kategori, setKategori] = useState<string>(categoryParam);
  const [keyword, setKeyword] = useState<string>(queryParam);

  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);

  const [result, setResult] = useState<EncyclopediaArticle | null>(null);
  const [error, setError] = useState<string>("");
  const [guestSearches, setGuestSearches] = useState(0);
  const [showPlanPopup, setShowPlanPopup] = useState(false);
  const [plans, setPlans] = useState<any[]>([]);
  const [paymentStatus, setPaymentStatus] = useState<string>("");

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user && db) {
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          setIsAdmin(userDoc.exists() && userDoc.data().role === "admin");
        } catch (e) {
          console.error(e);
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
      }
    });
  }, []);

  useEffect(() => {
    const stored = Number(window.localStorage.getItem(GUEST_USAGE_KEY) ?? "0");
    setGuestSearches(Number.isFinite(stored) ? stored : 0);
  }, []);

  useEffect(() => {
    if (!db) return;
    const database = db;
    async function loadPlans() {
      try {
        const snap = await getDocs(query(collection(database, "plans"), where("active", "==", true)));
        let list = snap.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name,
            price: isNaN(Number(data.price)) ? 0 : Number(data.price || 0),
            durationDays: Number(data.durationDays || 30),
            aiRequests: Number(data.aiRequests || 0),
            features: data.features ?? [],
            allowedModes: data.allowedModes ?? [],
            remainingSlots: data.remainingSlots,
          };
        });

        if (list.length === 0) {
          // Fallback to default plans from data.ts (excluding Free plan)
          list = defaultPlans
            .filter(p => p.name.toLowerCase() !== "free")
            .map((p, idx) => ({
              id: `fallback-${idx}`,
              name: p.name,
              price: parseInt(p.price.replace(/\D/g, "")),
              durationDays: p.durationDays,
              aiRequests: p.aiRequests,
              features: p.features,
              allowedModes: p.allowedModes ?? [],
              remainingSlots: undefined,
            }));
        } else {
          list.sort((a, b) => a.price - b.price);
        }
        setPlans(list);
      } catch (e) {
        console.error("Gagal memuat paket:", e);
      }
    }
    loadPlans();
  }, []);

  const quotaHint = useMemo(() => {
    return "";
  }, []);

  const handleCategoryChange = (newCat: string) => {
    setKategori(newCat);
    setKeyword("");
    setResult(null);
    setError("");
  };

  async function handleBuy(plan: any) {
    if (!currentUser) {
      router.push(`/login?plan=${encodeURIComponent(plan.name)}`);
      return;
    }

    if (plan.price === 0) {
      setPaymentStatus("Paket Free sudah otomatis aktif.");
      return;
    }

    setPaymentStatus(`Memproses pembayaran untuk ${plan.name}...`);
    try {
      const token = await currentUser.getIdToken();
      const grossAmount = plan.price;
      const response = await fetch("/api/midtrans", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          orderId: `ORDER-${currentUser.uid}-${Date.now()}`,
          grossAmount,
          customerName: currentUser.email?.split("@")[0],
          customerEmail: currentUser.email,
          planName: plan.name,
          durationDays: plan.durationDays,
          aiRequests: plan.aiRequests,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal menghubungi Midtrans");

      if (data.mode === "demo") {
        setPaymentStatus("Midtrans belum dikonfigurasi. Token demo diterima, tetapi pembayaran live belum aktif.");
        return;
      }

      const clientIsProduction = process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION === "true";
      if (typeof data.isProduction === "boolean" && data.isProduction !== clientIsProduction) {
        setPaymentStatus("Konfigurasi Midtrans tidak selaras: client key dan server key memakai environment berbeda.");
        return;
      }

      if (!data.token) {
        setPaymentStatus("Midtrans tidak mengembalikan token transaksi. Periksa Server Key dan Client Key.");
        return;
      }

      if (window.snap) {
        window.snap.pay(data.token, {
          onSuccess: async function (result: any) {
            setPaymentStatus("Pembayaran berhasil! Mengaktifkan paket...");
            if (db) {
              const activatedAt = new Date();
              const expiresAt = new Date(activatedAt);
              expiresAt.setDate(expiresAt.getDate() + Number(plan.durationDays || 30));

              await setDoc(doc(db, "users", currentUser.uid), {
                role: plan.name.toLowerCase() === "komunitas" ? "admin" : "premium",
                selectedPlan: plan.name,
                premiumActivatedAt: activatedAt,
                premiumExpiresAt: expiresAt,
                aiRequestsQuota: plan.aiRequests,
                aiRequestsRemaining: plan.aiRequests,
                premiumLastOrder: result?.order_id ?? null,
                updatedAt: serverTimestamp(),
              }, { merge: true });
            }
            setPaymentStatus(`Paket ${plan.name} berhasil diaktifkan. Terima kasih!`);
            setShowPlanPopup(false);
            router.refresh();
          },
          onPending: function (result: any) {
            setPaymentStatus("Menunggu pembayaran Anda...");
          },
          onError: function (result: any) {
            setPaymentStatus("Pembayaran gagal atau dibatalkan.");
          },
          onClose: function () {
            setPaymentStatus("Popup pembayaran ditutup.");
          }
        });
      } else {
        setPaymentStatus("Sistem Midtrans belum siap. Tunggu beberapa detik lalu klik Beli Paket lagi.");
      }
    } catch (err: any) {
      setPaymentStatus(err.message || "Gagal memproses pembayaran.");
    }
  }

  async function handleGenerate(overrideKeyword?: string) {
    setError("");
    setResult(null);

    const targetKeyword = overrideKeyword || keyword;
    const trimmed = targetKeyword.trim();
    if (!trimmed) {
      setError("Keyword wajib diisi.");
      return;
    }

    if (!currentUser && guestSearches >= GUEST_LIMIT) {
      setShowPlanPopup(true);
      return;
    }

    if (!isAdmin) {
      setLoading(true);
      try {
        const expectedSlug = toSlugFromKeyword(trimmed);
        const url = `/api/ensiklopedia/search?kategori=${encodeURIComponent(kategori)}&keyword=${encodeURIComponent(trimmed)}`;
        
        const response = await fetch(url);
        const data = await response.json();

        if (!response.ok) {
          setError(data.error || "Artikel belum tersedia.");
          setLoading(false);
          return;
        }

        const articleData = data.article as EncyclopediaArticle;
        setResult(articleData);
        
        if (!currentUser) {
          const nextCount = Math.min(GUEST_LIMIT, guestSearches + 1);
          window.localStorage.setItem(GUEST_USAGE_KEY, String(nextCount));
          setGuestSearches(nextCount);
        }
        
        const nextSlug = articleData.slug || expectedSlug;
        router.push(`/ensiklopedia/${encodeURIComponent(articleData.kategori)}/${encodeURIComponent(nextSlug)}`);
      } catch (err: any) {
        console.error(err);
        setError("Terjadi kesalahan saat mencari artikel.");
      } finally {
        setLoading(false);
      }
      return;
    }

    // Logika khusus Admin (Hit API LLM)
    setLoading(true);
    try {
      const idToken = currentUser ? await currentUser.getIdToken() : "";
      const payload = { keyword: trimmed, kategori };
      const res = await fetch("/api/ensiklopedia/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      const data = (await res.json().catch(() => ({} as GenerateResponse))) as GenerateResponse;

      if (!res.ok) {
        const msg = "error" in data && typeof (data as { error?: unknown }).error === "string" ? String((data as { error: unknown }).error) : "Gagal generate ensiklopedia";
        if (res.status === 402 || ("code" in data && data.code === "ENCYCLOPEDIA_PLAN_REQUIRED")) {
          setShowPlanPopup(true);
        }
        setError(
          res.status === 402
            ? `${msg} Silakan pilih paket Ensiklopedia untuk melanjutkan.`
            : msg,
        );
        return;
      }

      if ("ok" in data && data.ok) {
        setResult(data.article);
        const nextSlug = data.article.slug || toSlugFromKeyword(data.article.keyword || trimmed);
        router.push(`/ensiklopedia/${encodeURIComponent(data.article.kategori)}/${encodeURIComponent(nextSlug)}`);
      }
    } catch (e: any) {
      setError(e?.message ?? "Gagal generate ensiklopedia.");
    } finally {
      setLoading(false);
    }
  }

  // Prefer linking to article page; if article page doesn't exist yet, still show inline.
const articleHref = useMemo<string | null>(() => {
    const slug = toSlugFromKeyword(keyword);
    if (!keyword.trim() || !slug) return null;
    return `/ensiklopedia/${encodeURIComponent(kategori)}/${encodeURIComponent(slug)}`;
  }, [kategori, keyword]);

  return (
    <section className="pt-8">
      <div className="rounded-2xl border border-[#dfd8ca] bg-white p-6 shadow-sm">
        <div className="grid gap-6 lg:grid-cols-[1fr_0.95fr]">
          <div>
            <h2 className="text-2xl font-semibold text-[#14213d]">{language === "zh" ? "搜索圣经百科" : language === "en" ? "Search Bible Encyclopedia" : "Cari ensiklopedia Alkitab"}</h2>
              <p className="mt-2 text-sm text-[#52606d]">
                {language === "zh" ? "搜索圣经中的人物、地点和词汇。" : language === "en" ? "Search for Biblical characters, places, and terms." : "Cari tokoh, tempat, dan istilah Alkitab."}
              </p>
              {mounted && !currentUser ? (
                <p className="mt-3 rounded-md border border-[#dfd8ca] bg-[#f7f4ee] px-3 py-2 text-sm text-[#52606d]">
                  {language === "zh" ? "免登录剩余免费搜索次数: " : language === "en" ? "Remaining free guest searches: " : "Sisa pencarian gratis tanpa login: "}<span className="font-semibold text-[#14213d]">{Math.max(0, GUEST_LIMIT - guestSearches)}</span>
                </p>
              ) : null}


            <div className="mt-6 grid gap-3">
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-[#2a6f6f]">{language === "zh" ? "分类" : language === "en" ? "Category" : "Kategori"}</span>
                <select
                  value={kategori}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className="w-full rounded-md border border-[#dfd8ca] bg-[#f7f4ee] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#2a6f6f]"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.icon} {getCategoryLabel(c.key)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-semibold text-[#2a6f6f]">{language === "zh" ? "关键词" : language === "en" ? "Keyword" : "Keyword"}</span>
                <div className="flex gap-2">
                  <input
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    placeholder={language === "zh" ? "例如: 大卫, 耶路撒冷, 法利赛人" : language === "en" ? "Example: David, Jerusalem, Pharisee" : "Contoh: Daud, Yerusalem, Farisi"}
                    className="flex-1 rounded-md border border-[#dfd8ca] bg-[#f7f4ee] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#2a6f6f]"
                  />
                  <button
                    type="button"
                    onClick={() => startTransition(() => handleGenerate())}
                    disabled={loading || isPending}
                    className="rounded-md bg-[#2a6f6f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1a4a4a] disabled:opacity-60"
                  >
                    {loading || isPending ? (language === "zh" ? "处理中..." : language === "en" ? "Processing..." : "Memproses...") : (language === "zh" ? "搜索" : language === "en" ? "Search" : "Cari")}
                  </button>
                </div>
              </label>

              {error && (
                <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}
            </div>

            <div className="mt-8">
              <p className="text-sm font-semibold text-[#2a6f6f] mb-3">{language === "zh" ? "推荐主题" : language === "en" ? "Recommended Topics" : "Rekomendasi Topik"} {getCategoryLabel(kategori)}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {BIBLE_MASTER_DATA.filter(item => item.category === kategori).slice(0, 10).map((rec) => (
                  <button
                    key={rec.slug}
                    type="button"
                    onClick={() => {
                      setKeyword(rec.name);
                      startTransition(() => handleGenerate(rec.name));
                    }}
                    className="flex flex-col items-start text-left rounded-lg border border-[#dfd8ca] bg-[#f7f4ee] p-3 hover:bg-white hover:border-[#2a6f6f] hover:shadow-sm transition group"
                  >
                    <span className="font-bold text-[#14213d] group-hover:text-[#2a6f6f] transition-colors">{rec.name}</span>
                    <span className="text-xs text-[#52606d] mt-1.5 leading-relaxed">{rec.reason}</span>
                  </button>
                ))}
              </div>
            </div>

            {result && (
              <div className="mt-8">
                <div className="flex items-center justify-between gap-4 border-t border-[#dfd8ca] pt-6">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-[#2a6f6f]">
                      {getCategoryLabel(result.kategori)} • {result.keyword}
                    </p>
                    <h3 className="mt-1 text-xl font-semibold text-[#14213d]">{result.title}</h3>
                  </div>
                  {articleHref ? (
                    <Link
                      href={articleHref}
                      className="rounded-md bg-[#14213d] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0f2532] transition"
                    >
                      {language === "zh" ? "打开文章" : language === "en" ? "Open Article" : "Buka artikel"}
                    </Link>
                  ) : null}
                </div>

                <div className="mt-4 rounded-lg border border-[#dfd8ca] bg-[#f7f4ee] p-4 text-sm text-[#52606d]">
                  {result.bannerUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={result.bannerUrl} alt={result.title} className="mb-4 w-full max-h-[220px] object-cover rounded-lg border border-[#dfd8ca]" />
                  ) : null}
                  {language === "zh" ? "正在打开完整文章页面..." : language === "en" ? "Opening full article page..." : "Membuka halaman artikel lengkap..."}
                </div>
              </div>
            )}
          </div>

          <aside>
            <div className="rounded-xl border border-[#dfd8ca] bg-[#f7f4ee] p-4">
              <p className="text-sm font-semibold text-[#2a6f6f]">{language === "zh" ? "分类" : language === "en" ? "Category" : "Kategori"}</p>
              <div className="mt-3 grid gap-2">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => handleCategoryChange(c.key)}
                    className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm font-semibold transition ${
                      kategori === c.key
                        ? "border-[#2a6f6f] bg-white text-[#14213d]"
                        : "border-[#dfd8ca] bg-[#f7f4ee] text-[#52606d] hover:bg-white"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span>{c.icon}</span>
                      <span>{getCategoryLabel(c.key)}</span>
                    </span>
                    <span className="text-xs text-[#2a6f6f]">→</span>
                  </button>
                ))}
              </div>

              {quotaHint ? (
                <p className="mt-4 text-xs text-[#52606d]">{quotaHint}</p>
              ) : null}

            </div>
          </aside>
        </div>
      </div>

      {showPlanPopup ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 px-4">
          <div className="w-full max-w-lg rounded-lg border border-[#dfd8ca] bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#2a6f6f]">
                  {language === "zh" ? "百科全书包" : language === "en" ? "Encyclopedia Package" : "Paket Ensiklopedia"}
                </p>
                <h3 className="mt-2 text-2xl font-semibold text-[#14213d]">
                  {language === "zh" ? "升级您的搜索额度" : language === "en" ? "Upgrade Your Search Quota" : "Lanjutkan pencarian tanpa batas kecil"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowPlanPopup(false);
                  setPaymentStatus("");
                }}
                className="rounded-md border border-[#dfd8ca] px-3 py-1 text-sm font-semibold text-[#14213d]"
              >
                {language === "zh" ? "关闭" : language === "en" ? "Close" : "Tutup"}
              </button>
            </div>

            {paymentStatus && (
              <div className="mt-3 rounded-md border border-[#dfd8ca] bg-[#f7f4ee] p-3 text-sm text-[#14213d] text-center font-medium">
                {paymentStatus}
              </div>
            )}

            <div className="mt-5 grid gap-3 max-h-[320px] overflow-y-auto pr-1">
              {plans.map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => handleBuy(plan)}
                  className="w-full text-left rounded-lg border border-[#dfd8ca] bg-[#f7f4ee] p-4 hover:bg-white hover:border-[#2a6f6f] hover:shadow-sm transition cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-bold text-[#14213d] text-sm">{plan.name}</p>
                      <p className="mt-1 text-xs text-[#52606d]">
                        {Array.isArray(plan.features) ? plan.features.join(", ") : ""}
                      </p>
                    </div>
                    <p className="text-base font-bold text-[#2a6f6f] whitespace-nowrap">
                      {plan.price > 0 ? `Rp${plan.price.toLocaleString("id-ID")}` : (language === "zh" ? "免费" : language === "en" ? "Free" : "Gratis")}
                    </p>
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/login"
                className="rounded-md bg-[#2a6f6f] px-4 py-3 text-center font-semibold text-white hover:bg-[#1a4a4a] flex-1"
              >
                {language === "zh" ? "登录 / 选择套餐" : language === "en" ? "Login / Choose Plan" : "Login / Pilih Paket"}
              </Link>
              <Link
                href="/#paket"
                className="rounded-md border border-[#dfd8ca] px-4 py-3 text-center font-semibold text-[#14213d] hover:bg-[#f7f4ee] flex-1"
              >
                {language === "zh" ? "查看所有套餐" : language === "en" ? "View all packages" : "Lihat semua paket"}
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
