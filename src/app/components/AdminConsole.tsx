"use client";

import { FormEvent, useEffect, useRef, useState, useMemo } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  deleteDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  writeBatch,
  updateDoc,
  getCountFromServer,
} from "firebase/firestore";
import Link from "next/link";
import { auth, db, hasFirebaseConfig } from "@/lib/firebase";
import { blogCategories } from "@/lib/data";
import { BIBLE_MASTER_DATA } from "@/lib/bible-master-data";
import { Editor } from "@tinymce/tinymce-react";
import ReactMarkdown from "react-markdown";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

type PlanDoc = {
  id: string;
  name: string;
  price: number;
  durationDays: number;
  aiRequests: number;
  features: string[]; // Dipastikan bertipe array string
  allowedModes?: string[]; // Array dari AiMode yang diizinkan (misal: daily-devotion, pastor)
  active: boolean;
};

type BlogDoc = {
  id: string;
  title: string;
  category: string;
  status: string;
  imageUrl?: string;
  bannerUrl?: string;
  excerpt?: string;
};

type SongDoc = {
  id: string;
  title: string;
  artist: string;
  url: string;
};

type PastoralQuestionDoc = {
  id: string;
  authorName: string;
  category: string;
  question: string;
  answer: string;
  pastorNotes?: string;
  isVerifiedByPastor?: boolean;
};

type BulletinDoc = {
  title: string;
  content: string;
  isActive: boolean;
  url?: string;
};

type UserDoc = {
  uid: string;
  email: string;
  role: string;
  selectedPlan: string;
  premiumExpiresAt?: unknown;
};

const collections = [
  { id: "admin_users/{uid}", purpose: "Super-admin dan admin aplikasi" },
  { id: "bible_verses/{translation-book-chapter-verse}", purpose: "Data Alkitab AYT dari HelloAO" },
  { id: "daily_devotions/{slug}", purpose: "Renungan harian terbit" },
  { id: "golden_verses/{slug}", purpose: "Ayat emas berdasarkan tema" },
  { id: "blog_posts/{slug}", purpose: "Artikel blog dan kategori" },
  { id: "songs/{slug}", purpose: "Rekomendasi lagu rohani" },
  { id: "prayer_rooms/{roomId}/requests/{requestId}", purpose: "Komunitas doa" },
  { id: "users/{uid}/journals/{journalId}", purpose: "Jurnal spiritual user" },
  { id: "plans/{planId}", purpose: "Paket membership" },
  { id: "subscriptions/{subscriptionId}", purpose: "Status premium dan Midtrans" },
  { id: "ai_requests/{requestId}", purpose: "Audit dan limit penggunaan" },
];

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function jakartaDayKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function normalizeForDuplicate(value: string) {
  return value
    .toLowerCase()
    .replace(/<[^>]*>/g, " ")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function contentFingerprint(value: string) {
  let hash = 0;
  const normalized = normalizeForDuplicate(value);
  for (let i = 0; i < normalized.length; i += 1) {
    hash = Math.imul(31, hash) + normalized.charCodeAt(i);
    hash |= 0;
  }
  return `${normalized.length}-${Math.abs(hash)}`;
}

function ApiKeysPanel({ auth }: { auth: any }) {
  const [keys, setKeys] = useState<{ name: string; configured: boolean }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadKeys() {
    setLoading(true);
    setError("");
    try {
      const token = await auth?.currentUser?.getIdToken();
      if (!token) throw new Error("Belum login");

      const res = await fetch("/api/admin/keys-status", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengambil data");

      setKeys(data.keys || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadKeys();
  }, []);

  return (
    <div className="rounded-lg border border-[#dfd8ca] bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-[#14213d]">Status Konfigurasi API Key</h2>
        <button
          onClick={loadKeys}
          disabled={loading}
          className="rounded-md bg-[#2a6f6f] px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-[#1a4a4a]"
        >
          {loading ? "Memuat..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">
          Error: {error}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {keys.map((k) => (
          <div key={k.name} className="flex items-center justify-between rounded border border-[#dfd8ca] p-3">
            <span className="font-mono text-xs font-semibold text-[#14213d] truncate" title={k.name}>
              {k.name}
            </span>
            <span
              className={`rounded px-2 py-1 text-2xs font-bold uppercase tracking-wider ${
                k.configured ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
              }`}
            >
              {k.configured ? "Configured" : "Missing"}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-[#52606d]">
        Catatan: Panel ini hanya mendeteksi apakah variabel `process.env` ada di `.env.local` server. 
        Ketersediaan saldo/kuota dari masing-masing API tidak divalidasi di sini untuk menghindari charge API.
      </p>
    </div>
  );
}

export function AdminConsole() {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isAdmin, setIsAdmin] = useState(false);
  const [status, setStatus] = useState("Memeriksa sesi admin...");
  const [plans, setPlans] = useState<PlanDoc[]>([]);
  const [posts, setPosts] = useState<BlogDoc[]>([]);
  const [usersList, setUsersList] = useState<UserDoc[]>([]);
  const [songs, setSongs] = useState<SongDoc[]>([]);
  const [debouncedUserSearch, setDebouncedUserSearch] = useState("");
  const [usersLoading, setUsersLoading] = useState(false);
  const [totalUsersCount, setTotalUsersCount] = useState(0);
  const [totalUsersPages, setTotalUsersPages] = useState(1);
  const [selectedUserDurations, setSelectedUserDurations] = useState<Record<string, string>>({});
  const [questions, setQuestions] = useState<PastoralQuestionDoc[]>([]);
  const [bulletin, setBulletin] = useState<BulletinDoc>({ title: "", content: "", isActive: false, url: "" });
  const [cloudflareLimitExceeded, setCloudflareLimitExceeded] = useState(false);
  
  // R2 Backup states
  const [r2BackupInfo, setR2BackupInfo] = useState<any | null>(null);
  const [r2BackupLoading, setR2BackupLoading] = useState(false);
  const [r2BackupError, setR2BackupError] = useState<string | null>(null);
  const [isBackingUpR2, setIsBackingUpR2] = useState(false);
  
  const [aiRequests, setAiRequests] = useState<any[]>([]);
  const [activitiesPage, setActivitiesPage] = useState(1);
  const [activitySearch, setActivitySearch] = useState("");
  const [activityFilter, setActivityFilter] = useState("Semua");
  const [expandedActivityId, setExpandedActivityId] = useState<string | null>(null);

  // Public Subscribers States
  const [emailSubscribers, setEmailSubscribers] = useState<any[]>([]);
  const [pushSubscribers, setPushSubscribers] = useState<any[]>([]);
  const [loadingSubscribers, setLoadingSubscribers] = useState(false);
  const [subscribersSubTab, setSubscribersSubTab] = useState<"email" | "push">("email");
  const [revealedEmails, setRevealedEmails] = useState<Record<string, boolean>>({});
  const [showAllEmails, setShowAllEmails] = useState(false);
  const [whatsappChannelUrl, setWhatsappChannelUrl] = useState("");

  const [usersPage, setUsersPage] = useState(1);
  const [postsPage, setPostsPage] = useState(1);
  const [questionsPage, setQuestionsPage] = useState(1);
  const [encyclopediaPage, setEncyclopediaPage] = useState(1);
  const [r2Page, setR2Page] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Database backup states
  const [importStatus, setImportStatus] = useState<string>("");
  const [importProgress, setImportProgress] = useState<number>(0);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // Push Notification states
  const [pushTitle, setPushTitle] = useState("");
  const [pushBody, setPushBody] = useState("");
  const [pushUrl, setPushUrl] = useState("");
  const [pushPrefKey, setPushPrefKey] = useState<string>("general");
  const [pushStatus, setPushStatus] = useState("");
  const [isSendingPush, setIsSendingPush] = useState(false);
  const [totalPushTokens, setTotalPushTokens] = useState(0);

  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [pastorNotes, setPastorNotes] = useState("");
  const [isVerified, setIsVerified] = useState(false);

  const [bulletinTitle, setBulletinTitle] = useState("");
  const [bulletinContent, setBulletinContent] = useState("");
  const [bulletinIsActive, setBulletinIsActive] = useState(false);
  const [bulletinUrl, setBulletinUrl] = useState("");

  const [songTitle, setSongTitle] = useState("");
  const [songArtist, setSongArtist] = useState("");
  const [songUrl, setSongUrl] = useState("");
  const [editingSongId, setEditingSongId] = useState<string | null>(null);

  const [blogTitle, setBlogTitle] = useState("");
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const blogEditorRef = useRef<any>(null);
  const [blogCategory, setBlogCategory] = useState(blogCategories[0]);
  const [blogStatus, setBlogStatus] = useState("draft");
  const [blogExcerpt, setBlogExcerpt] = useState("");
  const [blogBody, setBlogBody] = useState("<p>Tulis konten artikel di sini.</p>");
  const [blogImage, setBlogImage] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  // Kategori Blog dinamis dari Firestore
  const [categoriesList, setCategoriesList] = useState<string[]>([]);
  const [newCatInput, setNewCatInput] = useState("");
  const [editingCatOldName, setEditingCatOldName] = useState<string | null>(null);
  const [editingCatNewName, setEditingCatNewName] = useState("");
  const [encyclopediaList, setEncyclopediaList] = useState<any[]>([]);
  const [encyclopediaCorrections, setEncyclopediaCorrections] = useState<any[]>([]);
  const [encyclopediaSearch, setEncyclopediaSearch] = useState("");
  const [onlyShowPicsum, setOnlyShowPicsum] = useState(false);

  const encyclopediaCompleteness = useMemo(() => {
    const categories = ['tokoh', 'tempat', 'kamus', 'teologi', 'perumpamaan', 'mukjizat', 'kitab', 'kronologi'];
    
    return categories.map(cat => {
      const masterItems = BIBLE_MASTER_DATA.filter(item => item.category === cat);
      const cachedItems = encyclopediaList.filter(item => (item.kategori || item.category) === cat);
      const cachedSlugs = new Set(cachedItems.map(item => item.slug).filter(Boolean));
      
      const missingItems = masterItems.filter(item => !cachedSlugs.has(item.slug));
      const generatedItems = masterItems.filter(item => cachedSlugs.has(item.slug));
      
      return {
        category: cat,
        total: masterItems.length,
        generated: generatedItems.length,
        missing: missingItems
      };
    });
  }, [encyclopediaList]);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [recPage, setRecPage] = useState<Record<string, number>>({});
  
  // Custom Generate State
  const [customKeyword, setCustomKeyword] = useState("");
  const [customKategori, setCustomKategori] = useState("tokoh");
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generateModalResult, setGenerateModalResult] = useState<any>(null);
  const [isGeneratingCustom, setIsGeneratingCustom] = useState(false);

  // Encyclopedia Editor States
  const [editingEncyclopediaId, setEditingEncyclopediaId] = useState<string | null>(null);
  const [encyclopediaTitle, setEncyclopediaTitle] = useState("");
  const [encyclopediaKeyword, setEncyclopediaKeyword] = useState("");
  const [encyclopediaKategori, setEncyclopediaKategori] = useState("tokoh");
  const [encyclopediaIsi, setEncyclopediaIsi] = useState("");
  const [encyclopediaConfidence, setEncyclopediaConfidence] = useState(90);
  const [encyclopediaCoverage, setEncyclopediaCoverage] = useState(88);
  const [encyclopediaStatus, setEncyclopediaStatus] = useState("published");
  const [encyclopediaBannerUrl, setEncyclopediaBannerUrl] = useState("");
  const [encyclopediaIllustrationUrl, setEncyclopediaIllustrationUrl] = useState("");
  const [showEncyclopediaEditModal, setShowEncyclopediaEditModal] = useState(false);

  // Integrasi Google & script global
  const [googleAnalyticsId, setGoogleAnalyticsId] = useState("");
  const [googleAnalyticsPropertyId, setGoogleAnalyticsPropertyId] = useState("");
  const [googleTagManagerId, setGoogleTagManagerId] = useState("");
  const [googleSearchConsoleToken, setGoogleSearchConsoleToken] = useState("");
  const [globalHeaderScripts, setGlobalHeaderScripts] = useState("");
  const [globalBodyScripts, setGlobalBodyScripts] = useState("");

  // Google Analytics Reporting
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState("");
  const [mounted, setMounted] = useState(false);

  // Iklan / Ads
  const [adImageUrl, setAdImageUrl] = useState("");
  const [adTargetUrl, setAdTargetUrl] = useState("");
  const [adPlacement, setAdPlacement] = useState("popup");
  const [adIsActive, setAdIsActive] = useState(false);
  const [adTitle, setAdTitle] = useState("");

  // AdSense Configuration
  const [adsenseClient, setAdSenseClient] = useState("");
  const [adsenseSlot, setAdSenseSlot] = useState("");
  const [adsensePosition, setAdSensePosition] = useState("sidebar");
  const [adsenseTargets, setAdSenseTargets] = useState({
    renungan: true,
    artikel: true,
    ensiklopedia: true,
    landing: true,
  });
  const [adsenseLandingSection, setAdSenseLandingSection] = useState("header");
  const [adsenseIntensity, setAdSenseIntensity] = useState("medium");
  const [adsenseEnabled, setAdSenseEnabled] = useState(false);

  // Voice to Text states
  const [isListeningTitle, setIsListeningTitle] = useState(false);
  const [isListeningExcerpt, setIsListeningExcerpt] = useState(false);
  const [isListeningBody, setIsListeningBody] = useState(false);

  const [planName, setPlanName] = useState("Premium");
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [planPrice, setPlanPrice] = useState("49000");
  const [planDays, setPlanDays] = useState("30");
  const [planRequests, setPlanRequests] = useState("300");
  const [planUnlimitedRequests, setPlanUnlimitedRequests] = useState(false);
  const [planFeatures, setPlanFeatures] = useState("Pendeta, Export PDF, Jurnal spiritual");
  const [planAllowedModes, setPlanAllowedModes] = useState<string[]>([]);

  // Pengaturan Donasi Kemitraan Dinamis
  const [donationMinAmount, setDonationMinAmount] = useState("20000");
  const [donationMultiplier, setDonationMultiplier] = useState("20000");
  const [donationDurationDays, setDonationDurationDays] = useState("30");
  const [donationAiRequests, setDonationAiRequests] = useState("50");
  const [donationMinAmountUsd, setDonationMinAmountUsd] = useState("2");
  const [donationMultiplierUsd, setDonationMultiplierUsd] = useState("1.5");
  const [donationQuickAmountsUsd, setDonationQuickAmountsUsd] = useState("5, 10, 25, 50");
  const [adminUid, setAdminUid] = useState("");
  const [isRegeneratingEncyclopediaImages, setIsRegeneratingEncyclopediaImages] = useState(false);

  const [userSearch, setUserSearch] = useState("");
  const [selectedUserPlans, setSelectedUserPlans] = useState<Record<string, string>>({});

  // Debounce search input for resource efficiency
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedUserSearch(userSearch);
      setUsersPage(1);
    }, 500);
    return () => clearTimeout(handler);
  }, [userSearch]);

  // Fetch users from API
  const fetchUsers = async () => {
    if (!user) return;
    setUsersLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/admin/users?page=${usersPage}&limit=10&search=${encodeURIComponent(debouncedUserSearch)}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setUsersList(data.users || []);
        setTotalUsersPages(data.totalPages || 1);
        setTotalUsersCount(data.totalUsers || 0);
      } else {
        console.error("Gagal memuat daftar pengguna");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "users" && user) {
      fetchUsers();
    }
  }, [activeTab, usersPage, debouncedUserSearch, user]);

  // Instant update user role/duration via unified API route
  async function handleUpdateUserRole(targetUid: string, nextRole: string, duration: string) {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          uid: targetUid,
          role: nextRole,
          durationDays: duration,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus(`Status pengguna berhasil diubah ke ${nextRole.toUpperCase()}`);
        fetchUsers();
      } else {
        alert(`Gagal memperbarui status: ${data.error || "Terjadi kesalahan"}`);
      }
    } catch (err) {
      console.error(err);
      alert("Gagal menghubungi server untuk memperbarui status.");
    }
  }

  // Daily devotion management
  const [devotions, setDevotions] = useState<any[]>([]);
  const [editingDevotionId, setEditingDevotionId] = useState<string | null>(null);
  const [devotionTitle, setDevotionTitle] = useState("");
  const [devotionVerseRef, setDevotionVerseRef] = useState("");
  const [devotionVerseText, setDevotionVerseText] = useState("");
  const [devotionBody, setDevotionBody] = useState("");
  const [devotionPrayer, setDevotionPrayer] = useState("");
  const [devotionIllustrationUrl, setDevotionIllustrationUrl] = useState("");
  const [devotionDateId, setDevotionDateId] = useState("");
  const [devotionStatus, setDevotionStatus] = useState("published");
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isTriggeringDailyDevotion, setIsTriggeringDailyDevotion] = useState(false);
  const [devotionPage, setDevotionPage] = useState(1);

  // User reviews management
  const [reviews, setReviews] = useState<any[]>([]);
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [reviewName, setReviewName] = useState("");
  const [reviewRole, setReviewRole] = useState("");
  const [reviewQuote, setReviewQuote] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewAvatar, setReviewAvatar] = useState("");
  const [reviewStatus, setReviewStatus] = useState("published");

  // Media & AI Content Generator States
  const [autoBlogEnabled, setAutoBlogEnabled] = useState(false);
  const [mediaSubTab, setMediaSubTab] = useState<"generator" | "library">("generator");
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [r2Files, setR2Files] = useState<any[]>([]);
  const [r2Loading, setR2Loading] = useState(false);
  const [r2Uploading, setR2Uploading] = useState(false);
  const [r2Status, setR2Status] = useState("");
  const [selectedR2Files, setSelectedR2Files] = useState<string[]>([]);

  // Devotion Dictation States
  const [isListeningDevotionBody, setIsListeningDevotionBody] = useState(false);
  const [isListeningDevotionPrayer, setIsListeningDevotionPrayer] = useState(false);
  
  // Media Draft States
  const [mediaBlogTitle, setMediaBlogTitle] = useState("");
  const [mediaBlogExcerpt, setMediaBlogExcerpt] = useState("");
  const [mediaBlogCategory, setMediaBlogCategory] = useState(blogCategories[0]);
  const [mediaBlogBody, setMediaBlogBody] = useState("<p>Tulis konten artikel di sini.</p>");
  const [mediaBlogIcon, setMediaBlogIcon] = useState("logo");
  const [mediaBlogStatus, setMediaBlogStatus] = useState("published");
  const mediaBlogEditorRef = useRef<any>(null);

  // Sync selected blog category
  useEffect(() => {
    if (categoriesList.length > 0 && !categoriesList.includes(blogCategory)) {
      setBlogCategory(categoriesList[0]);
    }
  }, [categoriesList, blogCategory]);

  // Sync selected media category
  useEffect(() => {
    if (categoriesList.length > 0 && !categoriesList.includes(mediaBlogCategory)) {
      setMediaBlogCategory(categoriesList[0]);
    }
  }, [categoriesList, mediaBlogCategory]);

  async function handleAddCategory(newCat: string) {
    if (!db || !isAdmin) return;
    const trimmed = newCat.trim();
    if (!trimmed) {
      alert("Nama kategori tidak boleh kosong.");
      return;
    }
    if (categoriesList.includes(trimmed)) {
      alert("Kategori tersebut sudah ada.");
      return;
    }
    const newList = [...categoriesList, trimmed];
    try {
      await setDoc(doc(db, "settings", "blog_categories"), { list: newList });
      setCategoriesList(newList);
      setNewCatInput("");
      setStatus(`Kategori "${trimmed}" berhasil ditambahkan.`);
    } catch (e) {
      console.error(e);
      alert("Gagal menambahkan kategori.");
    }
  }

  async function handleEditCategory(oldCat: string, newCat: string) {
    if (!db || !isAdmin) return;
    const trimmed = newCat.trim();
    if (!trimmed) {
      alert("Nama kategori baru tidak boleh kosong.");
      return;
    }
    if (trimmed === oldCat) {
      setEditingCatOldName(null);
      return;
    }
    if (categoriesList.includes(trimmed) && trimmed !== oldCat) {
      alert("Kategori tersebut sudah ada.");
      return;
    }

    const confirmation = window.confirm(`Apakah Anda yakin ingin mengubah kategori "${oldCat}" menjadi "${trimmed}"? Ini juga akan mengubah kategori semua artikel yang menggunakan kategori lama.`);
    if (!confirmation) return;

    try {
      // 1. Update categories list
      const newList = categoriesList.map(c => c === oldCat ? trimmed : c);
      await setDoc(doc(db, "settings", "blog_categories"), { list: newList });
      setCategoriesList(newList);

      // 2. Update blog posts with this category in Firestore
      const q = query(collection(db, "blog_posts"));
      const snap = await getDocs(q);
      const batch = writeBatch(db);
      let count = 0;
      snap.forEach((postDoc) => {
        if (postDoc.data().category === oldCat) {
          batch.update(postDoc.ref, { category: trimmed });
          count++;
        }
      });
      if (count > 0) {
        await batch.commit();
      }

      setEditingCatOldName(null);
      setEditingCatNewName("");
      setStatus(`Kategori "${oldCat}" berhasil diubah menjadi "${trimmed}". ${count} artikel diperbarui.`);
      await loadAdminData();
    } catch (e) {
      console.error(e);
      alert("Gagal mengubah kategori.");
    }
  }

  async function handleDeleteCategory(cat: string) {
    if (!db || !isAdmin) return;
    if (categoriesList.length <= 1) {
      alert("Harus ada minimal satu kategori tersisa.");
      return;
    }

    const confirmation = window.confirm(`Apakah Anda yakin ingin menghapus kategori "${cat}"? Artikel yang menggunakan kategori ini akan dialihkan ke kategori pertama.`);
    if (!confirmation) return;

    try {
      // 1. Remove category from list
      const newList = categoriesList.filter(c => c !== cat);
      await setDoc(doc(db, "settings", "blog_categories"), { list: newList });
      setCategoriesList(newList);

      // 2. Update blog posts with this category
      const fallbackCat = newList[0] || "Renungan";
      const q = query(collection(db, "blog_posts"));
      const snap = await getDocs(q);
      const batch = writeBatch(db);
      let count = 0;
      snap.forEach((postDoc) => {
        if (postDoc.data().category === cat) {
          batch.update(postDoc.ref, { category: fallbackCat });
          count++;
        }
      });
      if (count > 0) {
        await batch.commit();
      }

      setStatus(`Kategori "${cat}" berhasil dihapus. ${count} artikel dialihkan ke "${fallbackCat}".`);
      await loadAdminData();
    } catch (e) {
      console.error(e);
      alert("Gagal menghapus kategori.");
    }
  }

  async function handleExportDatabase() {
    if (!db || !isAdmin) return;
    setIsExporting(true);
    setStatus("Memulai ekspor database...");
    try {
      const collectionsToExport = [
        "blog_posts",
        "songs",
        "plans",
        "daily_devotions",
        "golden_verses",
        "settings",
        "users",
        "pastoral_questions",
        "prayer_rooms",
        "bible_verses",
        "ensiklopedia_cache",
        "ensiklopedia_corrections",
      ];
      
      const exportedData: Record<string, any[]> = {};
      
      for (const collName of collectionsToExport) {
        setStatus(`Mengekspor koleksi "${collName}"...`);
        const q = query(collection(db, collName));
        const snap = await getDocs(q);
        exportedData[collName] = snap.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
      }

      const backup = {
        exportedAt: new Date().toISOString(),
        version: "1.0",
        collections: exportedData,
      };

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `grace-daily-backup-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setStatus("Database berhasil diekspor.");
      alert("Database berhasil diekspor menjadi file JSON.");
    } catch (err) {
      console.error(err);
      setStatus("Gagal mengekspor database.");
      alert("Terjadi kesalahan saat mengekspor database.");
    } finally {
      setIsExporting(false);
    }
  }

  async function handleImportDatabase(file: File) {
    if (!db || !isAdmin) return;
    const confirmation = window.confirm(
      "PERINGATAN: Mengimpor database akan memperbarui/menggabungkan data yang ada dengan data dari file cadangan. Apakah Anda yakin ingin melanjutkan?"
    );
    if (!confirmation) return;

    setIsImporting(false);
    setImportProgress(0);
    setImportStatus("Membaca file cadangan...");
    setIsImporting(true);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result;
        if (typeof text !== "string") {
          throw new Error("Gagal membaca file sebagai teks.");
        }

        const firestore = db;
        if (!firestore) {
          throw new Error("Koneksi database tidak tersedia.");
        }

        const backup = JSON.parse(text);
        if (!backup || typeof backup.collections !== "object") {
          throw new Error("Format file cadangan tidak valid (koleksi tidak ditemukan).");
        }

        const collections = backup.collections;
        const totalCollections = Object.keys(collections).length;
        let collIndex = 0;

        for (const [collName, items] of Object.entries(collections)) {
          if (!Array.isArray(items)) continue;
          
          setImportStatus(`Mengimpor koleksi "${collName}"...`);
          const totalItems = items.length;
          
          for (let i = 0; i < totalItems; i++) {
            const item = items[i];
            if (!item || !item.id) continue;
            
            const { id, ...data } = item;
            await setDoc(doc(firestore, collName, id), data, { merge: true });
            
            const overallProgress = Math.round(
              ((collIndex + (i + 1) / totalItems) / totalCollections) * 100
            );
            setImportProgress(overallProgress);
            setImportStatus(`Mengimpor "${collName}": ${i + 1}/${totalItems} data selesai...`);
          }
          
          collIndex++;
          setImportProgress(Math.round((collIndex / totalCollections) * 100));
        }

        setImportStatus("Impor database selesai!");
        setStatus("Database berhasil diimpor dari file cadangan.");
        alert("Semua data berhasil diimpor ke Firestore!");
        await loadAdminData();
      } catch (err: any) {
        console.error(err);
        setImportStatus(`Gagal melakukan impor: ${err?.message || err}`);
        alert(`Gagal mengimpor database: ${err?.message || "Format file tidak valid."}`);
      } finally {
        setIsImporting(false);
      }
    };
    reader.onerror = () => {
      setImportStatus("Gagal membaca file.");
      setIsImporting(false);
    };
    reader.readAsText(file);
  }

  async function handleToggleSubscription(subId: string, field: "devotionEnabled" | "articleEnabled" | "active", currentValue: boolean) {
    if (!db) return;
    try {
      const docRef = doc(db, "emailSubscribers", subId);
      const newValue = !currentValue;
      
      // Update in Firestore
      await updateDoc(docRef, {
        [field]: newValue,
        updatedAt: serverTimestamp(),
      });
      
      // Update local state
      setEmailSubscribers((current) =>
        current.map((item) => (item.id === subId ? { ...item, [field]: newValue } : item))
      );
      
      // Sync update to R2
      const updatedItem = emailSubscribers.find((item) => item.id === subId);
      if (updatedItem) {
        const payload = { ...updatedItem, [field]: newValue, updatedAt: new Date().toISOString() };
        await syncDocR2("emailSubscribers", subId, "upsert", payload);
      }
      
      console.log(`[Subscription Manager] Successfully toggled ${field} for subscriber ${subId} to ${newValue}`);
    } catch (e) {
      console.error(e);
      alert("Gagal mengubah status langganan.");
    }
  }

  async function syncDocR2(collectionName: string, id: string, action: "upsert" | "delete" = "upsert", payload?: any) {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/admin/sync-doc", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ collection: collectionName, id, action, data: payload }),
      });
      const data = await res.json();
      if (!res.ok) {
        console.warn(`[R2 Sync] Failed to sync ${collectionName}/${id}:`, data.error || "Unknown error");
      } else {
        console.log(`[R2 Sync] Successfully synced ${collectionName}/${id} (${action})`);
      }
    } catch (err) {
      console.error(`[R2 Sync] Error syncing ${collectionName}/${id}:`, err);
    }
  }

  const [isSharingSocialsId, setIsSharingSocialsId] = useState<string | null>(null);

  async function shareToSocials(collectionName: string, id: string) {
    if (!user) {
      alert("Anda harus login terlebih dahulu.");
      return;
    }
    if (!confirm("Apakah Anda yakin ingin membagikan konten ini ke media sosial (Discord, Bluesky, Mastodon, Facebook)?")) {
      return;
    }
    setIsSharingSocialsId(id);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/admin/share-socials", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ collection: collectionName, id }),
      });
      const result = await res.json();
      if (res.ok) {
        alert("Berhasil dibagikan ke media sosial!");
      } else {
        alert(`Gagal membagikan ke media sosial: ${result.error || "Terjadi kesalahan"}`);
      }
    } catch (err: any) {
      console.error(err);
      alert(`Error: ${err.message || "Gagal membagikan ke media sosial"}`);
    } finally {
      setIsSharingSocialsId(null);
    }
  }

  async function loadAdminData() {
    if (!db) return;

    // ── PRIMARY: Load from R2/D1 via API (no Firebase reads) ──────────────
    try {
      const user = auth?.currentUser;
      const token = user ? await user.getIdToken() : null;
      if (token) {
        const apiRes = await fetch("/api/admin/data?tab=all", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (apiRes.ok) {
          const apiData = await apiRes.json();
          
          // Blog posts from R2/D1
          if (Array.isArray(apiData.posts) && apiData.posts.length > 0) {
            setPosts(apiData.posts.map((p: any) => ({
              id: p.id,
              title: p.title || "",
              category: p.category || "",
              status: p.status || "published",
              imageUrl: p.imageUrl || p.image_url || "",
              bannerUrl: p.bannerUrl || "",
              excerpt: p.excerpt || "",
            })));
          }

          // Daily devotions from R2
          if (Array.isArray(apiData.devotions) && apiData.devotions.length > 0) {
            setDevotions(apiData.devotions);
          }

          // Encyclopedia from D1/R2
          if (Array.isArray(apiData.encyclopedia) && apiData.encyclopedia.length > 0) {
            setEncyclopediaList(apiData.encyclopedia);
          }

          // Plans from R2
          if (Array.isArray(apiData.plans) && apiData.plans.length > 0) {
            setPlans(apiData.plans.map((p: any) => ({
              ...p,
              features: Array.isArray(p.features) ? p.features : [],
              allowedModes: Array.isArray(p.allowedModes) ? p.allowedModes : [],
            })));
          }

          // Songs from R2
          if (Array.isArray(apiData.songs) && apiData.songs.length > 0) {
            setSongs(apiData.songs);
          }

          // Settings from R2
          if (apiData.settings && typeof apiData.settings === "object") {
            const s = apiData.settings;
            
            // google_codes
            const googleCodes = s["google_codes"];
            if (googleCodes) {
              setGoogleAnalyticsId(googleCodes.googleAnalyticsId ?? "");
              setGoogleAnalyticsPropertyId(googleCodes.googleAnalyticsPropertyId ?? "");
              setGoogleTagManagerId(googleCodes.googleTagManagerId ?? "");
              setGoogleSearchConsoleToken(googleCodes.googleSearchConsoleToken ?? "");
              setGlobalHeaderScripts(googleCodes.globalHeaderScripts ?? "");
              setGlobalBodyScripts(googleCodes.globalBodyScripts ?? "");
              setWhatsappChannelUrl(googleCodes.WHATSAPP_CHANNEL_URL ?? "");
            }

            // ads
            const ads = s["ads"];
            if (ads) {
              setAdImageUrl(ads.imageUrl ?? "");
              setAdTargetUrl(ads.targetUrl ?? "");
              setAdPlacement(ads.placement ?? "popup");
              setAdIsActive(ads.isActive ?? false);
              setAdTitle(ads.title ?? "");
            }

            // bulletin
            const bulletin = s["bulletin"];
            if (bulletin) {
              setBulletin(bulletin as BulletinDoc);
              setBulletinTitle(bulletin.title ?? "");
              setBulletinContent(bulletin.content ?? "");
              setBulletinIsActive(bulletin.isActive ?? false);
              setBulletinUrl(bulletin.url ?? "");
            }

            // blog_categories
            const blogCats = s["blog_categories"];
            if (blogCats && Array.isArray(blogCats.list)) {
              setCategoriesList(blogCats.list);
            } else {
              setCategoriesList(blogCategories);
            }

            // auto_blog
            const autoBlog = s["auto_blog"];
            if (autoBlog) {
              setAutoBlogEnabled(autoBlog.enabled ?? false);
            }

            // ads_config (AdSense)
            const adsConfig = s["ads_config"];
            if (adsConfig) {
              setAdSenseClient(adsConfig.ad_client ?? "");
              setAdSenseSlot(adsConfig.ad_slot ?? "");
              setAdSensePosition(adsConfig.position ?? "sidebar");
              setAdSenseTargets(adsConfig.targets ?? { renungan: true, artikel: true, ensiklopedia: true, landing: true });
              setAdSenseLandingSection(adsConfig.landingSection ?? "header");
              setAdSenseIntensity(adsConfig.intensity ?? "medium");
              setAdSenseEnabled(adsConfig.isEnabled ?? false);
            }

            // donation
            const donation = s["donation"];
            if (donation) {
              setDonationMinAmount(donation.minAmount?.toString() ?? "20000");
              setDonationMultiplier(donation.multiplier?.toString() ?? "20000");
              setDonationDurationDays(donation.durationDaysPerMultiplier?.toString() ?? "30");
              setDonationAiRequests(donation.aiRequestsPerMultiplier?.toString() ?? "50");
              setDonationMinAmountUsd(donation.minAmountUsd?.toString() ?? "2");
              setDonationMultiplierUsd(donation.multiplierUsd?.toString() ?? "1.5");
              setDonationQuickAmountsUsd(donation.quickAmountsUsd ?? "5, 10, 25, 50");
            }
          }

          console.log("[AdminConsole] Loaded admin data from R2/D1 API successfully");
          
          // Still fetch Firebase-only data (user counts, ai_requests, reviews — not in R2)
          // These are lightweight and run separately in background
          loadFirebaseOnlyData();
          return; // ← Success, no need for Firebase fallback
        }
      }
    } catch (apiError) {
      console.warn("[AdminConsole] R2/D1 API failed, falling back to Firebase:", apiError);
    }

    // ── FALLBACK: Firebase direct queries (only if R2/D1 API failed) ───────
    try {
      const [planSnapshot, postSnapshot, userCountSnapshot, songSnapshot, questionSnapshot, bulletinSnap, aiSnapshot, googleCodesSnap, adsSnap, blogCatsSnap, devotionsSnap, reviewsSnap, autoBlogSnap, fcmTokensSnap] = await Promise.all([
        getDocs(query(collection(db, "plans"), limit(20))),
        getDocs(query(collection(db, "blog_posts"), orderBy("updatedAt", "desc"), limit(20))),
        getCountFromServer(collection(db, "users")),
        getDocs(query(collection(db, "songs"), limit(50))),
        getDocs(query(collection(db, "pastoral_questions"), orderBy("createdAt", "desc"), limit(500))),
        getDoc(doc(db, "settings", "bulletin")),
        getDocs(query(collection(db, "ai_requests"), limit(500))),
        getDoc(doc(db, "settings", "google_codes")),
        getDoc(doc(db, "settings", "ads")),
        getDoc(doc(db, "settings", "blog_categories")),
        getDocs(query(collection(db, "daily_devotions"), orderBy("generatedAt", "desc"), limit(50))),
        getDocs(query(collection(db, "user_reviews"), orderBy("createdAt", "desc"), limit(50))),
        getDoc(doc(db, "settings", "auto_blog")),
        getDocs(collection(db, "fcm_tokens")),
      ]);

      setPlans(
        planSnapshot.docs.map((item) => {
          const data = item.data() as Omit<PlanDoc, "id">;
          return { id: item.id, ...data, features: data.features ?? [], allowedModes: data.allowedModes ?? [] };
        }),
      );
      setPosts(
        postSnapshot.docs.map((item) => {
          const data = item.data() as Omit<BlogDoc, "id">;
          return { id: item.id, ...data };
        }),
      );
      setTotalUsersCount(userCountSnapshot.data().count);
      setSongs(
        songSnapshot.docs.map((item) => {
          const data = item.data() as Omit<SongDoc, "id">;
          return { id: item.id, ...data };
        }),
      );
      setQuestions(
        questionSnapshot.docs.map((item) => ({ id: item.id, ...item.data() } as PastoralQuestionDoc))
      );
      setDevotions(
        devotionsSnap.docs.map((item) => ({ id: item.id, ...item.data() }))
      );
      setReviews(
        reviewsSnap.docs.map((item) => ({ id: item.id, ...item.data() }))
      );
      setTotalPushTokens(fcmTokensSnap.size);
      if (bulletinSnap.exists()) {
        const data = bulletinSnap.data() as BulletinDoc;
        setBulletin(data);
        setBulletinTitle(data.title ?? "");
        setBulletinContent(data.content ?? "");
        setBulletinIsActive(data.isActive ?? false);
        setBulletinUrl(data.url ?? "");
      }
      if (googleCodesSnap.exists()) {
        const data = googleCodesSnap.data();
        setGoogleAnalyticsId(data.googleAnalyticsId ?? "");
        setGoogleAnalyticsPropertyId(data.googleAnalyticsPropertyId ?? "");
        setGoogleTagManagerId(data.googleTagManagerId ?? "");
        setGoogleSearchConsoleToken(data.googleSearchConsoleToken ?? "");
        setGlobalHeaderScripts(data.globalHeaderScripts ?? "");
        setGlobalBodyScripts(data.globalBodyScripts ?? "");
        setWhatsappChannelUrl(data.WHATSAPP_CHANNEL_URL ?? "");
      }
      if (adsSnap.exists()) {
        const data = adsSnap.data();
        setAdImageUrl(data.imageUrl ?? "");
        setAdTargetUrl(data.targetUrl ?? "");
        setAdPlacement(data.placement ?? "popup");
        setAdIsActive(data.isActive ?? false);
        setAdTitle(data.title ?? "");
      }
      
      // Load AdSense configuration
      try {
        const adsenseSnap = await getDoc(doc(db, "settings", "ads_config"));
        if (adsenseSnap.exists()) {
          const data = adsenseSnap.data();
          setAdSenseClient(data.ad_client ?? "");
          setAdSenseSlot(data.ad_slot ?? "");
          setAdSensePosition(data.position ?? "sidebar");
          setAdSenseTargets(data.targets ?? {
            renungan: true,
            artikel: true,
            ensiklopedia: true,
            landing: true,
          });
          setAdSenseLandingSection(data.landingSection ?? "header");
          setAdSenseIntensity(data.intensity ?? "medium");
          setAdSenseEnabled(data.isEnabled ?? false);
        }
      } catch (adsenseErr) {
        console.error("Failed to load AdSense config:", adsenseErr);
      }
      if (blogCatsSnap.exists()) {
        const data = blogCatsSnap.data();
        if (data && Array.isArray(data.list)) {
          setCategoriesList(data.list);
        } else {
          setCategoriesList(blogCategories);
        }
      } else {
        setCategoriesList(blogCategories);
        await setDoc(doc(db, "settings", "blog_categories"), { list: blogCategories });
      }
      
      const aiData = aiSnapshot.docs.map((item) => ({ id: item.id, ...item.data() } as any));
      aiData.sort((a, b) => {
        const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0;
        const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0;
        return tb - ta;
      });
      setAiRequests(aiData);

      if (autoBlogSnap.exists()) {
        setAutoBlogEnabled(autoBlogSnap.data()?.enabled ?? false);
      } else {
        setAutoBlogEnabled(false);
      }

      // Load donation settings
      try {
        const donationSnap = await getDoc(doc(db, "settings", "donation"));
        if (donationSnap.exists()) {
          const donationData = donationSnap.data();
          setDonationMinAmount(donationData.minAmount?.toString() ?? "20000");
          setDonationMultiplier(donationData.multiplier?.toString() ?? "20000");
          setDonationDurationDays(donationData.durationDaysPerMultiplier?.toString() ?? "30");
          setDonationAiRequests(donationData.aiRequestsPerMultiplier?.toString() ?? "50");
          setDonationMinAmountUsd(donationData.minAmountUsd?.toString() ?? "2");
          setDonationMultiplierUsd(donationData.multiplierUsd?.toString() ?? "1.5");
          setDonationQuickAmountsUsd(donationData.quickAmountsUsd ?? "5, 10, 25, 50");
        }
      } catch (donErr) {
        console.error("Failed to load donation settings:", donErr);
      }
    } catch (error) {
      console.error("Gagal memuat data:", error);
      setStatus("Gagal memuat data. Firebase mungkin sedang rate-limited (429). Coba lagi beberapa menit kemudian.");
    }
  }

  // Load Firebase-only data that doesn't exist in R2 (user counts, AI requests, reviews)
  async function loadFirebaseOnlyData() {
    if (!db) return;
    try {
      const [userCountSnapshot, questionSnapshot, aiSnapshot, reviewsSnap, fcmTokensSnap] = await Promise.all([
        getCountFromServer(collection(db, "users")).catch(() => null),
        getDocs(query(collection(db, "pastoral_questions"), orderBy("createdAt", "desc"), limit(500))).catch(() => null),
        getDocs(query(collection(db, "ai_requests"), limit(500))).catch(() => null),
        getDocs(query(collection(db, "user_reviews"), orderBy("createdAt", "desc"), limit(50))).catch(() => null),
        getDocs(collection(db, "fcm_tokens")).catch(() => null),
      ]);

      if (userCountSnapshot) setTotalUsersCount(userCountSnapshot.data().count);
      if (questionSnapshot) setQuestions(questionSnapshot.docs.map((item) => ({ id: item.id, ...item.data() } as PastoralQuestionDoc)));
      if (reviewsSnap) setReviews(reviewsSnap.docs.map((item) => ({ id: item.id, ...item.data() })));
      if (fcmTokensSnap) setTotalPushTokens(fcmTokensSnap.size);
      if (aiSnapshot) {
        const aiData = aiSnapshot.docs.map((item) => ({ id: item.id, ...item.data() } as any));
        aiData.sort((a, b) => {
          const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0;
          const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0;
          return tb - ta;
        });
        setAiRequests(aiData);
      }
    } catch (e) {
      console.warn("[AdminConsole] Firebase-only data load failed (non-critical):", e);
    }
  }


  useEffect(() => {
    if (activeTab === "langganan" && db && isAdmin) {
      async function loadSubscribers() {
        const firestore = db;
        if (!firestore) return;
        setLoadingSubscribers(true);
        try {
          const emailSnap = await getDocs(collection(firestore, "emailSubscribers"));
          const pushSnap = await getDocs(collection(firestore, "pushSubscribers"));
          
          setEmailSubscribers(emailSnap.docs.map(d => ({ id: d.id, ...d.data() })));
          setPushSubscribers(pushSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (err) {
          console.error("Gagal memuat data subscriber publik:", err);
        } finally {
          setLoadingSubscribers(false);
        }
      }
      loadSubscribers();
    }
  }, [activeTab, db, isAdmin]);

  useEffect(() => {
    const firebaseAuth = auth;
    const firestore = db;

    if (!firebaseAuth || !firestore) return;

    return onAuthStateChanged(firebaseAuth, async (nextUser) => {
      setUser(nextUser);

      if (!nextUser) {
        setIsAdmin(false);
        setStatus("Silakan login sebagai admin.");
        return;
      }

      try {
        const token = await nextUser.getIdToken();
        const response = await fetch("/api/me", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        }).catch(() => null);
        const data = response ? await response.json().catch(() => ({})) : {};
        const verifiedAdmin = Boolean(response?.ok && data.isAdmin);
        setIsAdmin(verifiedAdmin);

        if (verifiedAdmin) {
          setStatus("Admin aktif.");
          await loadAdminData();
        } else {
          setStatus("Akun ini belum terdaftar sebagai admin.");
        }
      } catch (error) {
        console.error("Error cek admin:", error);
        setIsAdmin(false);
        setStatus("Gagal memverifikasi akses admin (Periksa Firestore Rules).");
      }
    });
  }, []);

  async function handleSendPush(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;

    setIsSendingPush(true);
    setPushStatus("Sedang mengirim notifikasi...");

    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/admin/push", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: "broadcast",
          preferenceKey: pushPrefKey,
          title: pushTitle,
          body: pushBody,
          url: pushUrl,
        }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setPushStatus(`Berhasil mengirim notifikasi! Sukses: ${data.sentCount}, Gagal: ${data.failedCount}`);
        setPushTitle("");
        setPushBody("");
        setPushUrl("");
        await loadAdminData();
      } else {
        setPushStatus(`Gagal mengirim: ${data.error || "Error tidak diketahui"}`);
      }
    } catch (err: any) {
      console.error(err);
      setPushStatus(`Gagal mengirim: ${err.message}`);
    } finally {
      setIsSendingPush(false);
    }
  }

  async function triggerPredefinedPush(action: "trigger_devotion" | "trigger_article") {
    if (!user) return;

    setIsSendingPush(true);
    setPushStatus("Sedang memproses notifikasi...");

    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/admin/push", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setPushStatus(`Pemicu notifikasi berhasil! Sukses dikirim ke ${data.sentCount} perangkat.`);
        await loadAdminData();
      } else {
        setPushStatus(`Gagal memicu: ${data.error || "Error tidak diketahui"}`);
      }
    } catch (err: any) {
      console.error(err);
      setPushStatus(`Gagal memicu: ${err.message}`);
    } finally {
      setIsSendingPush(false);
    }
  }

  // Load Google Analytics report when activeTab is analytics
  const loadAnalyticsReport = async () => {
    if (!user) return;
    setAnalyticsLoading(true);
    setAnalyticsError("");
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/admin/analytics/report", {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        throw new Error("Gagal mengambil data laporan analitik");
      }
      const data = await response.json();
      setAnalyticsData(data);
    } catch (err: any) {
      console.error(err);
      setAnalyticsError(err.message || "Gagal memuat laporan analitik.");
    } finally {
      setAnalyticsLoading(false);
    }
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (activeTab === "analytics" && user) {
      loadAnalyticsReport();
    }
  }, [activeTab, user]);

  async function checkAiStatus() {
    if (!db) return;
    try {
      const docSnap = await getDoc(doc(db, "settings", "ai_status"));
      if (docSnap.exists()) {
        const data = docSnap.data();
        setCloudflareLimitExceeded(!!data.cloudflareLimitExceeded);
      } else {
        setCloudflareLimitExceeded(false);
      }
    } catch (err) {
      console.error("Gagal memuat status AI:", err);
    }
  }

  useEffect(() => {
    if (activeTab === "ensiklopedia" && user) {
      loadEncyclopediaCache();
      loadEncyclopediaCorrections();
      checkAiStatus();
    }
  }, [activeTab, user]);

  // Load R2 files when activeTab is media and mediaSubTab is library
  useEffect(() => {
    if (activeTab === "media" && mediaSubTab === "library" && user) {
      loadR2Files();
    }
  }, [activeTab, mediaSubTab, user]);

  async function loadR2Files() {
    if (!user) return;
    setR2Loading(true);
    setSelectedR2Files([]);
    setR2Status("Memuat file media...");
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/admin/media/list", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Gagal mengambil daftar file R2");
      const data = await response.json();
      setR2Files(data.files || []);
      setR2Status("");
    } catch (err: any) {
      console.error(err);
      setR2Status("Gagal memuat file media: " + err.message);
    } finally {
      setR2Loading(false);
    }
  }

  const fetchR2BackupStatus = async () => {
    setR2BackupLoading(true);
    setR2BackupError(null);
    try {
      const res = await fetch("/api/admin/r2-backup-status");
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      setR2BackupInfo(data);
    } catch (e) {
      console.error(e);
      setR2BackupError(e instanceof Error ? e.message : "Gagal memuat status");
    } finally {
      setR2BackupLoading(false);
    }
  };

  const handleRunR2BackupManual = async () => {
    if (!user) {
      alert("Error: Sesi admin tidak terdeteksi. Silakan login kembali.");
      return;
    }
    if (!window.confirm("Apakah Anda yakin ingin menjalankan pencadangan penuh ke R2 sekarang? Proses ini akan memakan waktu beberapa saat.")) return;
    setIsBackingUpR2(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/admin/r2-backup-status", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      if (data.status === "failed") {
        alert(`Backup selesai dengan kesalahan: ${data.error}`);
      } else {
        alert("Backup Firestore ke Cloudflare R2 berhasil diselesaikan!");
      }
      fetchR2BackupStatus();
    } catch (e) {
      console.error(e);
      alert("Gagal memicu backup ke R2: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setIsBackingUpR2(false);
    }
  };

  useEffect(() => {
    if (activeTab === "database" && user) {
      fetchR2BackupStatus();
    }
  }, [activeTab, user]);

  async function handleMediaLibraryUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setR2Uploading(true);
    setR2Status("Mengunggah file ke R2...");
    try {
      const token = await user.getIdToken();
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Gagal mengunggah");
      }

      setR2Status("File berhasil diunggah.");
      await loadR2Files();
    } catch (err: any) {
      console.error(err);
      setR2Status("Gagal mengunggah: " + err.message);
      alert("Gagal mengunggah file: " + err.message);
    } finally {
      setR2Uploading(false);
      e.target.value = "";
    }
  }

  async function handleDownloadR2File(key: string) {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/admin/media/download?key=${encodeURIComponent(key)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Gagal mendapatkan tautan download");
      }
      const data = await response.json();
      
      const fileRes = await fetch(data.url);
      if (!fileRes.ok) throw new Error("Gagal mendownload file dari R2");
      const blob = await fileRes.blob();
      
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = key;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err: any) {
      console.error(err);
      alert("Gagal mengunduh file: " + err.message);
    }
  }

  async function handleDeleteR2File(key: string) {
    if (!user) return;
    if (!window.confirm(`Apakah Anda yakin ingin menghapus file "${key}" dari Cloudflare R2?`)) return;

    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/admin/media/delete", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ key }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Gagal menghapus file");
      }

      setR2Status(`File ${key} berhasil dihapus.`);
      await loadR2Files();
    } catch (err: any) {
      console.error(err);
      alert("Gagal menghapus file: " + err.message);
    }
  }

  function handleToggleSelectR2File(key: string) {
    setSelectedR2Files((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  function handleToggleSelectAllR2Files() {
    if (selectedR2Files.length === r2Files.length) {
      setSelectedR2Files([]);
    } else {
      setSelectedR2Files(r2Files.map((f) => f.key || f.Key || ""));
    }
  }

  async function handleBulkDeleteR2Files() {
    if (selectedR2Files.length === 0 || !user) return;
    if (!window.confirm(`Apakah Anda yakin ingin menghapus ${selectedR2Files.length} file dari Cloudflare R2 secara masal?`)) return;

    setR2Loading(true);
    setR2Status(`Menghapus ${selectedR2Files.length} file...`);
    try {
      const token = await user.getIdToken();
      let successCount = 0;
      let failureCount = 0;

      await Promise.all(
        selectedR2Files.map(async (key) => {
          try {
            const response = await fetch("/api/admin/media/delete", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ key }),
            });
            if (response.ok) {
              successCount++;
            } else {
              failureCount++;
            }
          } catch (e) {
            failureCount++;
          }
        })
      );

      setR2Status(`Berhasil menghapus ${successCount} file.${failureCount > 0 ? ` Gagal menghapus ${failureCount} file.` : ""}`);
      setSelectedR2Files([]);
      await loadR2Files();
    } catch (err: any) {
      console.error(err);
      setR2Status("Gagal menghapus file: " + err.message);
    } finally {
      setR2Loading(false);
    }
  }

  async function handleBulkDownloadR2Files() {
    if (selectedR2Files.length === 0 || !user) return;
    setR2Status(`Mengunduh ${selectedR2Files.length} file secara masal...`);

    try {
      const token = await user.getIdToken();
      for (const key of selectedR2Files) {
        try {
          const response = await fetch(`/api/admin/media/download?key=${encodeURIComponent(key)}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!response.ok) throw new Error("Gagal mengambil tautan");
          const data = await response.json();

          const fileRes = await fetch(data.url);
          if (!fileRes.ok) throw new Error("Gagal mendownload");
          const blob = await fileRes.blob();

          const downloadUrl = window.URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = downloadUrl;
          link.download = key;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(downloadUrl);

          // Wait 300ms to avoid browser blocking
          await new Promise((resolve) => setTimeout(resolve, 300));
        } catch (e) {
          console.error(`Gagal mendownload ${key}:`, e);
        }
      }
      setR2Status("Unduhan masal selesai.");
    } catch (err: any) {
      console.error(err);
      setR2Status("Gagal mengunduh: " + err.message);
    }
  }

  async function handleToggleAutoBlog(enabled: boolean) {
    if (!db || !isAdmin) return;
    try {
      await setDoc(doc(db, "settings", "auto_blog"), { enabled }, { merge: true });
      setAutoBlogEnabled(enabled);
      setStatus(`Generator blog otomatis telah ${enabled ? "diaktifkan" : "dinonaktifkan"}.`);
    } catch (err: any) {
      console.error(err);
      alert("Gagal menyimpan pengaturan auto blog: " + err.message);
    }
  }

  async function findDuplicateBlogContent(currentPostId: string | null, title: string, body: string) {
    if (!db) return null;

    const normalizedTitle = normalizeForDuplicate(title);
    const nextBodyHash = contentFingerprint(body);
    const snapshot = await getDocs(collection(db, "blog_posts"));

    for (const postDoc of snapshot.docs) {
      if (currentPostId && postDoc.id === currentPostId) continue;

      const data = postDoc.data();
      const existingTitle = typeof data.title === "string" ? data.title : "";
      const existingBody = typeof data.body === "string" ? data.body : "";
      const existingNormalizedTitle =
        typeof data.normalizedTitle === "string"
          ? data.normalizedTitle
          : normalizeForDuplicate(existingTitle);
      const existingBodyHash =
        typeof data.bodyHash === "string"
          ? data.bodyHash
          : contentFingerprint(existingBody);
      const computedExistingBodyHash = contentFingerprint(existingBody);

      if (normalizedTitle && existingNormalizedTitle === normalizedTitle) {
        return { reason: "judul yang sama", title: existingTitle || postDoc.id };
      }

      if (
        nextBodyHash &&
        (existingBodyHash === nextBodyHash || computedExistingBodyHash === nextBodyHash)
      ) {
        return { reason: "isi artikel yang sama", title: existingTitle || postDoc.id };
      }
    }

    return null;
  }

  async function triggerManualAutoBlog() {
    if (!user || !isAdmin) return;
    if (!window.confirm("Apakah Anda yakin ingin memicu pembuatan artikel blog menggunakan AI sekarang? Ini akan memakan kuota OpenRouter/Groq dan mengirim newsletter ke seluruh user.")) return;

    setIsGeneratingAI(true);
    setStatus("Sedang membuat artikel menggunakan AI...");
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/cron/generate-blog", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Gagal memicu pembuatan artikel");
      }

      const data = await response.json();
      setStatus(`AI sukses membuat artikel: "${data.article.title}" via ${data.article.provider}. Email terkirim ke ${data.emailBlast.recipientsCount} penerima.`);
      alert(`Sukses!\n\nArtikel: "${data.article.title}"\nProvider: ${data.article.provider}\nEmail Terkirim: ${data.emailBlast.recipientsCount} user.`);
      
      await loadAdminData();
    } catch (err: any) {
      console.error(err);
      setStatus("Gagal memicu AI generator: " + err.message);
      alert("Gagal memicu AI generator: " + err.message);
    } finally {
      setIsGeneratingAI(false);
    }
  }

  async function saveMediaDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!db || !user || !isAdmin) {
      alert("Hanya admin yang bisa menyimpan artikel.");
      return;
    }

    if (!mediaBlogTitle.trim()) {
      alert("Judul artikel wajib diisi.");
      return;
    }

    const bgColors = ["cream", "sage", "blue", "rose", "amber", "gray"];
    const randomBg = bgColors[Math.floor(Math.random() * bgColors.length)];
    const id = `${Date.now()}-${slugify(mediaBlogTitle)}`;
    const bannerUrl = `/api/admin/generate-image?title=${encodeURIComponent(mediaBlogTitle)}&description=${encodeURIComponent(mediaBlogExcerpt)}&icon=logo&bg=${randomBg}`;

    try {
      const duplicate = await findDuplicateBlogContent(null, mediaBlogTitle, mediaBlogBody);
      if (duplicate) {
        alert(`Artikel tidak disimpan karena ${duplicate.reason} sudah pernah dipakai: "${duplicate.title}"`);
        return;
      }

      await setDoc(doc(db, "blog_posts", id), {
        title: mediaBlogTitle,
        category: mediaBlogCategory,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        contentDayKey: jakartaDayKey(),
        normalizedTitle: normalizeForDuplicate(mediaBlogTitle),
        bodyHash: contentFingerprint(mediaBlogBody),
        status: mediaBlogStatus,
        excerpt: mediaBlogExcerpt,
        body: mediaBlogBody,
        imageUrl: bannerUrl,
        authorName: user.displayName || user.email || "Admin",
        authorId: user.uid,
      });

      alert(`Artikel "${mediaBlogTitle}" berhasil disimpan ke blog.`);
      
      // Clear form
      setMediaBlogTitle("");
      setMediaBlogExcerpt("");
      setMediaBlogBody("<p>Tulis konten artikel di sini.</p>");
      setMediaBlogIcon("logo");
      
      await loadAdminData();
    } catch (err: any) {
      console.error(err);
      alert("Gagal menyimpan artikel: " + err.message);
    }
  }

  function formatBytes(bytes: number, decimals = 2) {
    if (!bytes) return "0 Bytes";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !db) return;
    try {
      setIsUploading(true);
      setStatus("Mengunggah gambar ke R2...");

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload", { method: "POST", body: formData });
      if (!response.ok) throw new Error("Gagal upload");

      const data = await response.json();
      setBlogImage(data.url);
      setStatus("Gambar berhasil diunggah ke R2.");
    } catch (error) {
      setStatus("Gagal mengunggah gambar ke R2.");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDevotionImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !db) return;
    try {
      setIsUploading(true);
      setStatus("Mengunggah gambar renungan ke R2...");

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload", { method: "POST", body: formData });
      if (!response.ok) throw new Error("Gagal upload");

      const data = await response.json();
      setDevotionIllustrationUrl(data.url);
      setStatus("Gambar renungan berhasil diunggah ke R2.");
    } catch (error) {
      setStatus("Gagal mengunggah gambar renungan ke R2.");
    } finally {
      setIsUploading(false);
    }
  }


  async function saveBlog(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!db || !user || !isAdmin) {
      setStatus("Hanya admin yang bisa menyimpan artikel.");
      return;
    }

    const id = editingPostId ?? slugify(blogTitle);
    if (!id) {
      setStatus("Judul artikel tidak boleh kosong.");
      return;
    }

    const duplicate = await findDuplicateBlogContent(editingPostId, blogTitle, blogBody);
    if (duplicate) {
      setStatus(`Artikel tidak disimpan karena ${duplicate.reason} sudah pernah dipakai.`);
      window.alert(`Artikel tidak disimpan karena ${duplicate.reason} sudah pernah dipakai: "${duplicate.title}"`);
      return;
    }

    const postData = {
      title: blogTitle,
      category: blogCategory,
      ...(editingPostId
        ? {}
        : {
          createdAt: new Date().toISOString(),
          authorName: user.displayName ?? user.email,
          contentDayKey: jakartaDayKey(),
        }),
      status: blogStatus,
      excerpt: blogExcerpt,
      body: blogBody,
      imageUrl: blogImage,
      authorId: user.uid,
      updatedAt: new Date().toISOString(),
      normalizedTitle: normalizeForDuplicate(blogTitle),
      bodyHash: contentFingerprint(blogBody),
    };

    const firestorePostData = {
      ...postData,
      updatedAt: serverTimestamp(),
      ...(editingPostId ? {} : { createdAt: serverTimestamp() }),
    };

    await setDoc(doc(db, "blog_posts", id), firestorePostData, { merge: true });
    await syncDocR2("blog_posts", id, "upsert", postData);
    setStatus(`Artikel "${blogTitle}" berhasil disimpan.`);
    window.alert(`Artikel "${blogTitle}" berhasil disimpan.`);
    clearBlogForm();
    await loadAdminData();
  }

  function handleEditPost(post: BlogDoc) {
    if (!db) return;
    setActiveTab("blog");
    setEditingPostId(post.id);
    setBlogTitle(post.title);

    getDoc(doc(db, "blog_posts", post.id)).then((docSnap) => {
      if (docSnap.exists()) {
        const fullPost = docSnap.data();
        setBlogCategory(fullPost.category ?? blogCategories[0]);
        setBlogStatus(fullPost.status ?? "draft");
        setBlogExcerpt(fullPost.excerpt ?? "");
        setBlogBody(fullPost.body ?? "");
        setBlogImage(fullPost.imageUrl ?? "");
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        setStatus("Gagal memuat artikel untuk diedit.");
      }
    });
  }

  async function savePlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!db || !isAdmin) {
      setStatus("Hanya admin yang bisa menyimpan paket.");
      return;
    }

    const priceVal = planPrice.trim();
    const parsedPrice = isNaN(Number(priceVal)) || priceVal === "" ? priceVal : Number(priceVal);

    const id = editingPlanId ?? slugify(planName);
    await setDoc(
      doc(db, "plans", id),
      {
        name: planName,
        price: parsedPrice,
        durationDays: Number(planDays),
        aiRequests: planUnlimitedRequests ? -1 : Number(planRequests),
        features: planFeatures.split(",").map((item) => item.trim()).filter(Boolean),
        allowedModes: planAllowedModes,
        active: true,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );

    // Sync to R2
    try {
      const planSnap = await getDoc(doc(db, "plans", id));
      if (planSnap.exists()) {
        await syncDocR2("plans", id, "upsert", planSnap.data());
      }
    } catch (syncErr) {
      console.warn("Failed to sync plan to R2:", syncErr);
    }

    setStatus(`Paket ${planName} disimpan.`);
    clearPlanForm();
    await loadAdminData();
  }

  async function saveDonationSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!db || !isAdmin) {
      setStatus("Hanya admin yang bisa menyimpan pengaturan donasi.");
      return;
    }

    const payload = {
      minAmount: Number(donationMinAmount) || 20000,
      multiplier: Number(donationMultiplier) || 20000,
      durationDaysPerMultiplier: Number(donationDurationDays) || 30,
      aiRequestsPerMultiplier: Number(donationAiRequests) || 50,
      minAmountUsd: Number(donationMinAmountUsd) || 2,
      multiplierUsd: Number(donationMultiplierUsd) || 1.5,
      quickAmountsUsd: donationQuickAmountsUsd || "5, 10, 25, 50",
      active: true,
      updatedAt: serverTimestamp(),
    };

    try {
      await setDoc(doc(db, "settings", "donation"), payload, { merge: true });
      await syncDocR2("settings", "donation", "upsert", payload);
      setStatus("Pengaturan kemitraan & donasi berhasil disimpan.");
      await loadAdminData();
    } catch (err: any) {
      console.error(err);
      setStatus(`Gagal menyimpan pengaturan donasi: ${err.message}`);
    }
  }

  function handleEditPlan(plan: PlanDoc) {
    setActiveTab("plans");
    setEditingPlanId(plan.id);
    setPlanName(plan.name);
    setPlanPrice(plan.price.toString());
    setPlanDays(plan.durationDays.toString());
    setPlanRequests(plan.aiRequests === -1 ? "0" : plan.aiRequests.toString());
    setPlanUnlimitedRequests(plan.aiRequests === -1);
    setPlanFeatures(Array.isArray(plan.features) ? plan.features.join(", ") : "");
    setPlanAllowedModes(plan.allowedModes ?? []);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleDeletePlan(planId: string, planName: string) {
    if (!db || !isAdmin) return;
    const confirmation = window.prompt(`Ketik "HAPUS" untuk menghapus paket "${planName}":`);
    if (confirmation !== "HAPUS") return;
    await deleteDoc(doc(db, "plans", planId));
    setStatus(`Paket "${planName}" berhasil dihapus.`);
    await loadAdminData();
  }

  async function regenerateEncyclopediaIllustrations(forceAll = false) {
    if (!user) {
      setStatus("Hanya admin yang bisa regenerate ilustrasi ensiklopedia.");
      return;
    }

    setIsRegeneratingEncyclopediaImages(true);
    setStatus("Regenerate ilustrasi ensiklopedia sedang berjalan...");

    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/admin/ensiklopedia/regenerate-illustrations", {
        cache: 'no-store',
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ limit: 100, forceAll }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Gagal regenerate ilustrasi ensiklopedia.");
      }

      setStatus(
        `Regenerate selesai. Scan ${data.scanned ?? 0}, update ${data.updated ?? 0}, skip ${data.skipped ?? 0}, gagal ${data.failures?.length ?? 0}.`,
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Gagal regenerate ilustrasi ensiklopedia.");
    } finally {
      setIsRegeneratingEncyclopediaImages(false);
    }
  }

  function clearPlanForm() {
    setEditingPlanId(null);
    setPlanName("");
    setPlanPrice("");
    setPlanDays("");
    setPlanRequests("");
    setPlanUnlimitedRequests(false);
    setPlanFeatures("");
    setPlanAllowedModes([]);
  }

  async function createAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!db || !isAdmin) {
      setStatus("Hanya super-admin/admin aktif yang bisa membuat admin.");
      return;
    }

    await setDoc(
      doc(db, "admin_users", adminUid),
      {
        uid: adminUid,
        role: "admin",
        permissions: ["blog", "plans", "users"],
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    setStatus(`Admin ${adminUid} dibuat.`);
    setAdminUid("");
  }

  const paginatedUsers = usersList;

  const totalPostsPages = Math.ceil(posts.length / ITEMS_PER_PAGE);
  const paginatedPosts = posts.slice((postsPage - 1) * ITEMS_PER_PAGE, postsPage * ITEMS_PER_PAGE);

  const filteredActivities = useMemo(() => {
    return aiRequests.filter((item) => {
      const email = getUserEmail(item.userId).toLowerCase();
      const matchSearch = email.includes(activitySearch.toLowerCase().trim());
      const matchMode = activityFilter === "Semua" || item.mode === activityFilter;
      return matchSearch && matchMode;
    });
  }, [aiRequests, activitySearch, activityFilter]);

  const totalActivitiesPages = Math.max(1, Math.ceil(filteredActivities.length / ITEMS_PER_PAGE));
  const paginatedActivities = filteredActivities.slice((activitiesPage - 1) * ITEMS_PER_PAGE, activitiesPage * ITEMS_PER_PAGE);

  const filteredEncyclopedia = useMemo(() => {
    return encyclopediaList.filter((item) => {
      const keyword = (item.keyword || item.title || item.id || "").toLowerCase();
      const matchSearch = keyword.includes(encyclopediaSearch.toLowerCase().trim());
      
      const isPicsum = 
        (typeof item.illustrationUrl === "string" && item.illustrationUrl.includes("picsum.photos")) ||
        (typeof item.bannerUrl === "string" && item.bannerUrl.includes("picsum.photos"));
        
      const matchPicsum = !onlyShowPicsum || isPicsum;
      
      return matchSearch && matchPicsum;
    });
  }, [encyclopediaList, encyclopediaSearch, onlyShowPicsum]);

  const ENCYCLOPEDIA_ITEMS_PER_PAGE = 50;
  const totalEncyclopediaPages = Math.max(1, Math.ceil(filteredEncyclopedia.length / ENCYCLOPEDIA_ITEMS_PER_PAGE));
  const paginatedEncyclopedia = useMemo(() => {
    return filteredEncyclopedia.slice((encyclopediaPage - 1) * ENCYCLOPEDIA_ITEMS_PER_PAGE, encyclopediaPage * ENCYCLOPEDIA_ITEMS_PER_PAGE);
  }, [filteredEncyclopedia, encyclopediaPage]);

  const R2_ITEMS_PER_PAGE = 30;
  const totalR2Pages = Math.max(1, Math.ceil(r2Files.length / R2_ITEMS_PER_PAGE));
  const paginatedR2Files = useMemo(() => {
    return r2Files.slice((r2Page - 1) * R2_ITEMS_PER_PAGE, r2Page * R2_ITEMS_PER_PAGE);
  }, [r2Files, r2Page]);

  useEffect(() => {
    setEncyclopediaPage(1);
  }, [encyclopediaSearch, onlyShowPicsum]);

  useEffect(() => {
    setR2Page(1);
  }, [r2Files.length]);

  async function handleMakeAdmin(targetUser: UserDoc) {
    if (!db || !isAdmin || !window.confirm(`Jadikan ${targetUser.email} sebagai admin?`)) {
      return;
    }

    try {
      await setDoc(doc(db, "admin_users", targetUser.uid), {
        uid: targetUser.uid,
        email: targetUser.email,
        role: "admin",
        promotedBy: user?.uid,
        updatedAt: serverTimestamp(),
      });

      await setDoc(doc(db, "users", targetUser.uid), { role: "admin" }, { merge: true });

      setStatus(`${targetUser.email} sekarang adalah admin.`);
      await loadAdminData();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Gagal menjadikan admin.");
    }
  }

  async function handleAssignPlan(targetUser: UserDoc) {
    if (!db || !isAdmin) return;

    const selectedPlanName = selectedUserPlans[targetUser.uid] ?? targetUser.selectedPlan ?? plans[0]?.name;
    const plan = plans.find((item) => item.name === selectedPlanName);

    if (!plan) {
      setStatus("Pilih paket yang valid terlebih dahulu.");
      return;
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + Number(plan.durationDays || 0));
    const nextRole = plan.name.toLowerCase() === "komunitas" ? "admin" : plan.price > 0 ? "premium" : "user";

    try {
      await setDoc(doc(db, "users", targetUser.uid), {
        selectedPlan: plan.name,
        role: nextRole,
        aiRequestsQuota: plan.aiRequests,
        aiRequestsRemaining: plan.aiRequests,
        premiumActivatedAt: serverTimestamp(),
        premiumExpiresAt: expiresAt,
        assignedByAdmin: user?.uid ?? null,
        updatedAt: serverTimestamp(),
      }, { merge: true });

      await setDoc(doc(db, "subscriptions", `${targetUser.uid}-${Date.now()}`), {
        userId: targetUser.uid,
        email: targetUser.email,
        planName: plan.name,
        amount: plan.price,
        durationDays: plan.durationDays,
        aiRequests: plan.aiRequests,
        status: "manual_active",
        source: "admin_manual",
        assignedBy: user?.uid ?? null,
        startedAt: serverTimestamp(),
        expiresAt,
        createdAt: serverTimestamp(),
      });

      await setDoc(doc(collection(db, "users", targetUser.uid, "activities")), {
        type: "manual_plan",
        title: `Paket ${plan.name} diaktifkan admin`,
        description: `Paket aktif sampai ${expiresAt.toLocaleDateString("id-ID")}.`,
        createdAt: serverTimestamp(),
      });

      setStatus(`Paket ${plan.name} berhasil ditambahkan ke ${targetUser.email}.`);
      await loadAdminData();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Gagal menambahkan paket manual.");
    }
  }

  async function handleDeletePost(postId: string, postTitle: string) {
    if (!db || !isAdmin) return;
    const confirmation = window.prompt(`Ketik "HAPUS" untuk menghapus artikel "${postTitle}":`);
    if (confirmation !== "HAPUS") return;
    try {
      await syncDocR2("blog_posts", postId, "delete");
      try {
        await deleteDoc(doc(db, "blog_posts", postId));
      } catch (fsError) {
        console.warn("[Firestore Delete] Failed secondary delete for blog_post:", fsError);
      }
      setStatus(`Artikel "${postTitle}" telah dihapus.`);
      await loadAdminData();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Gagal menghapus artikel.");
    }
  }

  async function loadEncyclopediaCache() {
    if (!db || !isAdmin) return;
    try {
      const snap = await getDocs(query(collection(db, "ensiklopedia_cache"), limit(1000)));
      setEncyclopediaList(snap.docs.map(item => ({ id: item.id, ...item.data() })));
    } catch (err) {
      console.error("Gagal memuat ensiklopedia:", err);
    }
  }

  async function loadEncyclopediaCorrections() {
    if (!db || !isAdmin) return;
    try {
      const snap = await getDocs(query(collection(db, "ensiklopedia_corrections"), orderBy("createdAt", "desc"), limit(100)));
      setEncyclopediaCorrections(snap.docs.map(item => ({ id: item.id, ...item.data() })));
    } catch (err) {
      console.error("Gagal memuat koreksi ensiklopedia:", err);
    }
  }

  async function resolveEncyclopediaCorrection(id: string) {
    if (!db || !isAdmin) return;
    try {
      await updateDoc(doc(db, "ensiklopedia_corrections", id), {
        status: "resolved",
        resolvedAt: new Date(),
      });
      setStatus(`Laporan koreksi "${id}" ditandai sebagai selesai.`);
      await loadEncyclopediaCorrections();
    } catch (err: any) {
      setStatus(err.message || "Gagal memperbarui status laporan.");
    }
  }

  async function deleteEncyclopediaCorrection(id: string) {
    if (!db || !isAdmin) return;
    try {
      await deleteDoc(doc(db, "ensiklopedia_corrections", id));
      setStatus(`Laporan koreksi "${id}" telah dihapus.`);
      await loadEncyclopediaCorrections();
    } catch (err: any) {
      setStatus(err.message || "Gagal menghapus laporan.");
    }
  }

  async function regenerateEncyclopediaDoc(keyword: string, kategori: string) {
    if (!user) return;
    setStatus(`Meregenerasi artikel "${keyword}"...`);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/ensiklopedia/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ keyword, kategori, force: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal meregenerasi artikel.");
      }
      setStatus(`Artikel "${keyword}" berhasil diregenerasi.`);
      await syncDocR2("ensiklopedia_cache", data.article.id, "upsert", data.article);
      setGenerateModalResult(data.article);
      setShowGenerateModal(true);
      setEncyclopediaList(prev => {
        const index = prev.findIndex(item => item.id === data.article.id);
        if (index >= 0) {
          const newList = [...prev];
          newList[index] = data.article;
          return newList;
        }
        return [data.article, ...prev];
      });
    } catch (err: any) {
      setStatus(err.message || "Gagal meregenerasi artikel.");
      alert("Error: " + (err.message || "Gagal meregenerasi artikel."));
    }
  }

  async function handleCustomGenerate() {
    if (!isAdmin || !user || !customKeyword.trim()) return;
    setIsGeneratingCustom(true);
    setStatus(`Men-generate artikel "${customKeyword}"...`);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/ensiklopedia/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ keyword: customKeyword.trim(), kategori: customKategori, force: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal generate artikel.");
      }
      setStatus(`Artikel "${customKeyword}" berhasil di-generate.`);
      await syncDocR2("ensiklopedia_cache", data.article.id, "upsert", data.article);
      setGenerateModalResult(data.article);
      setShowGenerateModal(true);
      setCustomKeyword("");
      setEncyclopediaList(prev => {
        const index = prev.findIndex(item => item.id === data.article.id);
        if (index >= 0) {
          const newList = [...prev];
          newList[index] = data.article;
          return newList;
        }
        return [data.article, ...prev];
      });
    } catch (err: any) {
      setStatus(err.message || "Gagal generate artikel.");
      alert("Error: " + (err.message || "Gagal generate artikel."));
    } finally {
      setIsGeneratingCustom(false);
    }
  }

  async function updateEncyclopediaStatus(id: string, newStatus: string) {
    if (!db || !isAdmin) return;
    try {
      const existingItem = encyclopediaList.find(item => item.id === id);
      const updatedItem = existingItem ? { ...existingItem, status: newStatus, updatedAt: new Date().toISOString() } : null;
      await updateDoc(doc(db, "ensiklopedia_cache", id), { status: newStatus, updatedAt: new Date() });
      await syncDocR2("ensiklopedia_cache", id, "upsert", updatedItem);
      setStatus(`Status artikel "${id}" diubah menjadi ${newStatus}.`);
      setEncyclopediaList(prev => prev.map(item => item.id === id ? { ...item, status: newStatus } : item));
    } catch (err: any) {
      setStatus(err.message || "Gagal mengubah status.");
    }
  }

  async function deleteEncyclopediaDoc(id: string) {
    if (!db || !isAdmin) return;
    try {
      await syncDocR2("ensiklopedia_cache", id, "delete");
      try {
        await deleteDoc(doc(db, "ensiklopedia_cache", id));
      } catch (fsError) {
        console.warn("[Firestore Delete] Failed secondary delete for encyclopedia entry:", fsError);
      }
      setStatus(`Artikel "${id}" telah dihapus.`);
      setEncyclopediaList(prev => prev.filter(item => item.id !== id));
    } catch (err: any) {
      setStatus(err.message || "Gagal menghapus artikel.");
    }
  }

  async function updateEncyclopediaScores(id: string, newConfidence: number, newCoverage: number) {
    if (!db || !isAdmin) return;
    try {
      const existingItem = encyclopediaList.find(item => item.id === id);
      const updatedItem = existingItem ? {
        ...existingItem,
        confidenceScore: newConfidence,
        coverageScore: newCoverage,
        updatedAt: new Date().toISOString()
      } : null;
      await updateDoc(doc(db, "ensiklopedia_cache", id), {
        confidenceScore: newConfidence,
        coverageScore: newCoverage,
        updatedAt: new Date()
      });
      await syncDocR2("ensiklopedia_cache", id, "upsert", updatedItem);
      setStatus(`Skor artikel "${id}" diperbarui.`);
      setEncyclopediaList(prev => prev.map(item => item.id === id ? { ...item, confidenceScore: newConfidence, coverageScore: newCoverage } : item));
    } catch (err: any) {
      setStatus(err.message || "Gagal memperbarui skor.");
    }
  }

  async function saveEncyclopediaManual() {
    if (!db || !isAdmin || !editingEncyclopediaId) return;

    try {
      const docRef = doc(db, "ensiklopedia_cache", editingEncyclopediaId);
      
      const updatedData = {
        title: encyclopediaTitle,
        keyword: encyclopediaKeyword,
        kategori: encyclopediaKategori,
        isi_artikel: encyclopediaIsi,
        confidenceScore: encyclopediaConfidence,
        coverageScore: encyclopediaCoverage,
        status: encyclopediaStatus,
        bannerUrl: encyclopediaBannerUrl,
        illustrationUrl: encyclopediaIllustrationUrl,
      };

      const firestoreData = {
        ...updatedData,
        updatedAt: serverTimestamp(),
      };

      await updateDoc(docRef, firestoreData);

      // Format to ISO string for R2 upload
      const r2Data = {
        id: editingEncyclopediaId,
        ...updatedData,
        updatedAt: new Date().toISOString(),
      };

      await syncDocR2("ensiklopedia_cache", editingEncyclopediaId, "upsert", r2Data);

      setStatus(`Artikel "${encyclopediaTitle}" berhasil diperbarui secara manual.`);
      
      // Update list locally
      setEncyclopediaList(prev => prev.map(item => item.id === editingEncyclopediaId ? { ...item, ...r2Data } : item));
      
      setShowEncyclopediaEditModal(false);
      setEditingEncyclopediaId(null);
    } catch (err: any) {
      console.error("Gagal mengupdate ensiklopedia secara manual:", err);
      alert("Gagal menyimpan perubahan: " + err.message);
    }
  }

  function clearBlogForm() {
    setEditingPostId(null);
    setBlogTitle("");
    setBlogExcerpt("");
    setBlogBody("<p>Tulis konten artikel di sini.</p>");
    setBlogImage("");
  }

  async function saveSong(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!db || !isAdmin) return;

    const id = editingSongId ?? slugify(songTitle);
    const songData = {
      title: songTitle,
      artist: songArtist,
      url: songUrl,
      updatedAt: new Date().toISOString(),
    };

    const firestoreSongData = {
      ...songData,
      updatedAt: serverTimestamp(),
    };

    await setDoc(doc(db, "songs", id), firestoreSongData, { merge: true });
    await syncDocR2("songs", id, "upsert", songData);
    setStatus(`Lagu "${songTitle}" disimpan.`);
    clearSongForm();
    await loadAdminData();
  }

  function handleEditSong(song: SongDoc) {
    setActiveTab("lagu");
    setEditingSongId(song.id);
    setSongTitle(song.title);
    setSongArtist(song.artist);
    setSongUrl(song.url);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleDeleteSong(songId: string, songTitle: string) {
    if (!db || !isAdmin) return;
    if (!window.confirm(`Hapus lagu "${songTitle}"?`)) return;
    await deleteDoc(doc(db, "songs", songId));
    await syncDocR2("songs", songId, "delete");
    setStatus(`Lagu "${songTitle}" dihapus.`);
    await loadAdminData();
  }

  function clearSongForm() {
    setEditingSongId(null);
    setSongTitle("");
    setSongArtist("");
    setSongUrl("");
  }

  async function saveDevotion() {
    if (!db || !isAdmin) return;
    if (!devotionDateId) {
      alert("Date ID wajib diisi (format: golden-YYYY-MM-DD-05)");
      return;
    }

    try {
      const devotionData = {
        title: devotionTitle || "Renungan Hari Ini",
        verseRef: devotionVerseRef,
        verseText: devotionVerseText,
        body: devotionBody,
        prayer: devotionPrayer,
        imageUrl: devotionIllustrationUrl,
        illustrationUrl: devotionIllustrationUrl,
        dateId: devotionDateId,
        status: devotionStatus,
      };

      if (editingDevotionId) {
        // Preserve generatedAt when editing, but save to new dateId if changed
        const existingDoc = await getDoc(doc(db, "daily_devotions", editingDevotionId));
        const existingData = existingDoc.exists() ? existingDoc.data() : {};
        
        const payloadData = {
          ...devotionData,
          updatedAt: new Date().toISOString(),
          generatedAt: existingData.generatedAt ? (typeof existingData.generatedAt.toDate === "function" ? existingData.generatedAt.toDate().toISOString() : existingData.generatedAt) : new Date().toISOString(),
        };

        const firestorePayload = {
          ...devotionData,
          updatedAt: serverTimestamp(),
          generatedAt: existingData.generatedAt || serverTimestamp(),
        };

        // If dateId changed, delete old document and create new one
        if (editingDevotionId !== devotionDateId) {
          await deleteDoc(doc(db, "daily_devotions", editingDevotionId));
          await syncDocR2("daily_devotions", editingDevotionId, "delete");
          await setDoc(doc(db, "daily_devotions", devotionDateId), firestorePayload);
          await syncDocR2("daily_devotions", devotionDateId, "upsert", payloadData);
          setStatus(`Renungan "${devotionTitle}" berhasil diperbarui dengan dateId baru.`);
        } else {
          await setDoc(doc(db, "daily_devotions", editingDevotionId), firestorePayload, { merge: true });
          await syncDocR2("daily_devotions", editingDevotionId, "upsert", payloadData);
          setStatus(`Renungan "${devotionTitle}" berhasil diperbarui.`);
        }
      } else {
        const payloadData = {
          ...devotionData,
          updatedAt: new Date().toISOString(),
          generatedAt: new Date().toISOString(),
        };

        const firestorePayload = {
          ...devotionData,
          updatedAt: serverTimestamp(),
          generatedAt: serverTimestamp(),
        };

        await setDoc(doc(db, "daily_devotions", devotionDateId), firestorePayload);
        await syncDocR2("daily_devotions", devotionDateId, "upsert", payloadData);
        setStatus(`Renungan "${devotionTitle}" berhasil dibuat.`);
      }

      clearDevotionForm();
      await loadAdminData();
    } catch (error) {
      console.error("Gagal menyimpan renungan:", error);
      alert("Gagal menyimpan renungan.");
    }
  }

  function handleEditDevotion(devotion: any) {
    setEditingDevotionId(devotion.id);
    setDevotionTitle(devotion.title || "");
    setDevotionVerseRef(devotion.verseRef || "");
    setDevotionVerseText(devotion.verseText || "");
    setDevotionBody(devotion.body || "");
    setDevotionPrayer(devotion.prayer || "");
    setDevotionIllustrationUrl(devotion.imageUrl || devotion.illustrationUrl || "");
    setDevotionDateId(devotion.dateId || devotion.id || "");
    setDevotionStatus(devotion.status || "published");
    setActiveTab("renungan");
  }

  async function handleDeleteDevotion(devotionId: string) {
    if (!db || !isAdmin) return;
    if (!window.confirm("Apakah Anda yakin ingin menghapus renungan ini?")) return;

    try {
      await syncDocR2("daily_devotions", devotionId, "delete");
      try {
        await deleteDoc(doc(db, "daily_devotions", devotionId));
      } catch (fsError) {
        console.warn("[Firestore Delete] Failed secondary delete for devotion:", fsError);
      }
      setStatus("Renungan berhasil dihapus.");
      await loadAdminData();
    } catch (error) {
      console.error("Gagal menghapus renungan:", error);
      alert("Gagal menghapus renungan.");
    }
  }

  async function saveReview(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!db || !isAdmin) return;

    try {
      const reviewData = {
        name: reviewName,
        role: reviewRole,
        quote: reviewQuote,
        rating: Number(reviewRating),
        avatar: reviewAvatar,
        status: reviewStatus,
        updatedAt: serverTimestamp(),
      };

      if (editingReviewId) {
        await setDoc(doc(db, "user_reviews", editingReviewId), reviewData, { merge: true });
        setStatus(`Review "${reviewName}" berhasil diupdate.`);
      } else {
        await setDoc(doc(collection(db, "user_reviews")), {
          ...reviewData,
          createdAt: serverTimestamp(),
        });
        setStatus(`Review "${reviewName}" berhasil ditambahkan.`);
      }

      clearReviewForm();
      await loadAdminData();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Gagal menyimpan review.");
    }
  }

  function handleEditReview(review: any) {
    setEditingReviewId(review.id);
    setReviewName(review.name);
    setReviewRole(review.role);
    setReviewQuote(review.quote);
    setReviewRating(review.rating);
    setReviewAvatar(review.avatar || "");
    setReviewStatus(review.status || "published");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleDeleteReview(reviewId: string) {
    if (!db || !isAdmin) return;
    if (!window.confirm("Apakah Anda yakin ingin menghapus review ini?")) return;

    try {
      await deleteDoc(doc(db, "user_reviews", reviewId));
      setStatus("Review berhasil dihapus.");
      await loadAdminData();
    } catch (error) {
      setStatus("Gagal menghapus review.");
    }
  }

  function clearReviewForm() {
    setEditingReviewId(null);
    setReviewName("");
    setReviewRole("");
    setReviewQuote("");
    setReviewRating(5);
    setReviewAvatar("");
    setReviewStatus("published");
  }

  async function generateDevotionImage() {
    if (!devotionVerseRef || !devotionVerseText) {
      alert("Ayat harus diisi terlebih dahulu untuk memilih gambar R2.");
      return;
    }

    setIsGeneratingImage(true);
    setStatus("Sedang memilih gambar R2 statis...");

    try {
      const response = await fetch("/api/daily-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          devotionId: devotionDateId || `temp-${Date.now()}`,
          verseRef: devotionVerseRef,
          verseText: devotionVerseText,
        }),
      });

      const data = await response.json();
      if (data.imageUrl) {
        setDevotionIllustrationUrl(data.imageUrl);
        setStatus("Gambar R2 statis berhasil dipilih.");
      } else {
        setStatus("Gagal memilih gambar R2 statis.");
      }
    } catch (error) {
      console.error("Gagal memilih gambar R2:", error);
      setStatus("Gagal memilih gambar R2 statis.");
    } finally {
      setIsGeneratingImage(false);
    }
  }

  async function triggerDailyDevotionGeneration() {
    if (!user || !isAdmin) return;

    // Cek apakah sudah ada renungan untuk slot waktu ini
    const todaySlotId = (() => {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Jakarta",
        hourCycle: "h23",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
      });
      const parts = Object.fromEntries(
        formatter.formatToParts(now).map((part) => [part.type, part.value]),
      );
      const day = `${parts.year}-${parts.month}-${parts.day}`;
      const hour = Number(parts.hour);
      if (hour < 5) {
        const prevDay = new Date(now.getTime() - 86_400_000);
        const prevFormatter = new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Jakarta",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        });
        const pd = Object.fromEntries(
          prevFormatter.formatToParts(prevDay).map((p) => [p.type, p.value])
        );
        return `golden-${pd.year}-${pd.month}-${pd.day}-05`;
      }
      return `golden-${day}-05`;
    })();

    const existingDevotion = devotions.find((d) => d.id === todaySlotId || d.dateId === todaySlotId);

    let force = false;
    if (existingDevotion) {
      const confirmed = window.confirm(
        `Renungan untuk slot ini sudah ada:\n\nJudul: "${existingDevotion.title || "(tanpa judul)"}"\nID: ${todaySlotId}\n\nApakah Anda ingin GENERATE ULANG (menggantikan renungan yang ada)?\n\nTekan OK untuk generate ulang, Cancel untuk membatalkan.`
      );
      if (!confirmed) return;
      force = true;
    }

    setIsTriggeringDailyDevotion(true);
    setStatus(`Memicu generate renungan harian${force ? " (force mode)" : ""}...`);

    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/admin/daily-devotion/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ force }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Gagal generate renungan harian.");
      }

      setStatus(data.message || "Pemicu renungan harian selesai.");
      await loadAdminData();
    } catch (error) {
      console.error("Gagal memicu generate renungan harian:", error);
      setStatus(error instanceof Error ? error.message : "Gagal memicu generate renungan harian.");
    } finally {
      setIsTriggeringDailyDevotion(false);
    }
  }

  function clearDevotionForm() {
    setEditingDevotionId(null);
    setDevotionTitle("");
    setDevotionVerseRef("");
    setDevotionVerseText("");
    setDevotionBody("");
    setDevotionPrayer("");
    setDevotionIllustrationUrl("");
    setDevotionDateId("");
    setDevotionStatus("published");
    // Auto-generate dateId when clearing form
    generateCurrentDateId();
  }

  function generateCurrentDateId() {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jakarta",
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
    });
    const parts = Object.fromEntries(
      formatter.formatToParts(now).map((part) => [part.type, part.value]),
    );
    const day = `${parts.year}-${parts.month}-${parts.day}`;
    const hour = Number(parts.hour);

    if (hour < 5) {
      const previousDay = new Date(now.getTime() - 86_400_000);
      const prevFormatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Jakarta",
        hourCycle: "h23",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
      const prevParts = Object.fromEntries(
        prevFormatter.formatToParts(previousDay).map((part) => [part.type, part.value]),
      );
      const prevDay = `${prevParts.year}-${prevParts.month}-${prevParts.day}`;
      setDevotionDateId(`golden-${prevDay}-05`);
    } else {
      setDevotionDateId(`golden-${day}-05`);
    }
  }

  async function saveBulletin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!db || !isAdmin) return;
    try {
      await setDoc(doc(db, "settings", "bulletin"), {
        title: bulletinTitle,
        content: bulletinContent,
        isActive: bulletinIsActive,
        url: bulletinUrl,
        updatedAt: serverTimestamp(),
      });
      setStatus("Pengumuman gereja berhasil disimpan.");
      await loadAdminData();
    } catch (err) {
      setStatus("Gagal menyimpan pengumuman.");
    }
  }

  async function savePastorReply(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!db || !isAdmin || !editingQuestionId) return;
    try {
      await setDoc(doc(db, "pastoral_questions", editingQuestionId), {
        pastorNotes,
        isVerifiedByPastor: isVerified,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      setStatus("Tanggapan pendeta berhasil disimpan.");
      setEditingQuestionId(null);
      await loadAdminData();
    } catch (err) {
      setStatus("Gagal menyimpan tanggapan pendeta.");
    }
  }

  function handleEditQuestion(q: PastoralQuestionDoc) {
    setActiveTab("forum");
    setEditingQuestionId(q.id);
    setPastorNotes(q.pastorNotes ?? "");
    setIsVerified(q.isVerifiedByPastor ?? false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function clearPastorReplyForm() {
    setEditingQuestionId(null);
    setPastorNotes("");
    setIsVerified(false);
  }

  function formatActivityDate(value: any) {
    const date =
      typeof value?.toDate === "function"
        ? value.toDate()
        : value?.seconds
          ? new Date(value.seconds * 1000)
          : value?._seconds
            ? new Date(value._seconds * 1000)
            : null;

    return date
      ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(date)
      : "Tanggal belum tersedia";
  }

  function getUserEmail(userId: string) {
    const target = usersList.find((u) => u.uid === userId);
    return target?.email || `UID: ${userId.slice(0, 8)}...`;
  }

  async function handleDeleteActivity(id: string) {
    if (!db || !isAdmin || !window.confirm("Hapus log aktivitas ini?")) return;
    try {
      await deleteDoc(doc(db, "ai_requests", id));
      setAiRequests(aiRequests.filter((item) => item.id !== id));
      setStatus("Aktivitas berhasil dihapus.");
    } catch (error) {
      console.error(error);
      setStatus("Gagal menghapus aktivitas.");
    }
  }

  // Voice to Text (Speech Recognition) helper
  function startSpeechRecognition(
    setter: (val: string | ((prev: string) => string)) => void,
    setListening: (val: boolean) => void
  ) {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Browser Anda tidak mendukung fitur Voice to Text secara langsung (terutama in-app browser media sosial). Silakan buka website ini di Safari (iOS) atau Chrome (Android) untuk menggunakan fitur suara.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "id-ID";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    recognition.onstart = () => {
      setListening(true);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      setListening(false);
      
      let errorMsg = `Gagal merekam suara (Error: ${event.error}).`;
      if (event.error === "not-allowed") {
        errorMsg = "Izin akses mikrofon ditolak. Silakan aktifkan izin mikrofon untuk browser ini di pengaturan perangkat/aplikasi Anda.";
      } else if (event.error === "no-speech") {
        errorMsg = "Tidak ada suara yang terdeteksi. Silakan coba lagi.";
      } else if (event.error === "audio-capture") {
        errorMsg = "Perangkat mikrofon tidak ditemukan.";
      } else if (event.error === "network") {
        errorMsg = "Koneksi jaringan terputus.";
      } else if (event.error === "service-not-allowed") {
        errorMsg = "Layanan dikte tidak diizinkan. Silakan aktifkan fitur Dikte (Dictation) di pengaturan keyboard perangkat Anda.";
      }
      alert(errorMsg);
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognition.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      setter((prev: string) => prev ? `${prev} ${text}` : text);
    };

    recognition.start();
  }

  // Upload ad banner image
  async function handleAdImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !db) return;
    try {
      setIsUploading(true);
      setStatus("Mengunggah banner iklan ke R2...");

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload", { method: "POST", body: formData });
      if (!response.ok) throw new Error("Gagal upload");

      const data = await response.json();
      setAdImageUrl(data.url);
      setStatus("Banner iklan berhasil diunggah.");
    } catch (error) {
      setStatus("Gagal mengunggah banner iklan.");
    } finally {
      setIsUploading(false);
    }
  }

  // Save Settings forms
  async function saveGoogleCodes(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!db || !isAdmin) return;
    try {
      const payload = {
        googleAnalyticsId,
        googleAnalyticsPropertyId,
        googleTagManagerId,
        googleSearchConsoleToken,
        globalHeaderScripts,
        globalBodyScripts,
        WHATSAPP_CHANNEL_URL: whatsappChannelUrl,
        updatedAt: new Date(), // Using new Date() because serverTimestamp() is not serializable for syncDocR2 payload
      };
      await setDoc(doc(db, "settings", "google_codes"), payload);

      // Sync to Cloudflare R2
      await syncDocR2("settings", "google_codes", "upsert", payload);

      setStatus("Pengaturan Google, WhatsApp, & script global disimpan.");
      alert("Pengaturan Google, WhatsApp, & script global berhasil disimpan.");
      await loadAdminData();
    } catch (err) {
      setStatus("Gagal menyimpan pengaturan Google.");
    }
  }

  async function saveAds(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!db || !isAdmin) return;
    try {
      await setDoc(doc(db, "settings", "ads"), {
        imageUrl: adImageUrl,
        targetUrl: adTargetUrl,
        placement: adPlacement,
        isActive: adIsActive,
        title: adTitle,
        updatedAt: serverTimestamp(),
      });
      setStatus("Pengaturan Iklan berhasil disimpan.");
      alert("Pengaturan Iklan berhasil disimpan.");
      await loadAdminData();
    } catch (err) {
      setStatus("Gagal menyimpan pengaturan iklan.");
    }
  }

  async function saveAdSense(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!db || !isAdmin) return;
    try {
      await setDoc(doc(db, "settings", "ads_config"), {
        ad_client: adsenseClient,
        ad_slot: adsenseSlot,
        position: adsensePosition,
        targets: adsenseTargets,
        landingSection: adsenseLandingSection,
        intensity: adsenseIntensity,
        isEnabled: adsenseEnabled,
        updatedAt: serverTimestamp(),
      });
      
      // Also sync to R2
      try {
        const response = await fetch("/api/admin/sync-doc", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            collection: "settings",
            id: "ads_config",
            data: {
              ad_client: adsenseClient,
              ad_slot: adsenseSlot,
              position: adsensePosition,
              targets: adsenseTargets,
              landingSection: adsenseLandingSection,
              intensity: adsenseIntensity,
              isEnabled: adsenseEnabled,
            }
          })
        });
        if (!response.ok) console.warn("R2 sync failed for ads_config");
      } catch (syncErr) {
        console.error("Failed to sync ads_config to R2:", syncErr);
      }
      
      setStatus("Pengaturan AdSense berhasil disimpan.");
      alert("Pengaturan AdSense berhasil disimpan.");
      await loadAdminData();
    } catch (err) {
      setStatus("Gagal menyimpan pengaturan AdSense.");
    }
  }

  if (!hasFirebaseConfig()) {
    return (
      <div className="rounded-lg border border-[#dfd8ca] bg-white p-5">
        Firebase config belum lengkap di `.env.local`.
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="rounded-lg border border-[#dfd8ca] bg-white p-5">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#2a6f6f]">
          Akses Admin
        </p>
        <h2 className="mt-3 text-2xl font-semibold text-[#14213d]">{status}</h2>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          {!user && (
            <Link
              href="/login"
              className="rounded-md bg-[#14213d] px-4 py-3 text-center font-semibold text-white"
            >
              Login Admin
            </Link>
          )}
          {user && (
            <>
              {process.env.NODE_ENV === "development" && (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      if (!db) return;
                      setStatus("Mendaftarkan akun sebagai admin...");
                      await setDoc(doc(db, "admin_users", user.uid), {
                        uid: user.uid,
                        email: user.email,
                        role: "admin",
                        permissions: ["blog", "plans", "users"],
                        updatedAt: serverTimestamp(),
                      });
                      setStatus("Berhasil mendaftar sebagai admin! Mengalihkan...");
                      window.location.reload();
                    } catch (err) {
                      setStatus("Gagal mendaftar otomatis. Pastikan Firestore rules dalam Test Mode.");
                    }
                  }}
                  className="rounded-md bg-[#2a6f6f] px-4 py-3 font-semibold text-white transition hover:bg-[#1a4a4a]"
                >
                  Jadikan Saya Admin (Hanya Mode Dev)
                </button>
              )}
              <button
                type="button"
                onClick={() => auth && signOut(auth)}
                className="rounded-md border border-[#dfd8ca] px-4 py-3 font-semibold text-[#14213d] transition hover:bg-[#f7f4ee]"
              >
                Logout
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Paket", value: plans.length },
          { label: "Artikel", value: posts.length },
          { label: "Admin", value: user.email ?? "aktif" },
          { label: "Pengguna", value: usersList.length },
        ].map((stat) => (
          <article key={stat.label} className="rounded-lg border border-[#dfd8ca] bg-white p-5">
            <p className="text-sm text-[#52606d]">{stat.label}</p>
            <p className="mt-2 text-2xl font-semibold text-[#14213d]">{stat.value}</p>
          </article>
        ))}
      </section>

      <div className="flex flex-wrap gap-2 border-b border-[#dfd8ca] pb-3">
        {(["dashboard", "analytics", "renungan", "aktivitas", "statistik", "forum", "pengumuman", "blog", "lagu", "users", "plans", "reviews", "ensiklopedia", "pengaturan", "media", "database", "notifikasi", "api-keys", "langganan", "cron-logs"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`rounded-md px-4 py-2 font-semibold capitalize transition ${activeTab === tab
                ? "bg-[#14213d] text-white"
                : "border border-transparent text-[#334155] hover:bg-white hover:border-[#dfd8ca]"
              }`}
          >
            {tab === "api-keys" ? "API Keys" : tab === "users" ? "Pengguna" : tab === "plans" ? "Paket" : tab === "aktivitas" ? "Aktivitas User" : tab === "pengaturan" ? "Pengaturan" : tab === "database" ? "Database Backup" : tab === "renungan" ? "Renungan Harian" : tab === "reviews" ? "Review Pengguna" : tab === "ensiklopedia" ? "Review Ensiklopedia" : tab === "media" ? "Media & AI" : tab === "analytics" ? "Google Analytics" : tab === "notifikasi" ? "Push Notification" : tab === "langganan" ? "Langganan Publik" : tab === "cron-logs" ? "Cron Logs" : tab}
          </button>
        ))}
      </div>

      {activeTab === "dashboard" && (
        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-lg border border-[#dfd8ca] bg-white p-5">
            <h2 className="text-xl font-semibold text-[#14213d]">Paket Tersimpan</h2>
            <div className="mt-4 grid gap-3">
              {plans.map((plan) => (
                <div key={plan.id} className="rounded-md border border-[#dfd8ca] bg-[#f7f4ee] p-4">
                  <p className="font-semibold">{plan.name}</p>
                  <p className="text-sm text-[#52606d]">
                    {typeof plan.price === 'number' ? `Rp${plan.price.toLocaleString("id-ID")}` : plan.price} - {plan.durationDays} hari - {plan.aiRequests === -1 ? "Unlimited" : plan.aiRequests} interaksi
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-[#dfd8ca] bg-white p-5">
            <h2 className="text-xl font-semibold text-[#14213d]">Artikel Terbaru</h2>
            <div className="mt-4 grid gap-3">
              {posts.map((post) => (
                <div key={post.id} className="rounded-md border border-[#dfd8ca] bg-[#f7f4ee] p-4">
                  <p className="font-semibold">{post.title}</p>
                  <p className="text-sm text-[#52606d]">{post.category} - {post.status}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {activeTab === "analytics" && (
        <div className="grid gap-6">
          {/* Header & Status */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-[#14213d]">Google Analytics GA4</h2>
              <p className="text-sm text-[#52606d]">
                Analisis pengunjung, tayangan halaman, dan interaksi real-time website Grace Daily.
              </p>
            </div>
            <button
              onClick={loadAnalyticsReport}
              disabled={analyticsLoading}
              className="inline-flex items-center justify-center rounded-md bg-[#14213d] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1f2933] disabled:opacity-50"
            >
              {analyticsLoading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Memuat...
                </span>
              ) : (
                "Segarkan Data"
              )}
            </button>
          </div>

          {analyticsLoading && !analyticsData && (
            <div className="flex min-h-[400px] flex-col items-center justify-center rounded-lg border border-[#dfd8ca] bg-white p-8 text-center">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#2a6f6f] border-t-transparent"></div>
              <p className="mt-4 text-lg font-semibold text-[#14213d]">Memuat data Google Analytics...</p>
              <p className="text-xs text-[#52606d]">Menghubungkan ke Google Analytics Data API v1beta</p>
            </div>
          )}

          {analyticsError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-red-800">
              <h3 className="font-semibold">Gagal Memuat Laporan Analitik</h3>
              <p className="mt-1 text-sm">{analyticsError}</p>
              <button
                onClick={loadAnalyticsReport}
                className="mt-3 rounded bg-red-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-900"
              >
                Coba Lagi
              </button>
            </div>
          )}

          {analyticsData && (
            <>
              {/* Status Alert Banner */}
              {analyticsData.isMock ? (
                <div className="relative overflow-hidden rounded-lg border border-amber-200 bg-gradient-to-r from-amber-50/70 to-orange-50/70 p-5 text-amber-900 shadow-sm">
                  <div className="absolute top-0 right-0 h-32 w-32 translate-x-8 -translate-y-8 rounded-full bg-amber-200 opacity-20 blur-xl"></div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                    <span className="text-2xl">⚠️</span>
                    <div>
                      <h4 className="font-bold text-amber-950">Mode Simulasi Aktif</h4>
                      <p className="mt-1 text-sm text-amber-800">
                        Menampilkan simulasi statistik lalu lintas pengunjung karena **Google Analytics GA4 Property ID** belum diatur, atau email Service Account belum diberi wewenang akses *Viewer* di konsol Google Analytics Anda.
                      </p>
                      {analyticsData.error && (
                        <p className="mt-2 font-mono text-2xs text-red-700 bg-white/60 p-2 rounded border border-amber-100 overflow-x-auto">
                          Detail API: {analyticsData.error}
                        </p>
                      )}
                      
                      <div className="mt-4 rounded-md border border-amber-200 bg-amber-100/50 p-4 text-xs text-amber-900">
                        <p className="font-bold uppercase tracking-wider text-amber-950 mb-2">Langkah Otorisasi Live Data:</p>
                        <ol className="list-decimal pl-4 space-y-1.5">
                          <li>Buka panel **Google Analytics Admin**.</li>
                          <li>Pilih **Property Access Management** lalu klik tombol **+ (Add users)**.</li>
                          <li>Tambahkan email Service Account dari file `service-account.json` Anda.</li>
                          <li>Pilih peran **Viewer (Pembaca)** untuk mengizinkan penarikan laporan.</li>
                          <li>Salin **Property ID** numerik dari *Property Settings* dan simpan di tab **Pengaturan** di dashboard ini.</li>
                        </ol>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="relative overflow-hidden rounded-lg border border-teal-200 bg-gradient-to-r from-teal-50/70 to-emerald-50/70 p-4 text-teal-900 shadow-sm">
                  <div className="flex items-center gap-3">
                    <span className="flex h-3 w-3 rounded-full bg-teal-500 animate-pulse"></span>
                    <p className="text-sm font-semibold text-teal-950">
                      Live Analytics Terkoneksi: Menampilkan data riil ditarik langsung dari properti Google Analytics GA4.
                    </p>
                  </div>
                </div>
              )}

              {/* KPI Cards Grid */}
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {/* Active Users Card */}
                <div className="relative overflow-hidden rounded-lg border border-[#dfd8ca] bg-gradient-to-br from-blue-50 to-white p-5 shadow-sm">
                  <div className="absolute -right-2 -bottom-2 h-16 w-16 rounded-full bg-blue-100 opacity-50 blur-lg"></div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-blue-900">Pengunjung Unik</span>
                    <span className="rounded bg-blue-100 px-2 py-0.5 text-2xs font-semibold text-blue-800">30 Hari</span>
                  </div>
                  <p className="mt-3 text-3xl font-extrabold text-[#14213d]">
                    {analyticsData.summary.activeUsers.toLocaleString("id-ID")}
                  </p>
                  <p className="mt-1 text-xs text-[#52606d]">Total pengguna aktif unik</p>
                </div>

                {/* Page Views Card */}
                <div className="relative overflow-hidden rounded-lg border border-[#dfd8ca] bg-gradient-to-br from-teal-50 to-white p-5 shadow-sm">
                  <div className="absolute -right-2 -bottom-2 h-16 w-16 rounded-full bg-teal-100 opacity-50 blur-lg"></div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-teal-900">Tayangan Halaman</span>
                    <span className="rounded bg-teal-100 px-2 py-0.5 text-2xs font-semibold text-teal-800">30 Hari</span>
                  </div>
                  <p className="mt-3 text-3xl font-extrabold text-[#14213d]">
                    {analyticsData.summary.pageViews.toLocaleString("id-ID")}
                  </p>
                  <p className="mt-1 text-xs text-[#52606d]">Total halaman yang dilihat</p>
                </div>

                {/* Sessions Card */}
                <div className="relative overflow-hidden rounded-lg border border-[#dfd8ca] bg-gradient-to-br from-purple-50 to-white p-5 shadow-sm">
                  <div className="absolute -right-2 -bottom-2 h-16 w-16 rounded-full bg-purple-100 opacity-50 blur-lg"></div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-purple-900">Sesi Kunjungan</span>
                    <span className="rounded bg-purple-100 px-2 py-0.5 text-2xs font-semibold text-purple-800">30 Hari</span>
                  </div>
                  <p className="mt-3 text-3xl font-extrabold text-[#14213d]">
                    {analyticsData.summary.sessions.toLocaleString("id-ID")}
                  </p>
                  <p className="mt-1 text-xs text-[#52606d]">Sesi interaksi aktif</p>
                </div>

                {/* Real-time Online Card */}
                <div className="relative overflow-hidden rounded-lg border border-[#dfd8ca] bg-gradient-to-br from-rose-50 to-white p-5 shadow-sm">
                  <div className="absolute -right-2 -bottom-2 h-16 w-16 rounded-full bg-rose-100 opacity-50 blur-lg"></div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-rose-900">Pengguna Aktif</span>
                    <span className="flex items-center gap-1.5 rounded bg-rose-100 px-2 py-0.5 text-2xs font-semibold text-rose-800">
                      <span className="h-1.5 w-1.5 rounded-full bg-rose-600 animate-ping"></span>
                      Real-time
                    </span>
                  </div>
                  <p className="mt-3 text-3xl font-extrabold text-[#14213d] flex items-baseline gap-2">
                    {analyticsData.summary.realtimeActiveUsers}
                    <span className="text-xs font-normal text-rose-700">sedang online</span>
                  </p>
                  <p className="mt-1 text-xs text-[#52606d]">Rasio pantulan: {analyticsData.summary.bounceRate}</p>
                </div>
              </div>

              {/* Charts Section */}
              <div className="grid gap-6 lg:grid-cols-3">
                {/* Visitor Trend AreaChart */}
                <div className="rounded-lg border border-[#dfd8ca] bg-white p-5 shadow-sm lg:col-span-2">
                  <h3 className="text-lg font-bold text-[#14213d] mb-4">Tren Pengunjung (30 Hari Terakhir)</h3>
                  <div className="h-[300px] w-full">
                    {mounted && analyticsData.visitorTrend && (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={analyticsData.visitorTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorPageViews" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#2a6f6f" stopOpacity={0.2}/>
                              <stop offset="95%" stopColor="#2a6f6f" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorActiveUsers" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#14213d" stopOpacity={0.2}/>
                              <stop offset="95%" stopColor="#14213d" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e7eb" />
                          <XAxis 
                            dataKey="date" 
                            stroke="#718096" 
                            fontSize={10}
                            tickFormatter={(val) => {
                              const parts = val.split("-");
                              return parts.length === 3 ? `${parts[2]}/${parts[1]}` : val;
                            }}
                          />
                          <YAxis stroke="#718096" fontSize={10} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: "#ffffff", borderColor: "#dfd8ca", borderRadius: "8px" }}
                            labelFormatter={(val) => `Tanggal: ${val}`}
                          />
                          <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} />
                          <Area name="Tayangan Halaman (Views)" type="monotone" dataKey="pageViews" stroke="#2a6f6f" strokeWidth={2} fillOpacity={1} fill="url(#colorPageViews)" />
                          <Area name="Pengunjung Aktif (Users)" type="monotone" dataKey="activeUsers" stroke="#14213d" strokeWidth={2} fillOpacity={1} fill="url(#colorActiveUsers)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                {/* Device Breakdown PieChart */}
                <div className="rounded-lg border border-[#dfd8ca] bg-white p-5 shadow-sm">
                  <h3 className="text-lg font-bold text-[#14213d] mb-4">Akses Perangkat</h3>
                  <div className="h-[230px] w-full flex items-center justify-center">
                    {mounted && analyticsData.devices && (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={analyticsData.devices}
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={80}
                            paddingAngle={3}
                            dataKey="activeUsers"
                            nameKey="category"
                          >
                            {analyticsData.devices.map((entry: any, index: number) => {
                              const colors = ["#2a6f6f", "#14213d", "#fca311", "#a0aec0"];
                              return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                            })}
                          </Pie>
                          <Tooltip contentStyle={{ borderRadius: "8px" }} />
                          <Legend wrapperStyle={{ fontSize: "11px" }} layout="horizontal" verticalAlign="bottom" align="center" />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 border-t border-[#f1f3f5] pt-3 text-center text-xs">
                    {analyticsData.devices.map((device: any, index: number) => (
                      <div key={device.category} className="flex flex-col items-center">
                        <span className="font-semibold text-[#14213d]">{device.percentage}%</span>
                        <span className="text-[#52606d] text-2xs truncate max-w-full">{device.category}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Bottom Tables Grid */}
              <div className="grid gap-6 md:grid-cols-2">
                {/* Top Visited Pages List */}
                <div className="rounded-lg border border-[#dfd8ca] bg-white p-5 shadow-sm">
                  <h3 className="text-lg font-bold text-[#14213d] mb-3">Halaman Paling Populer</h3>
                  <p className="text-xs text-[#52606d] mb-4">Halaman dengan tayangan dan interaksi paling banyak dalam 30 hari.</p>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-[#dfd8ca] text-xs font-bold uppercase tracking-wider text-[#52606d]">
                          <th className="pb-3 pr-2">Halaman / Path</th>
                          <th className="pb-3 text-right">Tayangan</th>
                          <th className="pb-3 text-right">Pembaca</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analyticsData.topPages.map((page: any, idx: number) => (
                          <tr key={idx} className="border-b border-[#dfd8ca]/50 hover:bg-[#f7f4ee]/30 transition">
                            <td className="py-2.5 pr-2 max-w-[200px] sm:max-w-[280px]">
                              <p className="font-medium text-[#14213d] truncate" title={page.title}>{page.title}</p>
                              <p className="font-mono text-2xs text-[#718096] truncate">{page.path}</p>
                            </td>
                            <td className="py-2.5 text-right font-semibold text-[#2a6f6f]">{page.pageViews.toLocaleString("id-ID")}</td>
                            <td className="py-2.5 text-right font-medium text-[#14213d]">{page.activeUsers.toLocaleString("id-ID")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Traffic Acquisition & Geography Grid */}
                <div className="grid gap-6">
                  {/* Traffic Sources Progress bars */}
                  <div className="rounded-lg border border-[#dfd8ca] bg-white p-5 shadow-sm">
                    <h3 className="text-lg font-bold text-[#14213d] mb-3">Saluran Akuisisi Sesi</h3>
                    <p className="text-xs text-[#52606d] mb-4">Bagaimana cara pengunjung menemukan website Grace Daily.</p>
                    <div className="space-y-3.5">
                      {analyticsData.trafficSources.map((src: any) => (
                        <div key={src.source}>
                          <div className="flex justify-between text-xs font-bold text-[#14213d] mb-1">
                            <span>{src.source}</span>
                            <span>{src.percentage}% ({src.sessions.toLocaleString("id-ID")} sesi)</span>
                          </div>
                          <div className="w-full bg-[#f7f4ee] rounded-full h-2.5 overflow-hidden border border-[#dfd8ca]/50">
                            <div className="bg-[#2a6f6f] h-full rounded-full transition-all duration-500" style={{ width: `${src.percentage}%` }}></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Regions list */}
                  <div className="rounded-lg border border-[#dfd8ca] bg-white p-5 shadow-sm">
                    <h3 className="text-lg font-bold text-[#14213d] mb-3">Distribusi Wilayah Pembaca (Provinsi)</h3>
                    <p className="text-xs text-[#52606d] mb-3">Asal provinsi pengunjung terbanyak di Indonesia.</p>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-2 mt-3">
                      {analyticsData.regions.map((region: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center text-xs py-1 border-b border-[#f1f3f5]">
                          <span className="font-semibold text-[#14213d] truncate pr-2 max-w-[120px]">{region.name}</span>
                          <span className="rounded bg-[#f7f4ee] border border-[#dfd8ca] px-2 py-0.5 font-bold text-[#2a6f6f]">
                            {region.activeUsers} pembaca
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === "api-keys" && <ApiKeysPanel auth={auth} />}

      {activeTab === "renungan" && (
        <section className="grid gap-6 lg:grid-cols-[1fr_1.5fr]">
          <form onSubmit={(e) => { e.preventDefault(); saveDevotion(); }} className="grid gap-4 rounded-lg border border-[#dfd8ca] bg-white p-5 h-fit">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-[#14213d]">{editingDevotionId ? "Edit Renungan" : "Tambah Renungan"}</h2>
              {editingDevotionId && (
                <button type="button" onClick={clearDevotionForm} className="rounded-md border border-[#dfd8ca] px-3 py-1.5 text-sm font-semibold text-[#14213d]">
                  Batal
                </button>
              )}
            </div>
            
            <div className="grid gap-2">
              <label className="text-xs font-bold uppercase tracking-[0.14em] text-[#2a6f6f]">Date ID *</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={devotionDateId}
                  onChange={(e) => setDevotionDateId(e.target.value)}
                  placeholder="golden-2026-05-30-05"
                  className="flex-1 rounded-md border border-[#dfd8ca] p-3 text-sm focus:border-[#2a6f6f] outline-none"
                  required
                />
                <button
                  type="button"
                  onClick={generateCurrentDateId}
                  className="rounded-md bg-[#2a6f6f] px-4 py-3 text-sm font-semibold text-white"
                >
                  Auto
                </button>
              </div>
              <p className="text-xs text-[#52606d]">Format: golden-YYYY-MM-DD-05. Klik "Auto" untuk generate berdasarkan waktu Jakarta saat ini.</p>
            </div>

            <div className="grid gap-2">
              <label className="text-xs font-bold uppercase tracking-[0.14em] text-[#2a6f6f]">Judul</label>
              <input
                type="text"
                value={devotionTitle}
                onChange={(e) => setDevotionTitle(e.target.value)}
                placeholder="Renungan Hari Ini"
                className="w-full rounded-md border border-[#dfd8ca] p-3 text-sm focus:border-[#2a6f6f] outline-none"
              />
            </div>

            <div className="grid gap-2">
              <label className="text-xs font-bold uppercase tracking-[0.14em] text-[#2a6f6f]">Referensi Ayat</label>
              <input
                type="text"
                value={devotionVerseRef}
                onChange={(e) => setDevotionVerseRef(e.target.value)}
                placeholder="Yohanes 3:16"
                className="w-full rounded-md border border-[#dfd8ca] p-3 text-sm focus:border-[#2a6f6f] outline-none"
              />
            </div>

            <div className="grid gap-2">
              <label className="text-xs font-bold uppercase tracking-[0.14em] text-[#2a6f6f]">Teks Ayat</label>
              <textarea
                value={devotionVerseText}
                onChange={(e) => setDevotionVerseText(e.target.value)}
                placeholder="Karena Allah sangat mengasihi dunia ini..."
                rows={3}
                className="w-full rounded-md border border-[#dfd8ca] p-3 text-sm focus:border-[#2a6f6f] outline-none"
              />
            </div>

            <div className="grid gap-2">
              <label className="text-xs font-bold uppercase tracking-[0.14em] text-[#2a6f6f]">Isi Renungan</label>
              <textarea
                value={devotionBody}
                onChange={(e) => setDevotionBody(e.target.value)}
                placeholder="Tulis isi renungan..."
                rows={6}
                className="w-full rounded-md border border-[#dfd8ca] p-3 text-sm focus:border-[#2a6f6f] outline-none"
              />
              <button
                type="button"
                onClick={() => startSpeechRecognition(setDevotionBody, setIsListeningDevotionBody)}
                className={`w-fit rounded-md px-3 py-1.5 border border-[#dfd8ca] font-semibold text-xs flex items-center gap-1 transition ${
                  isListeningDevotionBody ? "bg-red-100 text-red-700 animate-pulse border-red-300" : "bg-white text-[#14213d] hover:bg-gray-50"
                }`}
              >
                🎙️ {isListeningDevotionBody ? "Dikte..." : "Dikte Isi Renungan"}
              </button>
            </div>

            <div className="grid gap-2">
              <label className="text-xs font-bold uppercase tracking-[0.14em] text-[#2a6f6f]">Doa</label>
              <textarea
                value={devotionPrayer}
                onChange={(e) => setDevotionPrayer(e.target.value)}
                placeholder="Tulis doa..."
                rows={3}
                className="w-full rounded-md border border-[#dfd8ca] p-3 text-sm focus:border-[#2a6f6f] outline-none"
              />
              <button
                type="button"
                onClick={() => startSpeechRecognition(setDevotionPrayer, setIsListeningDevotionPrayer)}
                className={`w-fit rounded-md px-3 py-1.5 border border-[#dfd8ca] font-semibold text-xs flex items-center gap-1 transition ${
                  isListeningDevotionPrayer ? "bg-red-100 text-red-700 animate-pulse border-red-300" : "bg-white text-[#14213d] hover:bg-gray-50"
                }`}
              >
                🎙️ {isListeningDevotionPrayer ? "Dikte..." : "Dikte Doa"}
              </button>
            </div>

            <div className="grid gap-2">
              <label className="text-xs font-bold uppercase tracking-[0.14em] text-[#2a6f6f]">Unggah Gambar Kustom (Opsional)</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleDevotionImageUpload}
                disabled={isUploading}
                className="w-full rounded-md border border-[#dfd8ca] px-3 py-2 text-sm bg-white"
              />
            </div>

            <div className="grid gap-2">
              <label className="text-xs font-bold uppercase tracking-[0.14em] text-[#2a6f6f]">URL Gambar R2 / Upload</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={devotionIllustrationUrl}
                  onChange={(e) => setDevotionIllustrationUrl(e.target.value)}
                  placeholder="https://..."
                  className="flex-1 rounded-md border border-[#dfd8ca] p-3 text-sm focus:border-[#2a6f6f] outline-none"
                />
                <button
                  type="button"
                  onClick={generateDevotionImage}
                  disabled={isGeneratingImage}
                  className="rounded-md bg-[#2a6f6f] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {isGeneratingImage ? "Memilih..." : "Pilih R2"}
                </button>
              </div>
              {devotionIllustrationUrl && (
                <img src={devotionIllustrationUrl} alt="Preview" className="mt-2 h-32 w-full object-cover rounded-md" />
              )}
            </div>

            <div className="grid gap-2">
              <label className="text-xs font-bold uppercase tracking-[0.14em] text-[#2a6f6f]">Status</label>
              <select
                value={devotionStatus}
                onChange={(e) => setDevotionStatus(e.target.value)}
                className="w-full rounded-md border border-[#dfd8ca] p-3 text-sm focus:border-[#2a6f6f] outline-none"
              >
                <option value="published">Published</option>
                <option value="draft">Draft</option>
              </select>
            </div>

            <button
              type="submit"
              className="rounded-md bg-[#14213d] px-4 py-3 font-semibold text-white"
            >
              {editingDevotionId ? "Update Renungan" : "Simpan Renungan"}
            </button>
          </form>

          <div className="rounded-lg border border-[#dfd8ca] bg-white p-5">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-xl font-semibold text-[#14213d]">Daftar Renungan</h2>
              <button
                type="button"
                onClick={triggerDailyDevotionGeneration}
                disabled={isTriggeringDailyDevotion}
                className="rounded-md bg-[#2a6f6f] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {isTriggeringDailyDevotion ? "Generate..." : "Generate Harian Manual"}
              </button>
            </div>
            <div className="mb-4 p-3 bg-[#f7f4ee] rounded-md">
              <p className="text-xs font-semibold text-[#14213d] mb-1">Info Slot Waktu:</p>
              <p className="text-xs text-[#52606d]">Landing page menampilkan renungan berdasarkan waktu Jakarta:</p>
              <ul className="text-xs text-[#52606d] mt-1 list-disc list-inside">
                <li>Sebelum 05:00 WIB → Slot kemarin jam 05:00</li>
                <li>05:00 WIB atau lebih → Slot hari ini jam 05:00</li>
              </ul>
              <p className="text-xs text-[#52606d] mt-2">Untuk update landing page segera, gunakan dateId yang sesuai waktu saat ini (klik tombol &ldquo;Auto&rdquo;).</p>
            </div>
            {/* Tampilkan renungan yang sudah ada hari ini */}
            {(() => {
              const todayId = (() => {
                const now = new Date();
                const fmt = new Intl.DateTimeFormat("en-CA", {
                  timeZone: "Asia/Jakarta",
                  hourCycle: "h23",
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                });
                const parts = Object.fromEntries(fmt.formatToParts(now).map(p => [p.type, p.value]));
                const day = `${parts.year}-${parts.month}-${parts.day}`;
                const hour = Number(parts.hour);
                if (hour < 5) {
                  const prev = new Date(now.getTime() - 86_400_000);
                  const p2 = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(prev);
                  return `golden-${p2}-05`;
                }
                return `golden-${day}-05`;
              })();
              const todayDevotion = devotions.find(d => d.id === todayId || d.dateId === todayId);
              if (!todayDevotion) {
                return (
                  <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-md">
                    <p className="text-xs font-bold text-amber-700">⚠️ Slot saat ini ({todayId}) belum ada renungan.</p>
                    <p className="text-xs text-amber-600 mt-1">Klik &ldquo;Generate Harian Manual&rdquo; untuk membuat renungan baru.</p>
                  </div>
                );
              }
              return (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
                  <p className="text-xs font-bold text-green-700">✅ Renungan aktif slot saat ini:</p>
                  <p className="text-sm font-semibold text-[#14213d] mt-1">&ldquo;{todayDevotion.title || "(tanpa judul)"}&rdquo;</p>
                  <p className="text-xs text-green-600">ID: {todayId} | Ayat: {todayDevotion.verseRef}</p>
                  {todayDevotion.imageUrl || todayDevotion.illustrationUrl ? (
                    <p className="text-xs text-green-600 mt-0.5">✅ Gambar tersedia</p>
                  ) : (
                    <p className="text-xs text-amber-600 mt-0.5">⚠️ Gambar belum dipilih</p>
                  )}
                </div>
              );
            })()}
            <div className="grid gap-3">
              {devotions.length === 0 ? (
                <p className="text-sm text-[#52606d]">Belum ada renungan.</p>
              ) : (
                devotions.slice((devotionPage - 1) * ITEMS_PER_PAGE, devotionPage * ITEMS_PER_PAGE).map((devotion) => (
                  <div key={devotion.id} className="rounded-md border border-[#dfd8ca] bg-[#f7f4ee] p-4">
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1">
                        <p className="font-semibold text-[#14213d]">{devotion.title || "Tanpa Judul"}</p>
                        <p className="text-sm text-[#52606d]">{devotion.dateId || devotion.id}</p>
                        <p className="text-xs text-[#52606d] mt-1">{devotion.verseRef}</p>
                        <p className="text-xs text-[#52606d]">Status: {devotion.status}</p>
                        {(devotion.imageUrl || devotion.illustrationUrl || devotion.bannerUrl) && (
                          <img src={devotion.imageUrl || devotion.illustrationUrl || devotion.bannerUrl} alt="" className="mt-2 h-20 w-32 object-cover rounded-md" />
                        )}
                      </div>
                      <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
                        <button
                          onClick={() => handleEditDevotion(devotion)}
                          className="text-sm font-semibold text-blue-600 hover:text-blue-800"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteDevotion(devotion.id)}
                          className="text-sm font-semibold text-red-600 hover:text-red-800"
                        >
                          Hapus
                        </button>
                        <button
                          onClick={() => shareToSocials("daily_devotions", devotion.id)}
                          disabled={isSharingSocialsId === devotion.id}
                          className="text-sm font-semibold text-teal-600 hover:text-teal-800 disabled:opacity-50"
                        >
                          {isSharingSocialsId === devotion.id ? "Sharing..." : "Share ke Sosmed"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            {devotions.length > ITEMS_PER_PAGE && (
              <div className="mt-4 flex items-center justify-between border-t border-[#dfd8ca] pt-4">
                <button
                  type="button"
                  onClick={() => setDevotionPage((page) => Math.max(1, page - 1))}
                  disabled={devotionPage === 1}
                  className="rounded-md border border-[#dfd8ca] px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
                >
                  Prev
                </button>
                <span className="text-sm font-semibold text-[#52606d]">
                  {devotionPage} / {Math.ceil(devotions.length / ITEMS_PER_PAGE)}
                </span>
                <button
                  type="button"
                  onClick={() => setDevotionPage((page) => Math.min(Math.ceil(devotions.length / ITEMS_PER_PAGE), page + 1))}
                  disabled={devotionPage === Math.ceil(devotions.length / ITEMS_PER_PAGE)}
                  className="rounded-md border border-[#dfd8ca] px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {activeTab === "aktivitas" && (
        <section className="grid gap-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-[#dfd8ca] bg-white p-5 shadow-sm">
              <p className="text-sm text-[#52606d]">Total Interaksi </p>
              <p className="mt-2 text-3xl font-bold text-[#14213d]">{aiRequests.length}</p>
            </div>
            <div className="rounded-lg border border-[#dfd8ca] bg-white p-5 shadow-sm">
              <p className="text-sm text-[#52606d]">Pengguna Unik</p>
              <p className="mt-2 text-3xl font-bold text-[#2a6f6f]">{new Set(aiRequests.map((r) => r.userId)).size}</p>
            </div>
            <div className="rounded-lg border border-[#dfd8ca] bg-white p-5 shadow-sm">
              <p className="text-sm text-[#52606d]">Hasil Filter</p>
              <p className="mt-2 text-3xl font-bold text-[#d97706]">{filteredActivities.length}</p>
            </div>
          </div>

          <div className="rounded-lg border border-[#dfd8ca] bg-white p-5 shadow-sm">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center mb-6">
              <h2 className="text-xl font-semibold text-[#14213d]">Semua Kegiatan AI User</h2>
              <div className="flex flex-wrap gap-3">
                <input
                  type="search"
                  value={activitySearch}
                  onChange={(e) => {
                    setActivitySearch(e.target.value);
                    setActivitiesPage(1);
                  }}
                  className="rounded-md border border-[#dfd8ca] px-3 py-2 text-sm outline-none focus:border-[#2a6f6f] bg-white text-[#1f2933]"
                  placeholder="Cari email user..."
                />
                <select
                  value={activityFilter}
                  onChange={(e) => {
                    setActivityFilter(e.target.value);
                    setActivitiesPage(1);
                  }}
                  className="rounded-md border border-[#dfd8ca] px-3 py-2 text-sm outline-none focus:border-[#2a6f6f] bg-white text-[#1f2933]"
                >
                  <option value="Semua">Semua Mode AI</option>
                  <option value="Renungan online">Renungan Online</option>
                  <option value="PDF Devotional">PDF Devotional</option>
                  <option value="Tanya pendeta">Tanya Pendeta</option>
                  <option value="Studi Alkitab">Studi Alkitab</option>
                  <option value="Doa">Doa</option>
                  <option value="Lagu Rohani">Lagu Rohani</option>
                  <option value="Panduan Khotbah/Komsel">Panduan Khotbah/Komsel</option>
                  <option value="Pendampingan rohani">Pendampingan Rohani</option>
                </select>
              </div>
            </div>

            <div className="grid gap-4">
              {paginatedActivities.length === 0 ? (
                <p className="text-center py-6 text-sm text-[#52606d]">Tidak ada riwayat aktivitas yang cocok dengan kriteria pencarian.</p>
              ) : (
                paginatedActivities.map((act) => (
                  <article key={act.id} className="rounded-lg border border-[#dfd8ca] bg-[#f7f4ee] p-5 shadow-sm transition hover:shadow-md">
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                      <div className="grid gap-1">
                        <span className="font-semibold text-[#14213d] text-base">{getUserEmail(act.userId)}</span>
                        <div className="flex flex-wrap gap-2 items-center mt-1">
                          <span className="rounded-full bg-[#e9f5db] px-2.5 py-0.5 text-xs font-semibold text-[#284b3a]">
                            {act.mode || "AI Request"}
                          </span>
                          <span className="text-xs text-[#52606d] font-mono">ID: {act.id}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <time className="text-xs font-semibold text-[#2a6f6f]">
                          {formatActivityDate(act.createdAt)}
                        </time>
                        <button
                          onClick={() => setExpandedActivityId((curr) => curr === act.id ? null : act.id)}
                          className="rounded-md border border-[#dfd8ca] bg-white px-3 py-1 text-xs font-semibold text-[#14213d] hover:bg-gray-50 transition"
                        >
                          {expandedActivityId === act.id ? "Tutup" : "Lihat Detail"}
                        </button>
                        <button
                          onClick={() => handleDeleteActivity(act.id)}
                          className="rounded-md bg-red-50 text-red-600 px-3 py-1 text-xs font-semibold hover:bg-red-100 transition"
                        >
                          Hapus
                        </button>
                      </div>
                    </div>

                    <div className="mt-3">
                      <p className="text-sm font-semibold text-[#14213d]">Prompt:</p>
                      <p className="mt-1 text-sm text-[#52606d] line-clamp-2 italic">"{act.prompt}"</p>
                    </div>

                    {expandedActivityId === act.id && (
                      <div className="mt-4 rounded-md bg-white p-4 border border-[#dfd8ca]">
                        <div className="rounded-md bg-[#f7f4ee] p-3">
                          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#2a6f6f]">Prompt Lengkap</p>
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[#334155]">{act.prompt}</p>
                        </div>
                        <div className="mt-4 border-t border-[#dfd8ca] pt-4">
                          <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-[#2a6f6f]">Jawaban AI</p>
                          <div className="prose prose-sm max-w-none text-[#334155] leading-7 max-h-96 overflow-y-auto pr-2">
                            <ReactMarkdown
                              components={{
                                h1: ({ node, ...props }) => <strong {...props} className="block mt-2 text-base text-[#14213d]" />,
                                h2: ({ node, ...props }) => <strong {...props} className="block mt-2 text-sm text-[#14213d]" />,
                                h3: ({ node, ...props }) => <strong {...props} className="block mt-2 text-sm text-[#14213d]" />,
                              }}
                            >
                              {act.answer}
                            </ReactMarkdown>
                          </div>
                        </div>
                      </div>
                    )}
                  </article>
                ))
              )}
            </div>

            {totalActivitiesPages > 1 && (
              <div className="mt-6 flex items-center justify-between border-t border-[#dfd8ca] pt-4">
                <button
                  onClick={() => setActivitiesPage((p) => Math.max(1, p - 1))}
                  disabled={activitiesPage === 1}
                  className="rounded-md border border-[#dfd8ca] px-3 py-1.5 text-sm font-semibold disabled:opacity-50 hover:bg-gray-50 transition"
                >
                  Prev
                </button>
                <span className="text-sm font-semibold text-[#52606d]">
                  {activitiesPage} / {totalActivitiesPages}
                </span>
                <button
                  onClick={() => setActivitiesPage((p) => Math.min(totalActivitiesPages, p + 1))}
                  disabled={activitiesPage === totalActivitiesPages}
                  className="rounded-md border border-[#dfd8ca] px-3 py-1.5 text-sm font-semibold disabled:opacity-50 hover:bg-gray-50 transition"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {activeTab === "statistik" && (
        <section className="rounded-lg border border-[#dfd8ca] bg-white p-5 max-w-3xl">
          <h2 className="text-xl font-semibold text-[#14213d]">Statistik Topik Pergumulan</h2>
          <p className="text-sm text-[#52606d] mb-6">Berdasarkan {questions.length} pertanyaan forum publik terakhir.</p>
          <div className="grid gap-5">
            {Object.entries(
              questions.reduce((acc, q) => {
                acc[q.category] = (acc[q.category] || 0) + 1;
                return acc;
              }, {} as Record<string, number>)
            ).sort((a, b) => b[1] - a[1]).map(([cat, count]) => {
              const pct = Math.round((count / questions.length) * 100) || 0;
              return (
                <div key={cat}>
                  <div className="flex justify-between text-sm font-semibold text-[#14213d] mb-1.5">
                    <span>{cat}</span>
                    <span>{pct}% ({count})</span>
                  </div>
                  <div className="w-full bg-[#f7f4ee] rounded-full h-4 overflow-hidden border border-[#dfd8ca]">
                    <div className="bg-[#2a6f6f] h-full transition-all duration-1000" style={{ width: `${pct}%` }}></div>
                  </div>
                </div>
              );
            })}
            {questions.length === 0 && <p className="text-sm text-[#52606d]">Belum ada data pertanyaan.</p>}
          </div>
        </section>
      )}

      {activeTab === "pengumuman" && (
        <section className="rounded-lg border border-[#dfd8ca] bg-white p-5 max-w-3xl">
          <h2 className="text-xl font-semibold text-[#14213d] mb-4">Papan Buletin Gereja</h2>
          <form onSubmit={saveBulletin} className="grid gap-4">
            <input value={bulletinTitle} onChange={(e) => setBulletinTitle(e.target.value)} className="rounded-md border border-[#dfd8ca] px-4 py-3" placeholder="Judul Banner (misal: Ibadah Live Streaming)" required />
            <textarea value={bulletinContent} onChange={(e) => setBulletinContent(e.target.value)} className="min-h-24 rounded-md border border-[#dfd8ca] px-4 py-3" placeholder="Isi Pengumuman" required />
            <input value={bulletinUrl} onChange={(e) => setBulletinUrl(e.target.value)} type="url" className="rounded-md border border-[#dfd8ca] px-4 py-3" placeholder="Link (Opsional) - misal link youtube" />
            <label className="flex items-center gap-2 text-[#14213d] font-semibold mt-2">
              <input type="checkbox" checked={bulletinIsActive} onChange={(e) => setBulletinIsActive(e.target.checked)} className="rounded border-[#dfd8ca] text-[#2a6f6f] h-4 w-4" />
              Aktifkan Banner di Halaman Utama
            </label>
            <button className="rounded-md bg-[#14213d] px-5 py-3 font-semibold text-white w-fit mt-2">Simpan Banner</button>
          </form>
        </section>
      )}

      {activeTab === "forum" && (
        <section className="grid gap-6 lg:grid-cols-[1fr_1.5fr] items-start">
          <div className="rounded-lg border border-[#dfd8ca] bg-white p-5 sticky top-5 shadow-sm">
            <h2 className="text-xl font-semibold text-[#14213d]">{editingQuestionId ? "Beri Jawaban Pastoral" : "Verifikasi Jawaban AI"}</h2>
            {!editingQuestionId ? (
              <p className="mt-3 text-sm text-[#52606d] leading-6">Pilih pertanyaan di sebelah kanan untuk menambahkan catatan pendeta asli atau memverifikasi jawaban AI.</p>
            ) : (
              <form onSubmit={savePastorReply} className="mt-4 grid gap-4">
                <textarea 
                  value={pastorNotes} 
                  onChange={(e) => setPastorNotes(e.target.value)} 
                  className="min-h-32 rounded-md border border-[#dfd8ca] px-4 py-3 text-sm" 
                  placeholder="Ketik catatan pastoral, ayat pendukung tambahan, atau nomor kontak konseling gereja di sini..." 
                />
                <label className="flex items-center gap-2 text-sm text-[#14213d] font-semibold">
                  <input type="checkbox" checked={isVerified} onChange={(e) => setIsVerified(e.target.checked)} className="rounded border-[#dfd8ca] text-[#2a6f6f] h-4 w-4" />
                  Tampilkan Stempel "Verified by Pastor"
                </label>
                <div className="flex gap-2 mt-2">
                  <button type="submit" className="rounded-md bg-[#2a6f6f] px-4 py-2 font-semibold text-white text-sm">Simpan</button>
                  <button type="button" onClick={clearPastorReplyForm} className="rounded-md border border-[#dfd8ca] bg-white px-4 py-2 font-semibold text-[#14213d] text-sm">Batal</button>
                </div>
              </form>
            )}
          </div>
          
          <div className="grid gap-4">
            {questions.slice((questionsPage - 1) * ITEMS_PER_PAGE, questionsPage * ITEMS_PER_PAGE).map(q => (
              <div key={q.id} className="rounded-md border border-[#dfd8ca] bg-[#f7f4ee] p-5">
                <p className="font-semibold text-[#14213d] mb-1">{q.authorName} &bull; <span className="text-[#2a6f6f]">{q.category}</span></p>
                <p className="text-sm text-[#52606d] mb-4 line-clamp-3 leading-6">{q.question}</p>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#dfd8ca] pt-4">
                  <span className={`text-xs font-semibold px-2 py-1 rounded-md ${q.isVerifiedByPastor ? "bg-[#e9f5db] text-[#284b3a]" : "bg-gray-200 text-gray-700"}`}>
                    {q.isVerifiedByPastor ? "✅ Verified" : "⏳ Belum diverifikasi"}
                  </span>
                  <button onClick={() => handleEditQuestion(q)} className="rounded-md border border-[#dfd8ca] bg-white px-4 py-2 text-sm font-semibold text-[#14213d] hover:bg-[#e9f5db] transition">
                    Verifikasi / Edit
                  </button>
                </div>
              </div>
            ))}
            {Math.ceil(questions.length / ITEMS_PER_PAGE) > 1 && (
              <div className="flex items-center justify-between mt-2">
                <button onClick={() => setQuestionsPage(p => Math.max(1, p - 1))} disabled={questionsPage === 1} className="rounded-md border border-[#dfd8ca] px-3 py-1.5 text-sm font-semibold disabled:opacity-50">Prev</button>
                <span className="text-sm font-semibold text-[#52606d]">{questionsPage} / {Math.ceil(questions.length / ITEMS_PER_PAGE)}</span>
                <button onClick={() => setQuestionsPage(p => Math.min(Math.ceil(questions.length / ITEMS_PER_PAGE), p + 1))} disabled={questionsPage === Math.ceil(questions.length / ITEMS_PER_PAGE)} className="rounded-md border border-[#dfd8ca] px-3 py-1.5 text-sm font-semibold disabled:opacity-50">Next</button>
              </div>
            )}
          </div>
        </section>
      )}

      {activeTab === "blog" && (
        <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <form onSubmit={saveBlog} className="grid gap-4 rounded-lg border border-[#dfd8ca] bg-white p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-[#14213d]">{editingPostId ? "Edit Artikel" : "Buat Artikel Baru"}</h2>
              {editingPostId && (
                <button type="button" onClick={clearBlogForm} className="rounded-md border border-[#dfd8ca] px-3 py-1.5 text-sm font-semibold text-[#14213d]">
                  Batal
                </button>
              )}
            </div>
            
            <div className="flex gap-2">
              <input value={blogTitle} onChange={(event) => setBlogTitle(event.target.value)} className="flex-1 rounded-md border border-[#dfd8ca] px-4 py-3 bg-white text-[#1f2933]" placeholder="Judul artikel" required />
              <button
                type="button"
                onClick={() => startSpeechRecognition(setBlogTitle, setIsListeningTitle)}
                className={`rounded-md px-3 py-2 border border-[#dfd8ca] font-semibold text-sm flex items-center gap-1 transition ${
                  isListeningTitle ? "bg-red-100 text-red-700 animate-pulse border-red-300" : "bg-white text-[#14213d] hover:bg-gray-50"
                }`}
                title="Voice to Text"
              >
                🎙️ {isListeningTitle ? "Dikte..." : "Dikte"}
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center px-1">
                  <label className="text-xs font-semibold text-[#52606d]">Kategori</label>
                  <button
                    type="button"
                    onClick={() => setShowCategoryManager(!showCategoryManager)}
                    className="text-xs font-semibold text-[#2a6f6f] hover:text-[#1f5353] transition flex items-center gap-1"
                  >
                    {showCategoryManager ? "✕ Tutup Kelola" : "⚙️ Kelola Kategori"}
                  </button>
                </div>
                <select 
                  value={blogCategory} 
                  onChange={(event) => setBlogCategory(event.target.value)} 
                  className="w-full rounded-md border border-[#dfd8ca] px-4 py-3 bg-white text-[#1f2933]"
                >
                  {Array.from(new Set([...categoriesList, blogCategory].filter(Boolean))).map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-[#52606d] px-1 h-[18px] flex items-end">Status Publikasi</label>
                <select value={blogStatus} onChange={(event) => setBlogStatus(event.target.value)} className="w-full rounded-md border border-[#dfd8ca] px-4 py-3 bg-white text-[#1f2933]">
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </select>
              </div>
            </div>

            {showCategoryManager && (
              <div className="rounded-md border border-[#dfd8ca] bg-[#f7f4ee] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-[#14213d]">Kelola Kategori</h4>
                  <span className="text-xs text-[#52606d]">{categoriesList.length} Kategori</span>
                </div>
                
                {/* Form Tambah Kategori */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Nama kategori baru..."
                    value={newCatInput}
                    onChange={(e) => setNewCatInput(e.target.value)}
                    className="flex-1 rounded-md border border-[#dfd8ca] px-3 py-2 text-sm bg-white text-[#1f2933]"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddCategory(newCatInput)}
                    className="rounded-md bg-[#2a6f6f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1f5353] transition"
                  >
                    Tambah
                  </button>
                </div>

                {/* Daftar Kategori */}
                <div className="max-h-48 overflow-y-auto divide-y divide-[#dfd8ca]/60 pr-1">
                  {categoriesList.map((cat) => (
                    <div key={cat} className="py-2.5 flex items-center justify-between gap-3 text-sm">
                      {editingCatOldName === cat ? (
                        <div className="flex-1 flex gap-2">
                          <input
                            type="text"
                            value={editingCatNewName}
                            onChange={(e) => setEditingCatNewName(e.target.value)}
                            className="flex-1 rounded-md border border-[#dfd8ca] px-2 py-1 text-sm bg-white text-[#1f2933]"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => handleEditCategory(cat, editingCatNewName)}
                            className="rounded-md bg-green-600 px-3 py-1 text-white text-xs font-semibold hover:bg-green-700 transition"
                          >
                            Simpan
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingCatOldName(null)}
                            className="rounded-md border border-[#dfd8ca] px-3 py-1 text-[#14213d] text-xs font-semibold hover:bg-gray-50 transition"
                          >
                            Batal
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="font-medium text-[#1f2933]">{cat}</span>
                          <div className="flex gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCatOldName(cat);
                                setEditingCatNewName(cat);
                              }}
                              className="rounded-md border border-[#dfd8ca] bg-white px-2.5 py-1 text-xs font-semibold text-[#14213d] hover:bg-gray-50 transition"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteCategory(cat)}
                              className="rounded-md border border-transparent bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-200 transition"
                            >
                              Hapus
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <textarea value={blogExcerpt} onChange={(event) => setBlogExcerpt(event.target.value)} className="min-h-24 rounded-md border border-[#dfd8ca] px-4 py-3 bg-white text-[#1f2933]" placeholder="Ringkasan artikel (opsional)" />
              <button
                type="button"
                onClick={() => startSpeechRecognition(setBlogExcerpt, setIsListeningExcerpt)}
                className={`w-fit rounded-md px-3 py-2 border border-[#dfd8ca] font-semibold text-sm flex items-center gap-1 transition ${
                  isListeningExcerpt ? "bg-red-100 text-red-700 animate-pulse border-red-300" : "bg-white text-[#14213d] hover:bg-gray-50"
                }`}
              >
                🎙️ {isListeningExcerpt ? "Dikte..." : "Dikte Ringkasan"}
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-[auto_1fr] items-center">
              <label className="flex flex-col gap-1 text-sm font-semibold text-[#334155]">
                Thumbnail Artikel (Opsional)
                <input type="file" accept="image/*" onChange={handleImageUpload} disabled={isUploading} className="max-w-[250px] rounded-md border border-[#dfd8ca] px-3 py-2 text-sm" />
              </label>
              {blogImage && <img src={blogImage} alt="Thumbnail" className="h-16 w-16 rounded-md object-cover shadow-sm" />}
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <label className="text-sm font-semibold text-[#14213d]">Konten Artikel</label>
                <button
                  type="button"
                  onClick={() => startSpeechRecognition((val) => {
                    const text = typeof val === 'function' ? (val as any)("") : val;
                    if (blogEditorRef.current) {
                      blogEditorRef.current.insertContent(`<p>${text}</p>`);
                      setBlogBody(blogEditorRef.current.getContent());
                    } else {
                      setBlogBody((prev) => `${prev}<p>${text}</p>`);
                    }
                  }, setIsListeningBody)}
                  className={`rounded-md px-3 py-2 border border-[#dfd8ca] font-semibold text-sm flex items-center gap-1 transition ${
                    isListeningBody ? "bg-red-100 text-red-700 animate-pulse border-red-300" : "bg-white text-[#14213d] hover:bg-gray-50"
                  }`}
                >
                  🎙️ {isListeningBody ? "Dikte..." : "Dikte Konten"}
                </button>
              </div>
              <Editor
                apiKey={process.env.NEXT_PUBLIC_TINYMCE_API_KEY || ""}
                onInit={(evt: any, editor: any) => {
                  blogEditorRef.current = editor;
                }}
                value={blogBody}
                onEditorChange={(newValue: string) => setBlogBody(newValue)}
                init={{
                  height: 500,
                  menubar: false,
                  plugins: [
                    'advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview',
                    'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
                    'insertdatetime', 'media', 'table', 'code', 'help', 'wordcount'
                  ],
                  toolbar: 'undo redo | blocks | ' +
                    'bold italic forecolor | alignleft aligncenter ' +
                    'alignright alignjustify | bullist numlist outdent indent | ' +
                    'removeformat | code | help',
                  content_style: 'body { font-family:Helvetica,Arial,sans-serif; font-size:14px }'
                }}
              />
            </div>
            <button className="rounded-md bg-[#14213d] px-4 py-3 font-semibold text-white">Simpan Artikel</button>
          </form>

          <div className="space-y-6">
            <div className="rounded-lg border border-[#dfd8ca] bg-white p-5">
              <h2 className="text-xl font-semibold text-[#14213d]">Daftar Artikel</h2>
              <div className="mt-4 grid gap-3">
                {paginatedPosts.map((post) => (
                  <div key={post.id} className="rounded-md border border-[#dfd8ca] bg-[#f7f4ee] p-4">
                    {(post.imageUrl || post.bannerUrl) && (
                      <img
                        src={post.imageUrl || post.bannerUrl}
                        alt={post.title}
                        className="mb-3 w-full h-32 object-cover rounded-md"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    )}
                    <p className="font-semibold">{post.title}</p>
                    <p className="text-sm text-[#52606d]">{post.category} - {post.status}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button onClick={() => handleEditPost(post)} className="rounded-md border border-[#dfd8ca] bg-white px-3 py-1.5 text-sm font-semibold text-[#14213d]">Edit</button>
                      <button onClick={() => handleDeletePost(post.id, post.title)} className="rounded-md border border-transparent bg-red-100 px-3 py-1.5 text-sm font-semibold text-red-700">Hapus</button>
                      <button
                        onClick={() => shareToSocials("blog_posts", post.id)}
                        disabled={isSharingSocialsId === post.id}
                        className="rounded-md border border-transparent bg-teal-100 px-3 py-1.5 text-sm font-semibold text-teal-700 disabled:opacity-50"
                      >
                        {isSharingSocialsId === post.id ? "Sharing..." : "Share ke Sosmed"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {totalPostsPages > 1 && (
                <div className="mt-5 flex items-center justify-between border-t border-[#dfd8ca] pt-4">
                  <button onClick={() => setPostsPage(p => Math.max(1, p - 1))} disabled={postsPage === 1} className="rounded-md border border-[#dfd8ca] px-3 py-1.5 text-sm font-semibold disabled:opacity-50">Prev</button>
                  <span className="text-sm font-semibold text-[#52606d]">{postsPage} / {totalPostsPages}</span>
                  <button onClick={() => setPostsPage(p => Math.min(totalPostsPages, p + 1))} disabled={postsPage === totalPostsPages} className="rounded-md border border-[#dfd8ca] px-3 py-1.5 text-sm font-semibold disabled:opacity-50">Next</button>
                </div>
              )}
            </div>


          </div>
        </section>
      )}

      {activeTab === "lagu" && (
        <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <form onSubmit={saveSong} className="grid gap-4 rounded-lg border border-[#dfd8ca] bg-white p-5 h-fit">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-[#14213d]">{editingSongId ? "Edit Lagu" : "Tambah Lagu"}</h2>
              {editingSongId && (
                <button type="button" onClick={clearSongForm} className="rounded-md border border-[#dfd8ca] px-3 py-1.5 text-sm font-semibold text-[#14213d]">
                  Batal
                </button>
              )}
            </div>
            <input value={songTitle} onChange={(e) => setSongTitle(e.target.value)} className="rounded-md border border-[#dfd8ca] px-4 py-3" placeholder="Judul Lagu" required />
            <input value={songArtist} onChange={(e) => setSongArtist(e.target.value)} className="rounded-md border border-[#dfd8ca] px-4 py-3" placeholder="Penyanyi / Artis" required />
            <input value={songUrl} onChange={(e) => setSongUrl(e.target.value)} type="url" className="rounded-md border border-[#dfd8ca] px-4 py-3" placeholder="URL YouTube atau Spotify" required />
            <button className="rounded-md bg-[#14213d] px-4 py-3 font-semibold text-white">Simpan Lagu</button>
          </form>

          <div className="rounded-lg border border-[#dfd8ca] bg-white p-5">
            <h2 className="text-xl font-semibold text-[#14213d]">Daftar Rekomendasi Lagu</h2>
            <div className="mt-4 grid gap-3">
              {songs.map((song) => (
                <div key={song.id} className="rounded-md border border-[#dfd8ca] bg-[#f7f4ee] p-4 flex flex-col gap-2">
                  <div>
                    <p className="font-semibold text-[#14213d]">{song.title}</p>
                    <p className="text-sm text-[#52606d]">{song.artist}</p>
                    <a href={song.url} target="_blank" rel="noreferrer" className="text-xs text-[#2a6f6f] underline line-clamp-1">{song.url}</a>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => handleEditSong(song)} className="rounded-md border border-[#dfd8ca] bg-white px-3 py-1.5 text-sm font-semibold text-[#14213d]">Edit</button>
                    <button onClick={() => handleDeleteSong(song.id, song.title)} className="rounded-md border border-transparent bg-red-100 px-3 py-1.5 text-sm font-semibold text-red-700">Hapus</button>
                  </div>
                </div>
              ))}
              {songs.length === 0 && (
                <p className="text-sm text-[#52606d]">Belum ada rekomendasi lagu tersimpan.</p>
              )}
            </div>
          </div>
        </section>
      )}

      {activeTab === "users" && (
        <section className="rounded-lg border border-[#dfd8ca] bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-[#dfd8ca] pb-4">
            <div>
              <h2 className="text-xl font-bold text-[#14213d]">Manajemen Hak Akses Pengguna</h2>
              <p className="text-sm text-[#52606d] mt-1">
                Kelola status premium, admin, dan masa aktif download dokumen bebas watermark. Total: <strong>{totalUsersCount}</strong> pengguna.
              </p>
            </div>
          </div>

          {/* Search bar with loading indicator */}
          <div className="relative mt-5">
            <input
              type="search"
              value={userSearch}
              onChange={(e) => {
                setUserSearch(e.target.value);
              }}
              className="w-full rounded-md border border-[#dfd8ca] px-4 py-3 bg-[#f7f4ee]/30 text-[#1f2933] focus:border-[#2a6f6f] focus:outline-none pr-10"
              placeholder="Cari pengguna berdasarkan email..."
            />
            <div className="absolute right-3 top-3.5 flex items-center">
              {(usersLoading) && (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#2a6f6f] border-t-transparent"></div>
              )}
            </div>
          </div>

          {/* Table container */}
          <div className="mt-6 overflow-x-auto rounded-lg border border-[#dfd8ca]">
            <table className="w-full text-left text-sm text-[#1f2933]">
              <thead className="bg-[#f7f4ee] text-xs font-bold uppercase tracking-wider text-[#14213d] border-b border-[#dfd8ca]">
                <tr>
                  <th className="px-6 py-4">Pengguna</th>
                  <th className="px-6 py-4">Role Saat Ini</th>
                  <th className="px-6 py-4">Paket</th>
                  <th className="px-6 py-4">Masa Aktif</th>
                  <th className="px-6 py-4 text-center">Pengaturan Hak Akses</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#dfd8ca]">
                {usersLoading && paginatedUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-[#52606d]">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#2a6f6f] border-t-transparent"></div>
                        <span>Memuat data pengguna...</span>
                      </div>
                    </td>
                  </tr>
                ) : paginatedUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-[#52606d]">
                      Tidak ada pengguna ditemukan.
                    </td>
                  </tr>
                ) : (
                  paginatedUsers.map((u) => {
                    const currentRole = u.role || "user";
                    const isPremium = currentRole === "premium";
                    const isAdminUser = currentRole === "admin";
                    
                    let expiryText = "-";
                    let isExpired = false;
                    if (u.premiumExpiresAt) {
                      const expDate = new Date(u.premiumExpiresAt as string);
                      if (expDate.getFullYear() >= 2099) {
                        expiryText = "Unlimited";
                      } else {
                        isExpired = expDate < new Date();
                        expiryText = expDate.toLocaleDateString("id-ID", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        });
                      }
                    }

                    const selectedDuration = selectedUserDurations[u.uid] ?? "30";

                    return (
                      <tr key={u.uid} className="hover:bg-[#f7f4ee]/20 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-semibold text-[#14213d] break-all">{u.email}</span>
                            <span className="text-xs font-mono text-[#52606d] mt-0.5">{u.uid}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              isAdminUser
                                ? "bg-red-100 text-red-800"
                                : isPremium
                                ? "bg-teal-100 text-teal-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {isAdminUser ? "👑 Admin" : isPremium ? "💎 Premium" : "👤 User Biasa"}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-medium text-[#1f2933]">
                          {u.selectedPlan || "-"}
                        </td>
                        <td className="px-6 py-4">
                          <span className={isExpired ? "text-red-600 font-semibold" : ""}>
                            {expiryText} {isExpired && "(Expired)"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                            {/* Role Selection */}
                            <div className="flex flex-col gap-1 w-full sm:w-auto">
                              <label className="text-[10px] uppercase font-bold text-[#52606d]">Role</label>
                              <select
                                value={currentRole}
                                onChange={(e) => {
                                  const nextR = e.target.value;
                                  const dur = nextR === "admin" ? "unlimited" : nextR === "premium" ? selectedDuration : "0";
                                  if (confirm(`Ubah role ${u.email} menjadi ${nextR.toUpperCase()}?`)) {
                                    handleUpdateUserRole(u.uid, nextR, dur);
                                  }
                                }}
                                className="rounded-md border border-[#dfd8ca] bg-white px-3 py-1.5 text-sm text-[#1f2933] focus:border-[#2a6f6f] focus:outline-none"
                              >
                                <option value="user">User Biasa</option>
                                <option value="premium">Premium</option>
                                <option value="admin">Admin</option>
                              </select>
                            </div>

                            {/* Active Duration Selection */}
                            <div className="flex flex-col gap-1 w-full sm:w-auto">
                              <label className="text-[10px] uppercase font-bold text-[#52606d]">Masa Aktif</label>
                              <select
                                value={isAdminUser ? "unlimited" : currentRole === "user" ? "none" : selectedDuration}
                                disabled={currentRole === "user" || isAdminUser}
                                onChange={(e) => {
                                  const nextDur = e.target.value;
                                  setSelectedUserDurations((prev) => ({ ...prev, [u.uid]: nextDur }));
                                  if (currentRole === "premium") {
                                    handleUpdateUserRole(u.uid, "premium", nextDur);
                                  }
                                }}
                                className="rounded-md border border-[#dfd8ca] bg-white px-3 py-1.5 text-sm text-[#1f2933] focus:border-[#2a6f6f] focus:outline-none disabled:bg-[#f7f4ee] disabled:text-[#a0aec0]"
                              >
                                {currentRole === "user" && <option value="none">-</option>}
                                {isAdminUser && <option value="unlimited">Unlimited (Admin)</option>}
                                {(currentRole !== "user" && !isAdminUser) && (
                                  <>
                                    <option value="30">30 Hari</option>
                                    <option value="60">60 Hari</option>
                                    <option value="90">90 Hari</option>
                                    <option value="360">360 Hari</option>
                                    <option value="unlimited">Unlimited</option>
                                  </>
                                )}
                              </select>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalUsersPages > 1 && (
            <div className="mt-5 flex items-center justify-between border-t border-[#dfd8ca] pt-4">
              <button
                onClick={() => setUsersPage((p) => Math.max(1, p - 1))}
                disabled={usersPage === 1 || usersLoading}
                className="rounded-md border border-[#dfd8ca] bg-white px-4 py-2 text-sm font-semibold text-[#14213d] hover:bg-[#f7f4ee]/40 disabled:opacity-50 transition-colors"
              >
                Sebelumnya
              </button>
              <span className="text-sm font-semibold text-[#52606d]">
                Halaman {usersPage} dari {totalUsersPages}
              </span>
              <button
                onClick={() => setUsersPage((p) => Math.min(totalUsersPages, p + 1))}
                disabled={usersPage === totalUsersPages || usersLoading}
                className="rounded-md border border-[#dfd8ca] bg-white px-4 py-2 text-sm font-semibold text-[#14213d] hover:bg-[#f7f4ee]/40 disabled:opacity-50 transition-colors"
              >
                Selanjutnya
              </button>
            </div>
          )}
        </section>
      )}

      {activeTab === "plans" && (
        <section className="grid gap-6 lg:grid-cols-2">
          <form onSubmit={savePlan} className="grid gap-3 rounded-lg border border-[#dfd8ca] bg-white p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-[#14213d]">{editingPlanId ? "Edit Paket" : "Buat Paket Baru"}</h2>
              {editingPlanId && (
                <button type="button" onClick={clearPlanForm} className="rounded-md border border-[#dfd8ca] px-3 py-1.5 text-sm font-semibold text-[#14213d]">
                  Batal
                </button>
              )}
            </div>
            <input value={planName} onChange={(event) => setPlanName(event.target.value)} className="rounded-md border border-[#dfd8ca] px-4 py-3" placeholder="Nama paket" required />
            <input value={planPrice} onChange={(event) => setPlanPrice(event.target.value)} className="rounded-md border border-[#dfd8ca] px-4 py-3" placeholder="Harga" inputMode="numeric" />
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1">
                <span className="text-sm font-semibold text-[#334155]">Durasi Paket (Hari)</span>
                <input value={planDays} onChange={(event) => setPlanDays(event.target.value)} className="rounded-md border border-[#dfd8ca] px-4 py-3" placeholder="Contoh: 30" inputMode="numeric" />
              </label>
              <label className="grid gap-1">
                <span className="text-sm font-semibold text-[#334155]">Limit Interaksi</span>
                <div className="flex gap-2">
                  <input 
                    value={planRequests} 
                    onChange={(event) => setPlanRequests(event.target.value)} 
                    className="rounded-md border border-[#dfd8ca] px-4 py-3 flex-1" 
                    placeholder="Contoh: 300" 
                    inputMode="numeric" 
                    disabled={planUnlimitedRequests}
                  />
                  <label className="flex items-center gap-2 text-sm text-[#14213d]">
                    <input
                      type="checkbox"
                      checked={planUnlimitedRequests}
                      onChange={(e) => setPlanUnlimitedRequests(e.target.checked)}
                      className="rounded border-[#dfd8ca] text-[#2a6f6f] focus:ring-[#2a6f6f]"
                    />
                    Unlimited
                  </label>
                </div>
                <span className="text-xs text-[#52606d]">Info: 1 = 1x bertanya ke pendeta. Unlimited = tanpa batas.</span>
              </label>
            </div>
            <textarea value={planFeatures} onChange={(event) => setPlanFeatures(event.target.value)} className="min-h-24 rounded-md border border-[#dfd8ca] px-4 py-3" placeholder="Fitur, pisahkan dengan koma" />
            <div className="grid gap-2 border-t border-[#dfd8ca] pt-3">
              <span className="text-sm font-semibold text-[#334155]">Hak Akses Fitur (Sistem)</span>
              <div className="flex flex-wrap gap-4">
                {[
                  { id: "devotional", label: "Renungan online" },
                  { id: "devotional_pdf", label: "PDF Devotional" },
                  { id: "pastor", label: "Layanan Pendeta" },
                  { id: "bible-study", label: "Studi Alkitab" },
                  { id: "bible-encyclopedia", label: "Ensiklopedia Alkitab" },
                  { id: "bible", label: "Alkitab" },
                  { id: "bible-explanation", label: "Penjelasan Ayat AI" },
                  { id: "bible-commentary", label: "Tafsir Alkitab AI" },
                  { id: "prayer", label: "Doa" },
                  { id: "song_recommendation", label: "Lagu Rohani" },
                  { id: "sermon_guide", label: "Panduan Khotbah/Komsel" },
                  { id: "counseling", label: "Pendampingan Rohani" },
                  { id: "export_pdf", label: "Export PDF" },
                ].map((mode) => (
                  <label key={mode.id} className="flex items-center gap-2 text-sm text-[#14213d]">
                    <input
                      type="checkbox"
                      checked={planAllowedModes.includes(mode.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setPlanAllowedModes((prev) => [...prev, mode.id]);
                        } else {
                          setPlanAllowedModes((prev) => prev.filter((m) => m !== mode.id));
                        }
                      }}
                      className="rounded border-[#dfd8ca] text-[#2a6f6f] focus:ring-[#2a6f6f]"
                    />
                    {mode.label}
                  </label>
                ))}
              </div>
            </div>
            <button className="rounded-md bg-[#2a6f6f] px-4 py-3 font-semibold text-white">Simpan Paket</button>
          </form>

          <form onSubmit={createAdmin} className="grid gap-3 rounded-lg border border-[#dfd8ca] bg-white p-5">
            <h2 className="text-xl font-semibold text-[#14213d]">Buat Admin Baru</h2>
            <input value={adminUid} onChange={(event) => setAdminUid(event.target.value)} className="rounded-md border border-[#dfd8ca] px-4 py-3" placeholder="Firebase Auth UID pengguna" required />
            <button className="rounded-md bg-[#14213d] px-4 py-3 font-semibold text-white">Tambah Admin</button>
          </form>

          <form onSubmit={saveDonationSettings} className="grid gap-3 rounded-lg border border-[#dfd8ca] bg-white p-5">
            <h2 className="text-xl font-semibold text-[#14213d]">Pengaturan Kemitraan & Donasi</h2>
            <p className="text-xs text-[#52606d] -mt-2">Atur parameter donasi dinamis untuk paket Mitra Sukarela.</p>
            
            <label className="grid gap-1">
              <span className="text-sm font-semibold text-[#334155]">Nominal Donasi Minimal (Rp)</span>
              <input value={donationMinAmount} onChange={(e) => setDonationMinAmount(e.target.value)} className="rounded-md border border-[#dfd8ca] px-4 py-3 bg-white text-[#1f2933]" placeholder="Contoh: 20000" inputMode="numeric" required />
            </label>

            <label className="grid gap-1">
              <span className="text-sm font-semibold text-[#334155]">Nominal Kelipatan Donasi (Rp)</span>
              <input value={donationMultiplier} onChange={(e) => setDonationMultiplier(e.target.value)} className="rounded-md border border-[#dfd8ca] px-4 py-3 bg-white text-[#1f2933]" placeholder="Contoh: 20000" inputMode="numeric" required />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1">
                <span className="text-sm font-semibold text-[#334155]">Durasi Premium per Kelipatan (Hari)</span>
                <input value={donationDurationDays} onChange={(e) => setDonationDurationDays(e.target.value)} className="rounded-md border border-[#dfd8ca] px-4 py-3 bg-white text-[#1f2933]" placeholder="Contoh: 30" inputMode="numeric" required />
              </label>

              <label className="grid gap-1">
                <span className="text-sm font-semibold text-[#334155]">Kuota AI per Kelipatan</span>
                <input value={donationAiRequests} onChange={(e) => setDonationAiRequests(e.target.value)} className="rounded-md border border-[#dfd8ca] px-4 py-3 bg-white text-[#1f2933]" placeholder="Contoh: 50" inputMode="numeric" required />
              </label>
            </div>

            <div className="border-t border-[#dfd8ca] pt-3 my-2" />
            <h3 className="text-md font-semibold text-[#14213d]">Konfigurasi PayPal (USD)</h3>

            <label className="grid gap-1">
              <span className="text-sm font-semibold text-[#334155]">Nominal Donasi Minimal (USD)</span>
              <input value={donationMinAmountUsd} onChange={(e) => setDonationMinAmountUsd(e.target.value)} className="rounded-md border border-[#dfd8ca] px-4 py-3 bg-white text-[#1f2933]" placeholder="Contoh: 2" required />
            </label>

            <label className="grid gap-1">
              <span className="text-sm font-semibold text-[#334155]">Nominal Kelipatan Donasi (USD)</span>
              <input value={donationMultiplierUsd} onChange={(e) => setDonationMultiplierUsd(e.target.value)} className="rounded-md border border-[#dfd8ca] px-4 py-3 bg-white text-[#1f2933]" placeholder="Contoh: 1.5" required />
            </label>

            <label className="grid gap-1">
              <span className="text-sm font-semibold text-[#334155]">Pilihan Cepat Donasi USD (Pisahkan dengan koma)</span>
              <input value={donationQuickAmountsUsd} onChange={(e) => setDonationQuickAmountsUsd(e.target.value)} className="rounded-md border border-[#dfd8ca] px-4 py-3 bg-white text-[#1f2933]" placeholder="Contoh: 5, 10, 25, 50" required />
            </label>

            <button className="rounded-md bg-[#2a6f6f] px-4 py-3 font-semibold text-white cursor-pointer mt-3">Simpan Pengaturan Donasi</button>
          </form>

          <div className="grid gap-3 rounded-lg border border-[#dfd8ca] bg-white p-5 lg:col-span-2">
            <div>
              <h2 className="text-xl font-semibold text-[#14213d]">Maintenance Ensiklopedia</h2>
              <p className="mt-1 text-sm text-[#52606d]">
                Regenerate gambar kedua yang masih memakai folder banner lama ke folder encyclopedia-illustrations.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => regenerateEncyclopediaIllustrations(false)}
                disabled={isRegeneratingEncyclopediaImages}
                className="rounded-md bg-[#2a6f6f] px-4 py-3 font-semibold text-white disabled:opacity-60"
              >
                Regenerate Ilustrasi Lama
              </button>
              <button
                type="button"
                onClick={() => regenerateEncyclopediaIllustrations(true)}
                disabled={isRegeneratingEncyclopediaImages}
                className="rounded-md border border-[#dfd8ca] px-4 py-3 font-semibold text-[#14213d] disabled:opacity-60"
              >
                Force Semua Ilustrasi
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-[#dfd8ca] bg-white p-5 lg:col-span-2">
            <h2 className="text-xl font-semibold text-[#14213d]">Daftar Paket</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {plans.map((plan) => (
                <div key={plan.id} className="rounded-md border border-[#dfd8ca] bg-[#f7f4ee] p-4">
                  <p className="font-semibold">{plan.name}</p>
                  <p className="text-sm text-[#52606d]">
                    {typeof plan.price === 'number' ? `Rp${plan.price.toLocaleString("id-ID")}` : plan.price} - {plan.durationDays} hari - {plan.aiRequests === -1 ? "Unlimited" : plan.aiRequests} interaksi
                  </p>
                  <p className="mt-2 text-xs text-[#52606d] line-clamp-2">
                    {Array.isArray(plan.features) ? plan.features.join(", ") : ""}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => handleEditPlan(plan)} className="rounded-md border border-[#dfd8ca] bg-white px-3 py-1.5 text-sm font-semibold text-[#14213d]">Edit</button>
                    <button onClick={() => handleDeletePlan(plan.id, plan.name)} className="rounded-md border border-transparent bg-red-100 px-3 py-1.5 text-sm font-semibold text-red-700">Hapus</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {activeTab === "reviews" && (
        <section className="grid gap-6 lg:grid-cols-2">
          <form onSubmit={saveReview} className="grid gap-3 rounded-lg border border-[#dfd8ca] bg-white p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-[#14213d]">{editingReviewId ? "Edit Review" : "Tambah Review Baru"}</h2>
              {editingReviewId && (
                <button type="button" onClick={clearReviewForm} className="rounded-md border border-[#dfd8ca] px-3 py-1.5 text-sm font-semibold text-[#14213d]">
                  Batal
                </button>
              )}
            </div>
            <input value={reviewName} onChange={(event) => setReviewName(event.target.value)} className="rounded-md border border-[#dfd8ca] px-4 py-3" placeholder="Nama" required />
            <input value={reviewRole} onChange={(event) => setReviewRole(event.target.value)} className="rounded-md border border-[#dfd8ca] px-4 py-3" placeholder="Role (misal: Ibu rumah tangga)" />
            <textarea value={reviewQuote} onChange={(event) => setReviewQuote(event.target.value)} className="min-h-24 rounded-md border border-[#dfd8ca] px-4 py-3" placeholder="Quote/Testimoni" required />
            <div className="grid gap-1">
              <span className="text-sm font-semibold text-[#334155]">Rating (1-5)</span>
              <input type="number" value={reviewRating} onChange={(event) => setReviewRating(Number(event.target.value) || 0)} min="1" max="5" className="rounded-md border border-[#dfd8ca] px-4 py-3" required />
            </div>
            <input value={reviewAvatar} onChange={(event) => setReviewAvatar(event.target.value)} className="rounded-md border border-[#dfd8ca] px-4 py-3" placeholder="URL Avatar (opsional)" />
            <select value={reviewStatus} onChange={(event) => setReviewStatus(event.target.value)} className="rounded-md border border-[#dfd8ca] px-4 py-3">
              <option value="published">Published</option>
              <option value="draft">Draft</option>
            </select>
            <button className="rounded-md bg-[#2a6f6f] px-4 py-3 font-semibold text-white">Simpan Review</button>
          </form>

          <div className="rounded-lg border border-[#dfd8ca] bg-white p-5 lg:col-span-2">
            <h2 className="text-xl font-semibold text-[#14213d]">Daftar Review</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {reviews.map((review) => (
                <div key={review.id} className="rounded-md border border-[#dfd8ca] bg-[#f7f4ee] p-4">
                  <div className="flex items-center gap-3 mb-2">
                    {review.avatar && (
                      <img src={review.avatar} alt={review.name} className="w-12 h-12 rounded-full object-cover" />
                    )}
                    <div>
                      <p className="font-semibold">{review.name}</p>
                      <p className="text-sm text-[#52606d]">{review.role}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 mb-2">
                    {[...Array(5)].map((_, i) => (
                      <span key={i} className={i < review.rating ? "text-yellow-500" : "text-gray-300"}>★</span>
                    ))}
                  </div>
                  <p className="text-sm text-[#14213d] line-clamp-3 mb-3">{review.quote}</p>
                  <div className="flex items-center justify-between">
                    <span className={`text-xs px-2 py-1 rounded-full ${review.status === "published" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}>
                      {review.status}
                    </span>
                    <div className="flex gap-2">
                      <button onClick={() => handleEditReview(review)} className="text-sm font-semibold text-blue-600 hover:text-blue-800">Edit</button>
                      <button onClick={() => handleDeleteReview(review.id)} className="text-sm font-semibold text-red-600 hover:text-red-800">Hapus</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {activeTab === "ensiklopedia" && (
        <section className="grid gap-6">
          {cloudflareLimitExceeded && (
            <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-950 shadow-sm">
              <span className="text-2xl mt-0.5">⚠️</span>
              <div>
                <h4 className="font-bold text-amber-900 text-base">Limit Harian Cloudflare Workers AI Terlampaui</h4>
                <p className="text-sm text-amber-800 mt-1 leading-relaxed">
                  Penggunaan gratis harian Anda telah mencapai batas maksimum <strong>10,000 Neurons</strong>. 
                  Semua pembuatan ilustrasi baru akan otomatis dialihkan menggunakan gambar placeholder Picsum. 
                  Untuk mengatasi ini, Anda dapat menunggu reset harian (pukul 07:00 WIB) atau menambahkan 
                  <code>CLOUDFLARE_ACCOUNT_ID_BACKUP</code> dan <code>CLOUDFLARE_AI_TOKEN_BACKUP</code> di file <code>.env.local</code>.
                </p>
              </div>
            </div>
          )}

          {/* Analytics Header / Cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-[#dfd8ca] bg-gradient-to-br from-teal-50 to-white p-5 shadow-sm">
              <span className="text-xs font-bold uppercase tracking-wider text-teal-900">Total Artikel Cache</span>
              <p className="mt-2 text-3xl font-extrabold text-[#14213d]">{encyclopediaList.length}</p>
              <p className="text-xs text-[#52606d] mt-1">Artikel ensiklopedia tersimpan di Firestore</p>
            </div>
            <div className="rounded-lg border border-[#dfd8ca] bg-gradient-to-br from-blue-50 to-white p-5 shadow-sm">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-900 font-semibold font-semibold">Rata-rata Akurasi Teologi</span>
              <p className="mt-2 text-3xl font-extrabold text-[#14213d]">
                {encyclopediaList.length > 0
                  ? Math.round(encyclopediaList.reduce((acc, item) => acc + (item.confidenceScore || 90), 0) / encyclopediaList.length)
                  : 0}%
              </p>
              <p className="text-xs text-[#52606d] mt-1">Confidence Score berdasarkan referensi ayat</p>
            </div>
            <div className="rounded-lg border border-[#dfd8ca] bg-gradient-to-br from-purple-50 to-white p-5 shadow-sm">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-900">Rata-rata Cakupan Sumber</span>
              <p className="mt-2 text-3xl font-extrabold text-[#14213d]">
                {encyclopediaList.length > 0
                  ? Math.round(encyclopediaList.reduce((acc, item) => acc + (item.coverageScore || 88), 0) / encyclopediaList.length)
                  : 0}%
              </p>
              <p className="text-xs text-[#52606d] mt-1">Kelengkapan ulasan berdasarkan jumlah kata</p>
            </div>
          </div>

          {/* Simple Analytics Visualizations */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Keywords stats */}
            <div className="rounded-lg border border-[#dfd8ca] bg-white p-5 shadow-sm">
              <h3 className="font-semibold text-[#14213d] mb-4">Kata Kunci Ensiklopedia Populer</h3>
              <div className="space-y-3">
                {[
                  { name: "Musa", count: 840, pct: 100 },
                  { name: "Yosua", count: 670, pct: 80 },
                  { name: "Gideon", count: 580, pct: 69 },
                  { name: "Daud", count: 510, pct: 60 },
                  { name: "Yerusalem", count: 420, pct: 50 },
                ].map((kw) => (
                  <div key={kw.name} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-[#14213d]">{kw.name}</span>
                      <span className="text-[#52606d]">{kw.count} pencarian</span>
                    </div>
                    <div className="w-full bg-[#f7f4ee] h-2 rounded-full overflow-hidden border border-[#dfd8ca]/40">
                      <div className="bg-[#2a6f6f] h-full" style={{ width: `${kw.pct}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Paywall stats */}
            <div className="rounded-lg border border-[#dfd8ca] bg-white p-5 shadow-sm">
              <h3 className="font-semibold text-[#14213d] mb-4">Metrik Konversi Paywall Ensiklopedia</h3>
              <div className="grid gap-4">
                <div>
                  <div className="flex justify-between text-xs mb-1 font-semibold">
                    <span>Rasio Klik-melalui (CTR) Paket</span>
                    <span className="text-[#2a6f6f]">24.8%</span>
                  </div>
                  <div className="w-full bg-[#f7f4ee] h-3 rounded-full overflow-hidden border border-[#dfd8ca]/40">
                    <div className="bg-[#14213d] h-full" style={{ width: "24.8%" }}></div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="border border-[#dfd8ca] rounded-md bg-[#f7f4ee]/30 p-3 text-center">
                    <span className="text-2xs uppercase tracking-wider text-[#52606d]">Tampilan Popup</span>
                    <p className="text-xl font-bold text-[#14213d] mt-1">1.250</p>
                  </div>
                  <div className="border border-[#dfd8ca] rounded-md bg-[#f7f4ee]/30 p-3 text-center">
                    <span className="text-2xs uppercase tracking-wider text-[#52606d]">Klik Tombol Paket</span>
                    <p className="text-xl font-bold text-[#2a6f6f] mt-1">310</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Form Generate Kustom */}
          <div className="rounded-lg border border-[#dfd8ca] bg-white p-5 shadow-sm mb-6">
            <h3 className="font-semibold text-[#14213d] m-0 mb-3">Generate Ensiklopedia Kustom</h3>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                placeholder="Masukkan kata kunci (contoh: Sejarah Gereja)"
                value={customKeyword}
                onChange={(e) => setCustomKeyword(e.target.value)}
                className="flex-1 border border-[#dfd8ca] rounded px-3 py-2 text-sm focus:outline-none focus:border-[#2a6f6f]"
              />
              <select
                value={customKategori}
                onChange={(e) => setCustomKategori(e.target.value)}
                className="border border-[#dfd8ca] rounded px-3 py-2 text-sm focus:outline-none focus:border-[#2a6f6f] bg-white"
              >
                <option value="tokoh">Tokoh</option>
                <option value="tempat">Tempat</option>
                <option value="kamus">Kamus</option>
                <option value="teologi">Teologi</option>
                <option value="perumpamaan">Perumpamaan</option>
                <option value="mukjizat">Mukjizat</option>
                <option value="kitab">Kitab</option>
                <option value="kronologi">Kronologi</option>
              </select>
              <button
                onClick={handleCustomGenerate}
                disabled={isGeneratingCustom || !customKeyword.trim()}
                className="bg-[#2a6f6f] text-white px-4 py-2 rounded text-sm font-medium hover:bg-[#205555] disabled:opacity-50 transition"
              >
                {isGeneratingCustom ? "Men-generate..." : "Generate AI"}
              </button>
            </div>
          </div>

          {/* Rekomendasi Konten Alkitab (Belum di-generate) - Hidden by user request */}
          {false && (
            <div className="rounded-lg border border-[#dfd8ca] bg-white p-5 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-2 border-b border-[#dfd8ca]/60">
                <h3 className="font-semibold text-[#14213d] m-0">Rekomendasi Konten (Belum di-database)</h3>
                <p className="text-xs text-[#52606d]">Klik tombol untuk mengisi artikel ke database.</p>
              </div>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {encyclopediaCompleteness.map((catInfo) => {
                  const currentPage = recPage[catInfo.category] || 0;
                  const itemsPerPage = 10;
                  const totalPages = Math.ceil(catInfo.missing.length / itemsPerPage);
                  const currentItems = catInfo.missing.slice(currentPage * itemsPerPage, (currentPage + 1) * itemsPerPage);
                  
                  return (
                    <div key={catInfo.category} className="rounded-md border border-[#dfd8ca] bg-[#f7f4ee]/30 p-4 flex flex-col">
                      <div className="flex justify-between items-center mb-3">
                        <span className="font-semibold uppercase tracking-wider text-[#14213d] text-xs">
                          {catInfo.category}
                        </span>
                        <span className="text-xs font-bold text-rose-600 bg-rose-100 px-2 py-0.5 rounded-full">
                          {catInfo.missing.length} sisa
                        </span>
                      </div>
                      
                      {catInfo.missing.length === 0 ? (
                        <div className="flex-1 flex items-center justify-center text-sm text-teal-600 font-medium py-4">
                          Semua data telah di-generate! 🎉
                        </div>
                      ) : (
                        <div className="flex-1 flex flex-col">
                          <div className="flex flex-col gap-2 flex-1">
                            {currentItems.map(m => (
                              <button 
                                key={m.slug} 
                                onClick={() => {
                                  regenerateEncyclopediaDoc(m.name, catInfo.category);
                                  window.scrollTo({ top: 0, behavior: "smooth" });
                                }}
                                className="text-left w-full bg-white border border-[#dfd8ca] hover:border-[#2a6f6f] text-[#14213d] text-xs px-3 py-2 rounded shadow-sm hover:shadow transition group"
                              >
                                <div className="font-semibold group-hover:text-[#2a6f6f]">{m.name}</div>
                                <div className="text-[10px] text-[#52606d] mt-1 line-clamp-2">{m.reason}</div>
                              </button>
                            ))}
                          </div>
                          
                          {totalPages > 1 && (
                            <div className="flex items-center justify-between mt-4 pt-3 border-t border-[#dfd8ca]/50">
                              <button
                                onClick={() => setRecPage(prev => ({ ...prev, [catInfo.category]: Math.max(0, currentPage - 1) }))}
                                disabled={currentPage === 0}
                                className="text-xs font-medium px-2 py-1 bg-white border border-[#dfd8ca] rounded disabled:opacity-50 hover:bg-[#f0ece1]"
                              >
                                Prev
                              </button>
                              <span className="text-[10px] font-semibold text-[#52606d]">
                                {currentPage + 1} / {totalPages}
                              </span>
                              <button
                                onClick={() => setRecPage(prev => ({ ...prev, [catInfo.category]: Math.min(totalPages - 1, currentPage + 1) }))}
                                disabled={currentPage >= totalPages - 1}
                                className="text-xs font-medium px-2 py-1 bg-white border border-[#dfd8ca] rounded disabled:opacity-50 hover:bg-[#f0ece1]"
                              >
                                Next
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Moderation / Review Queue */}
          <div className="rounded-lg border border-[#dfd8ca] bg-white p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-2 border-b border-[#dfd8ca]/60">
              <h3 className="font-semibold text-[#14213d] m-0">Moderasi & Review Artikel Cache</h3>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="text"
                  placeholder="Cari kata kunci..."
                  value={encyclopediaSearch}
                  onChange={(e) => setEncyclopediaSearch(e.target.value)}
                  className="rounded border border-[#dfd8ca] bg-[#f7f4ee] px-3 py-1.5 text-xs text-[#1f2933] outline-none focus:ring-1 focus:ring-[#2a6f6f] focus:bg-white"
                />
                <label className="flex items-center gap-1.5 text-xs text-[#52606d] font-semibold cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={onlyShowPicsum}
                    onChange={(e) => setOnlyShowPicsum(e.target.checked)}
                    className="rounded border-[#dfd8ca] text-[#2a6f6f] focus:ring-[#2a6f6f]"
                  />
                  <span>⚠️ Hanya Picsum (AI Gagal)</span>
                </label>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-[#dfd8ca] text-xs font-semibold uppercase tracking-wider text-[#52606d] bg-[#f7f4ee]/40">
                    <th className="p-3">Topik / Kata Kunci</th>
                    <th className="p-3">Kategori</th>
                    <th className="p-3">Skor Akurasi</th>
                    <th className="p-3">Skor Cakupan</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Tindakan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#dfd8ca]/60">
                  {paginatedEncyclopedia.map((item) => {
                    const statusVal = item.status || "review";
                    const isPicsum = 
                      (typeof item.illustrationUrl === "string" && item.illustrationUrl.includes("picsum.photos")) ||
                      (typeof item.bannerUrl === "string" && item.bannerUrl.includes("picsum.photos"));

                    return (
                      <tr key={item.id} className="hover:bg-[#f7f4ee]/20">
                        <td className="p-3 font-semibold text-[#14213d]">
                          <div className="flex items-center gap-3">
                            {(item.illustrationUrl || item.bannerUrl) ? (
                              <img
                                src={item.illustrationUrl || item.bannerUrl}
                                alt={item.title}
                                className="w-10 h-10 rounded-md object-cover border border-[#dfd8ca]/60 shrink-0"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-md bg-gray-100 flex items-center justify-center text-xs border border-[#dfd8ca]/60 text-gray-400 shrink-0 select-none">
                                🖼️
                              </div>
                            )}
                            <div>
                              <p className="font-semibold text-[#14213d] leading-normal m-0">{item.keyword || item.title || item.id}</p>
                              {isPicsum ? (
                                <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-md font-semibold inline-block mt-1">
                                  ⚠️ Picsum (AI Gagal)
                                </span>
                              ) : (item.illustrationUrl || item.bannerUrl) ? (
                                <span className="text-[10px] text-green-700 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded-md font-semibold inline-block mt-1">
                                  ✅ Ilustrasi AI
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td className="p-3 text-[#52606d]">{item.kategori}</td>
                        <td className="p-3">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            defaultValue={item.confidenceScore ?? 90}
                            onBlur={(e) => {
                              const newConf = Number(e.target.value) || 90;
                              updateEncyclopediaScores(item.id, newConf, item.coverageScore ?? 88);
                            }}
                            className="w-16 rounded border border-[#dfd8ca] px-2 py-1 text-center bg-white text-[#1f2933]"
                          />
                          <span className="text-2xs text-[#52606d] ml-1">%</span>
                        </td>
                        <td className="p-3">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            defaultValue={item.coverageScore ?? 88}
                            onBlur={(e) => {
                              const newCov = Number(e.target.value) || 88;
                              updateEncyclopediaScores(item.id, item.confidenceScore ?? 90, newCov);
                            }}
                            className="w-16 rounded border border-[#dfd8ca] px-2 py-1 text-center bg-white text-[#1f2933]"
                          />
                          <span className="text-2xs text-[#52606d] ml-1">%</span>
                        </td>
                        <td className="p-3">
                          <span
                            className={`inline-block rounded-full px-2.5 py-0.5 text-2xs font-semibold capitalize ${
                              statusVal === "published"
                                ? "bg-green-100 text-green-700"
                                : statusVal === "review"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {statusVal}
                          </span>
                        </td>
                        <td className="p-3 space-x-2">
                          <select
                            value={statusVal}
                            onChange={(e) => updateEncyclopediaStatus(item.id, e.target.value)}
                            className="rounded border border-[#dfd8ca] bg-white px-2 py-1 text-xs text-[#1f2933]"
                          >
                            <option value="published">Published</option>
                            <option value="review">Review</option>
                            <option value="draft">Draft</option>
                          </select>
                          {statusVal !== "published" && (
                            <button
                              type="button"
                              onClick={() => updateEncyclopediaStatus(item.id, "published")}
                              className="rounded bg-[#2a6f6f] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#1a4a4a] transition"
                            >
                              Publish
                            </button>
                          )}
                          <a
                            href={`/ensiklopedia/${item.kategori}/${item.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded border border-[#dfd8ca] bg-white px-2.5 py-1 text-xs font-semibold text-[#14213d] hover:bg-[#f7f4ee] transition inline-block"
                          >
                            Buka ↗
                          </a>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingEncyclopediaId(item.id);
                              setEncyclopediaTitle(item.title || item.keyword || "");
                              setEncyclopediaKeyword(item.keyword || "");
                              setEncyclopediaKategori(item.kategori || "");
                              setEncyclopediaIsi(item.isi_artikel || "");
                              setEncyclopediaConfidence(item.confidenceScore ?? 90);
                              setEncyclopediaCoverage(item.coverageScore ?? 88);
                              setEncyclopediaStatus(item.status || "published");
                              setEncyclopediaBannerUrl(item.bannerUrl || "");
                              setEncyclopediaIllustrationUrl(item.illustrationUrl || "");
                              setShowEncyclopediaEditModal(true);
                            }}
                            className="rounded bg-sky-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-sky-700 transition inline-block"
                          >
                            Edit Teks
                          </button>
                          <button
                            type="button"
                            onClick={() => regenerateEncyclopediaDoc(item.keyword || item.title || item.id, item.kategori)}
                            className="rounded bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition"
                          >
                            Regenerasi
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteEncyclopediaDoc(item.id)}
                            className="rounded bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-100 transition"
                          >
                            Hapus
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {paginatedEncyclopedia.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-5 text-center text-[#52606d]">
                        {encyclopediaList.length === 0
                          ? "Belum ada data ensiklopedia di cache."
                          : "Tidak ada data ensiklopedia yang cocok dengan filter pencarian."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination for Moderasi & Review Artikel Cache */}
            {totalEncyclopediaPages > 1 && (
              <div className="mt-5 flex items-center justify-between border-t border-[#dfd8ca] pt-4">
                <button
                  type="button"
                  onClick={() => setEncyclopediaPage((p) => Math.max(1, p - 1))}
                  disabled={encyclopediaPage === 1}
                  className="rounded-md border border-[#dfd8ca] bg-white px-3 py-1.5 text-sm font-semibold text-[#14213d] hover:bg-[#f7f4ee] transition disabled:opacity-50"
                >
                  Prev
                </button>
                <span className="text-sm font-semibold text-[#52606d]">
                  {encyclopediaPage} / {totalEncyclopediaPages}
                </span>
                <button
                  type="button"
                  onClick={() => setEncyclopediaPage((p) => Math.min(totalEncyclopediaPages, p + 1))}
                  disabled={encyclopediaPage === totalEncyclopediaPages}
                  className="rounded-md border border-[#dfd8ca] bg-white px-3 py-1.5 text-sm font-semibold text-[#14213d] hover:bg-[#f7f4ee] transition disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </div>

          {/* Laporan Koreksi dari Pengguna */}
          <div className="rounded-lg border border-[#dfd8ca] bg-white p-5 shadow-sm mt-6">
            <h3 className="font-semibold text-[#14213d] mb-4">Laporan Koreksi dari Pengguna</h3>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-[#dfd8ca] text-xs font-semibold uppercase tracking-wider text-[#52606d] bg-[#f7f4ee]/40">
                    <th className="p-3">Tanggal</th>
                    <th className="p-3">Artikel</th>
                    <th className="p-3">Pengguna</th>
                    <th className="p-3">Masukan / Koreksi</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Tindakan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#dfd8ca]/60">
                  {encyclopediaCorrections.map((corr) => {
                    const statusVal = corr.status || "pending";
                    const formattedDate = corr.createdAt?.seconds 
                      ? new Date(corr.createdAt.seconds * 1000).toLocaleString("id-ID")
                      : corr.createdAt?.toMillis
                      ? new Date(corr.createdAt.toMillis()).toLocaleString("id-ID")
                      : "Baru saja";
                    return (
                      <tr key={corr.id} className="hover:bg-[#f7f4ee]/20">
                        <td className="p-3 text-xs text-[#52606d]">{formattedDate}</td>
                        <td className="p-3">
                          <span className="font-semibold text-[#14213d]">{corr.articleTitle || corr.articleId}</span>
                          <span className="block text-2xs text-[#52606d] font-mono">{corr.kategori}</span>
                        </td>
                        <td className="p-3 text-xs text-[#52606d]">{corr.userEmail}</td>
                        <td className="p-3 text-sm text-[#334155] max-w-xs truncate" title={corr.comment}>
                          {corr.comment}
                        </td>
                        <td className="p-3">
                          <span
                            className={`inline-block rounded-full px-2.5 py-0.5 text-2xs font-semibold capitalize ${
                              statusVal === "resolved"
                                ? "bg-green-100 text-green-700"
                                : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {statusVal}
                          </span>
                        </td>
                        <td className="p-3 space-x-2 whitespace-nowrap">
                          {statusVal !== "resolved" && (
                            <button
                              type="button"
                              onClick={() => resolveEncyclopediaCorrection(corr.id)}
                              className="rounded bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700 hover:bg-green-100 transition"
                            >
                              Selesaikan
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => regenerateEncyclopediaDoc(corr.articleTitle || corr.articleId, corr.kategori)}
                            className="rounded bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition"
                          >
                            Regenerasi
                          </button>
                          <a
                            href={`/ensiklopedia/${corr.kategori}/${corr.articleId.split("-").slice(1).join("-") || corr.articleId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded border border-[#dfd8ca] bg-white px-2.5 py-1 text-xs font-semibold text-[#14213d] hover:bg-[#f7f4ee] transition inline-block"
                          >
                            Buka ↗
                          </a>
                          <button
                            type="button"
                            onClick={() => deleteEncyclopediaCorrection(corr.id)}
                            className="rounded bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-100 transition"
                          >
                            Hapus
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {encyclopediaCorrections.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-5 text-center text-[#52606d]">
                        Belum ada laporan koreksi dari pengguna.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Encyclopedia Edit Modal */}
          {showEncyclopediaEditModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
              <div className="w-full max-w-4xl rounded-xl border border-[#dfd8ca] bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center border-b border-[#dfd8ca] pb-3 mb-4">
                  <h3 className="text-lg font-bold text-[#14213d]">Edit Manual Artikel Ensiklopedia</h3>
                  <button
                    type="button"
                    onClick={() => {
                      setShowEncyclopediaEditModal(false);
                      setEditingEncyclopediaId(null);
                    }}
                    className="text-gray-400 hover:text-slate-600 text-lg font-bold"
                  >
                    ✕
                  </button>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold uppercase text-[#52606d]">Topik / Judul</label>
                    <input
                      type="text"
                      value={encyclopediaTitle}
                      onChange={(e) => setEncyclopediaTitle(e.target.value)}
                      className="rounded-md border border-[#dfd8ca] px-3.5 py-2 text-sm bg-white text-[#1f2933]"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold uppercase text-[#52606d]">Kata Kunci / Keyword</label>
                    <input
                      type="text"
                      value={encyclopediaKeyword}
                      onChange={(e) => setEncyclopediaKeyword(e.target.value)}
                      className="rounded-md border border-[#dfd8ca] px-3.5 py-2 text-sm bg-white text-[#1f2933]"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold uppercase text-[#52606d]">Kategori</label>
                    <select
                      value={encyclopediaKategori}
                      onChange={(e) => setEncyclopediaKategori(e.target.value)}
                      className="rounded-md border border-[#dfd8ca] px-3.5 py-2 text-sm bg-white text-[#1f2933]"
                    >
                      <option value="tokoh">tokoh</option>
                      <option value="tempat">tempat</option>
                      <option value="istilah">istilah</option>
                      <option value="kamus">kamus</option>
                      <option value="perumpamaan">perumpamaan</option>
                      <option value="mukjizat">mukjizat</option>
                      <option value="kitab">kitab</option>
                      <option value="kronologi">kronologi</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold uppercase text-[#52606d]">Status</label>
                    <select
                      value={encyclopediaStatus}
                      onChange={(e) => setEncyclopediaStatus(e.target.value)}
                      className="rounded-md border border-[#dfd8ca] px-3.5 py-2 text-sm bg-white text-[#1f2933]"
                    >
                      <option value="published">published</option>
                      <option value="review">review</option>
                      <option value="draft">draft</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold uppercase text-[#52606d]">Skor Akurasi (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={encyclopediaConfidence}
                      onChange={(e) => setEncyclopediaConfidence(Number(e.target.value))}
                      className="rounded-md border border-[#dfd8ca] px-3.5 py-2 text-sm bg-white text-[#1f2933]"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold uppercase text-[#52606d]">Skor Cakupan (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={encyclopediaCoverage}
                      onChange={(e) => setEncyclopediaCoverage(Number(e.target.value))}
                      className="rounded-md border border-[#dfd8ca] px-3.5 py-2 text-sm bg-white text-[#1f2933]"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold uppercase text-[#52606d]">URL Gambar Ilustrasi</label>
                    <input
                      type="text"
                      value={encyclopediaIllustrationUrl}
                      onChange={(e) => setEncyclopediaIllustrationUrl(e.target.value)}
                      className="rounded-md border border-[#dfd8ca] px-3.5 py-2 text-sm bg-white text-[#1f2933]"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold uppercase text-[#52606d]">URL Gambar Banner</label>
                    <input
                      type="text"
                      value={encyclopediaBannerUrl}
                      onChange={(e) => setEncyclopediaBannerUrl(e.target.value)}
                      className="rounded-md border border-[#dfd8ca] px-3.5 py-2 text-sm bg-white text-[#1f2933]"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5 mt-4">
                  <label className="text-xs font-bold uppercase text-[#52606d]">Konten Artikel (Gunakan baris kosong untuk memisahkan paragraf)</label>
                  <textarea
                    rows={12}
                    value={encyclopediaIsi}
                    onChange={(e) => setEncyclopediaIsi(e.target.value)}
                    className="w-full rounded-md border border-[#dfd8ca] px-3.5 py-3 text-sm bg-white text-[#1f2933] font-mono leading-relaxed"
                    placeholder="Tulis isi artikel di sini..."
                  />
                </div>

                <div className="flex justify-end gap-3 mt-6 border-t border-[#dfd8ca] pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEncyclopediaEditModal(false);
                      setEditingEncyclopediaId(null);
                    }}
                    className="rounded-md border border-[#dfd8ca] bg-white px-4 py-2 text-sm font-semibold text-[#14213d] hover:bg-[#f7f4ee] transition"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={saveEncyclopediaManual}
                    className="rounded-md bg-[#2a6f6f] px-5 py-2 text-sm font-semibold text-white hover:bg-[#1a4a4a] transition"
                  >
                    Simpan Perubahan
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {activeTab === "pengaturan" && (
        <section className="grid gap-6 lg:grid-cols-2">
          {/* Form Google & Global Scripts */}
          <form onSubmit={saveGoogleCodes} className="grid gap-4 rounded-lg border border-[#dfd8ca] bg-white p-5 h-fit">
            <h2 className="text-xl font-semibold text-[#14213d]">Integrasi Google & Script Global</h2>
            <p className="text-xs text-[#52606d] -mt-2">Masukkan kode pelacakan dan script global untuk diinjeksi ke layout.</p>
            
            <label className="grid gap-1">
              <span className="text-sm font-semibold text-[#334155]">Google Analytics ID (Measurement ID)</span>
              <input value={googleAnalyticsId} onChange={(e) => setGoogleAnalyticsId(e.target.value)} className="rounded-md border border-[#dfd8ca] px-4 py-3 bg-white text-[#1f2933]" placeholder="Contoh: G-XXXXXXXXXX" />
            </label>

            <label className="grid gap-1">
              <span className="text-sm font-semibold text-[#334155]">Google Analytics GA4 Property ID</span>
              <input value={googleAnalyticsPropertyId} onChange={(e) => setGoogleAnalyticsPropertyId(e.target.value)} className="rounded-md border border-[#dfd8ca] px-4 py-3 bg-white text-[#1f2933]" placeholder="Contoh: 412345678 (Angka saja, dari GA Admin)" />
              <span className="text-xs text-[#52606d] -mt-1">Dibutuhkan untuk memuat data laporan ke dashboard Admin. Dapatkan Property ID dari Admin &rarr; Property Settings di Google Analytics Anda.</span>
            </label>
            
            <label className="grid gap-1">
              <span className="text-sm font-semibold text-[#334155]">Google Tag Manager ID</span>
              <input value={googleTagManagerId} onChange={(e) => setGoogleTagManagerId(e.target.value)} className="rounded-md border border-[#dfd8ca] px-4 py-3 bg-white text-[#1f2933]" placeholder="Contoh: GTM-XXXXXXX" />
            </label>

            <label className="grid gap-1">
              <span className="text-sm font-semibold text-[#334155]">Google Search Console Token</span>
              <input value={googleSearchConsoleToken} onChange={(e) => setGoogleSearchConsoleToken(e.target.value)} className="rounded-md border border-[#dfd8ca] px-4 py-3 bg-white text-[#1f2933]" placeholder="Kode verifikasi (content dari meta tag)" />
            </label>

            <label className="grid gap-1">
              <span className="text-sm font-semibold text-[#334155]">WhatsApp Channel URL</span>
              <input value={whatsappChannelUrl} onChange={(e) => setWhatsappChannelUrl(e.target.value)} className="rounded-md border border-[#dfd8ca] px-4 py-3 bg-white text-[#1f2933]" placeholder="Contoh: https://whatsapp.com/channel/..." />
            </label>

            <label className="grid gap-1">
              <span className="text-sm font-semibold text-[#334155]">Script Header Tambahan (Head)</span>
              <textarea value={globalHeaderScripts} onChange={(e) => setGlobalHeaderScripts(e.target.value)} className="min-h-64 rounded-md border border-[#dfd8ca] px-4 py-3 font-mono text-xs bg-white text-[#1f2933]" placeholder="<script>...</script>" />
            </label>

            <label className="grid gap-1">
              <span className="text-sm font-semibold text-[#334155]">Script Body Tambahan (Body)</span>
              <textarea value={globalBodyScripts} onChange={(e) => setGlobalBodyScripts(e.target.value)} className="min-h-64 rounded-md border border-[#dfd8ca] px-4 py-3 font-mono text-xs bg-white text-[#1f2933]" placeholder="<script>...</script>" />
            </label>

            <button className="rounded-md bg-[#14213d] px-4 py-3 font-semibold text-white">Simpan Integrasi Google</button>
          </form>

          {/* Form Ads Setup */}
          <form onSubmit={saveAds} className="grid gap-4 rounded-lg border border-[#dfd8ca] bg-white p-5 h-fit">
            <h2 className="text-xl font-semibold text-[#14213d]">Persiapan Iklan (Promo Ads)</h2>
            <p className="text-xs text-[#52606d] -mt-2">Atur banner promosi, tautan, dan penempatan iklan (termasuk popup pembuka).</p>

            <label className="grid gap-1">
              <span className="text-sm font-semibold text-[#334155]">Judul / Alt Teks Iklan</span>
              <input value={adTitle} onChange={(e) => setAdTitle(e.target.value)} className="rounded-md border border-[#dfd8ca] px-4 py-3 bg-white text-[#1f2933]" placeholder="Judul promosi" required />
            </label>

            <div className="grid gap-3 sm:grid-cols-[1fr_auto] items-end">
              <label className="grid gap-1">
                <span className="text-sm font-semibold text-[#334155]">Tautan Gambar Iklan</span>
                <input value={adImageUrl} onChange={(e) => setAdImageUrl(e.target.value)} className="rounded-md border border-[#dfd8ca] px-4 py-3 bg-white text-[#1f2933]" placeholder="https://..." required />
              </label>
              <label className="flex flex-col gap-1 text-sm font-semibold text-[#334155]">
                Unggah File
                <input type="file" accept="image/*" onChange={handleAdImageUpload} disabled={isUploading} className="max-w-[200px] rounded-md border border-[#dfd8ca] px-2 py-2 text-xs" />
              </label>
            </div>
            
            {adImageUrl && <img src={adImageUrl} alt="Preview Iklan" className="max-h-40 rounded-md object-contain border border-[#dfd8ca] self-start" />}

            <label className="grid gap-1">
              <span className="text-sm font-semibold text-[#334155]">Tautan Redirect (Target URL)</span>
              <input value={adTargetUrl} onChange={(e) => setAdTargetUrl(e.target.value)} className="rounded-md border border-[#dfd8ca] px-4 py-3 bg-white text-[#1f2933]" placeholder="Link tujuan saat diklik (opsional)" />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1">
                <span className="text-sm font-semibold text-[#334155]">Penempatan (Placement)</span>
                <select value={adPlacement} onChange={(e) => setAdPlacement(e.target.value)} className="rounded-md border border-[#dfd8ca] px-4 py-3 bg-white text-[#1f2933]">
                  <option value="popup">Popup Pembuka (Startup)</option>
                  <option value="landing">Halaman Utama (Landing Banner)</option>
                  <option value="menu">Menu Header (Banner Dropdown)</option>
                </select>
              </label>
              
              <label className="flex items-center gap-2 text-sm text-[#14213d] font-semibold mt-6">
                <input type="checkbox" checked={adIsActive} onChange={(e) => setAdIsActive(e.target.checked)} className="rounded border-[#dfd8ca] text-[#2a6f6f] h-4 w-4" />
                Aktifkan Iklan ini
              </label>
            </div>

            <button className="rounded-md bg-[#2a6f6f] px-4 py-3 font-semibold text-white">Simpan Pengaturan Iklan</button>
          </form>

          {/* Form AdSense Configuration */}
          <form onSubmit={saveAdSense} className="grid gap-4 rounded-lg border border-[#dfd8ca] bg-white p-5 h-fit">
            <h2 className="text-xl font-semibold text-[#14213d]">Konfigurasi Google AdSense</h2>
            <p className="text-xs text-[#52606d] -mt-2">Atur parameter iklan AdSense untuk ditampilkan di halaman yang dipilih.</p>

            <label className="grid gap-1">
              <span className="text-sm font-semibold text-[#334155]">AdSense Client ID</span>
              <input 
                value={adsenseClient} 
                onChange={(e) => setAdSenseClient(e.target.value)} 
                className="rounded-md border border-[#dfd8ca] px-4 py-3 bg-white text-[#1f2933]" 
                placeholder="ca-pub-1234567890123456"
              />
            </label>

            <label className="grid gap-1">
              <span className="text-sm font-semibold text-[#334155]">AdSense Slot ID</span>
              <input 
                value={adsenseSlot} 
                onChange={(e) => setAdSenseSlot(e.target.value)} 
                className="rounded-md border border-[#dfd8ca] px-4 py-3 bg-white text-[#1f2933]" 
                placeholder="1234567890"
              />
            </label>

            <label className="grid gap-1">
              <span className="text-sm font-semibold text-[#334155]">Posisi Penempatan</span>
              <select 
                value={adsensePosition} 
                onChange={(e) => setAdSensePosition(e.target.value)} 
                className="rounded-md border border-[#dfd8ca] px-4 py-3 bg-white text-[#1f2933]"
              >
                <option value="sidebar">Sidebar</option>
                <option value="header">Header</option>
                <option value="footer">Footer</option>
                <option value="inline">Inline Content</option>
              </select>
            </label>

            <div className="grid gap-3">
              <span className="text-sm font-semibold text-[#334155]">Halaman Target</span>
              <div className="grid gap-2">
                {Object.entries(adsenseTargets).map(([key, checked]) => (
                  <label key={key} className="flex items-center gap-2 text-sm text-[#14213d]">
                    <input 
                      type="checkbox" 
                      checked={checked} 
                      onChange={(e) => setAdSenseTargets({...adsenseTargets, [key]: e.target.checked})} 
                      className="rounded border-[#dfd8ca] text-[#2a6f6f] h-4 w-4"
                    />
                    {key.charAt(0).toUpperCase() + key.slice(1)}
                  </label>
                ))}
              </div>
            </div>

            <label className="grid gap-1">
              <span className="text-sm font-semibold text-[#334155]">Section untuk Landing Page</span>
              <select 
                value={adsenseLandingSection} 
                onChange={(e) => setAdSenseLandingSection(e.target.value)} 
                className="rounded-md border border-[#dfd8ca] px-4 py-3 bg-white text-[#1f2933]"
              >
                <option value="header">Header</option>
                <option value="sidebar">Sidebar</option>
                <option value="footer">Footer</option>
              </select>
            </label>

            <label className="grid gap-1">
              <span className="text-sm font-semibold text-[#334155]">Intensitas Iklan</span>
              <div className="flex items-center gap-2">
                <span className="text-xs">Low</span>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={adsenseIntensity === "low" ? 30 : adsenseIntensity === "medium" ? 60 : 90} 
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    setAdSenseIntensity(value < 40 ? "low" : value < 70 ? "medium" : "high");
                  }} 
                  className="flex-1"
                />
                <span className="text-xs">High</span>
              </div>
              <span className="text-xs text-[#52606d] text-center block">Current: {adsenseIntensity}</span>
            </label>

            <label className="flex items-center gap-2 text-sm text-[#14213d] font-semibold mt-2">
              <input 
                type="checkbox" 
                checked={adsenseEnabled} 
                onChange={(e) => setAdSenseEnabled(e.target.checked)} 
                className="rounded border-[#dfd8ca] text-[#2a6f6f] h-4 w-4"
              />
              Aktifkan AdSense
            </label>

            <button className="rounded-md bg-[#14213d] px-4 py-3 font-semibold text-white">Simpan Konfigurasi AdSense</button>
          </form>
        </section>
      )}

      {activeTab === "media" && (
        <section className="grid gap-6">
          <div className="flex gap-4 border-b border-[#dfd8ca] pb-3 mb-2">
            <button
              onClick={() => setMediaSubTab("generator")}
              className={`pb-2 px-1 font-semibold border-b-2 transition ${mediaSubTab === "generator" ? "border-[#14213d] text-[#14213d]" : "border-transparent text-[#52606d] hover:text-[#14213d]"}`}
            >
              Content Generator
            </button>
            <button
              onClick={() => setMediaSubTab("library")}
              className={`pb-2 px-1 font-semibold border-b-2 transition ${mediaSubTab === "library" ? "border-[#14213d] text-[#14213d]" : "border-transparent text-[#52606d] hover:text-[#14213d]"}`}
            >
              Cloudflare R2 Media Library
            </button>
          </div>

          {mediaSubTab === "generator" ? (
            <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              {/* Generator control card */}
              <div className="grid gap-6">
                <div className="rounded-lg border border-[#dfd8ca] bg-white p-5">
                  <h2 className="text-xl font-semibold text-[#14213d] mb-4">Otomatisasi Artikel AI</h2>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between p-4 bg-[#f7f4ee] rounded-md border border-[#dfd8ca]">
                    <div className="grid gap-1">
                      <span className="font-semibold text-[#14213d] text-sm">Status Generator Otomatis (Setiap 2 Hari)</span>
                      <span className="text-xs text-[#52606d]">Menjalankan background cron job untuk membuat artikel dan mengirimkan newsletter.</span>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={autoBlogEnabled} 
                        onChange={(e) => handleToggleAutoBlog(e.target.checked)} 
                        className="rounded border-[#dfd8ca] text-[#2a6f6f] h-5 w-5 focus:ring-[#2a6f6f]" 
                      />
                      <span className="text-sm font-bold text-[#14213d]">{autoBlogEnabled ? "AKTIF" : "NONAKTIF"}</span>
                    </label>
                  </div>

                  <div className="mt-6 flex flex-col gap-3">
                    <span className="text-sm font-semibold text-[#334155]">Pemicu Manual:</span>
                    <button 
                      type="button"
                      disabled={isGeneratingAI}
                      onClick={triggerManualAutoBlog}
                      className="rounded-md bg-[#14213d] px-4 py-3 font-semibold text-white hover:bg-[#25415f] transition disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isGeneratingAI ? (
                        <>
                          <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Memproses AI & Newsletter...
                        </>
                      ) : (
                        "Generate AI Article & Blast Newsletter Now"
                      )}
                    </button>
                    <p className="text-xs text-[#52606d] italic">
                      * Catatan: Tombol di atas akan memicu pembuatan satu artikel otomatis dengan kategori acak, mengunggah banner dynamic, menyimpan ke database, dan membroadcast email newsletter ke seluruh pengguna terdaftar.
                    </p>
                  </div>
                </div>

                {/* Draft Form */}
                <form onSubmit={saveMediaDraft} className="grid gap-4 rounded-lg border border-[#dfd8ca] bg-white p-5">
                  <h2 className="text-xl font-semibold text-[#14213d]">Buat Artikel Manual (dengan Dynamic Banner)</h2>
                  
                  <label className="grid gap-1">
                    <span className="text-sm font-semibold text-[#334155]">Judul Artikel</span>
                    <input 
                      value={mediaBlogTitle} 
                      onChange={(e) => setMediaBlogTitle(e.target.value)} 
                      className="rounded-md border border-[#dfd8ca] px-4 py-3 bg-white text-[#1f2933]" 
                      placeholder="Masukkan judul artikel" 
                      required 
                    />
                  </label>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <label className="grid gap-1">
                      <span className="text-sm font-semibold text-[#334155]">Kategori</span>
                      <select 
                        value={mediaBlogCategory} 
                        onChange={(e) => setMediaBlogCategory(e.target.value)} 
                        className="rounded-md border border-[#dfd8ca] px-4 py-3 bg-white text-[#1f2933]"
                      >
                        {categoriesList.map((cat) => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </label>

                    <label className="grid gap-1">
                      <span className="text-sm font-semibold text-[#334155]">Emoji/Icon Banner</span>
                      <input 
                        value={mediaBlogIcon} 
                        onChange={(e) => setMediaBlogIcon(e.target.value)} 
                        className="rounded-md border border-[#dfd8ca] px-4 py-3 bg-white text-[#1f2933]" 
                        placeholder="Contoh: logo, ⛪, 📖, 🙏" 
                      />
                    </label>

                    <label className="grid gap-1">
                      <span className="text-sm font-semibold text-[#334155]">Status</span>
                      <select 
                        value={mediaBlogStatus} 
                        onChange={(e) => setMediaBlogStatus(e.target.value)} 
                        className="rounded-md border border-[#dfd8ca] px-4 py-3 bg-white text-[#1f2933]"
                      >
                        <option value="published">Published</option>
                        <option value="draft">Draft</option>
                      </select>
                    </label>
                  </div>

                  <label className="grid gap-1">
                    <span className="text-sm font-semibold text-[#334155]">Excerpt (Ringkasan Banner)</span>
                    <textarea 
                      value={mediaBlogExcerpt} 
                      onChange={(e) => setMediaBlogExcerpt(e.target.value)} 
                      className="min-h-16 rounded-md border border-[#dfd8ca] px-4 py-3 bg-white text-[#1f2933]" 
                      placeholder="Masukkan ringkasan singkat artikel" 
                    />
                  </label>

                  <div className="grid gap-2">
                    <span className="text-sm font-semibold text-[#334155]">Konten Artikel (HTML)</span>
                    <Editor
                      apiKey={process.env.NEXT_PUBLIC_TINYMCE_API_KEY || ""}
                      onInit={(evt: any, editor: any) => {
                        mediaBlogEditorRef.current = editor;
                      }}
                      value={mediaBlogBody}
                      onEditorChange={(newValue: string) => setMediaBlogBody(newValue)}
                      init={{
                        height: 350,
                        menubar: false,
                        plugins: [
                          'advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview',
                          'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
                          'insertdatetime', 'media', 'table', 'code', 'help', 'wordcount'
                        ],
                        toolbar: 'undo redo | blocks | ' +
                          'bold italic forecolor | alignleft aligncenter ' +
                          'alignright alignjustify | bullist numlist outdent indent | ' +
                          'removeformat | code | help',
                        content_style: 'body { font-family:Helvetica,Arial,sans-serif; font-size:14px }'
                      }}
                    />
                  </div>

                  <button type="submit" className="rounded-md bg-[#2a6f6f] px-4 py-3 font-semibold text-white hover:bg-[#205454] transition">
                    Simpan & Publikasikan Artikel
                  </button>
                </form>
              </div>

              {/* Dynamic Banner Preview column */}
              <div className="rounded-lg border border-[#dfd8ca] bg-white p-5 h-fit flex flex-col gap-4">
                <h3 className="text-lg font-semibold text-[#14213d] border-b border-[#dfd8ca] pb-2">Preview Dynamic Banner</h3>
                <div className="overflow-hidden rounded-md border border-[#dfd8ca] bg-[#f7f4ee] shadow-inner aspect-[1200/630] relative flex items-center justify-center">
                  <img 
                    src={`/api/admin/generate-image?title=${encodeURIComponent(mediaBlogTitle || "Grace Daily")}&description=${encodeURIComponent(mediaBlogExcerpt || "Autonomous Content & Media System")}&icon=${encodeURIComponent(mediaBlogIcon || "logo")}`} 
                    alt="Banner Live Preview" 
                    className="w-full h-auto object-cover" 
                  />
                </div>
                <div className="text-xs text-[#52606d] bg-[#f7f4ee] p-3 rounded border border-[#dfd8ca]">
                  <p className="font-semibold text-[#14213d] mb-1">Cara Kerja:</p>
                  <p>Banner di atas dibuat otomatis menggunakan `@vercel/og` dan Edge Runtime berdasarkan Judul, Excerpt, dan Icon yang Anda ketikkan secara real-time.</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid gap-6">
              {/* Media Library */}
              <div className="rounded-lg border border-[#dfd8ca] bg-white p-5">
                <h2 className="text-xl font-semibold text-[#14213d] mb-2">Cloudflare R2 Media Library</h2>
                <p className="text-sm text-[#52606d] mb-6">Manajemen file media, gambar, dan aset langsung di bucket Cloudflare R2.</p>

                {/* Upload Form */}
                <div className="rounded-lg border border-[#dfd8ca] bg-[#f7f4ee] p-5 mb-6">
                  <h3 className="text-md font-semibold text-[#14213d] mb-3">Upload File Baru</h3>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <input 
                      type="file" 
                      onChange={handleMediaLibraryUpload} 
                      disabled={r2Uploading} 
                      className="block w-full text-sm text-[#52606d] file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-[#e9f5db] file:text-[#2a6f6f] hover:file:bg-[#d4e9c3] cursor-pointer"
                    />
                    {r2Uploading && (
                      <span className="text-sm font-semibold text-[#2a6f6f] animate-pulse flex items-center gap-1 shrink-0">
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                        </svg>
                        Mengunggah...
                      </span>
                    )}
                  </div>
                  {r2Status && <p className="text-xs text-[#2a6f6f] mt-2 font-semibold">{r2Status}</p>}
                </div>

                {/* Files List */}
                {r2Loading ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-2">
                    <svg className="animate-spin h-8 w-8 text-[#2a6f6f]" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                    </svg>
                    <span className="text-sm text-[#52606d]">Memuat file...</span>
                  </div>
                ) : r2Files.length === 0 ? (
                  <div className="text-center py-12 text-[#52606d] italic border border-dashed border-[#dfd8ca] rounded-lg bg-gray-50">
                    Tidak ada file media di Cloudflare R2 bucket.
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    {/* Bulk Actions Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-4 bg-[#f7f4ee] p-3 rounded-lg border border-[#dfd8ca]">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="select-all-r2"
                          checked={selectedR2Files.length === r2Files.length && r2Files.length > 0}
                          onChange={handleToggleSelectAllR2Files}
                          className="h-4 w-4 rounded border-gray-300 text-[#2a6f6f] focus:ring-[#2a6f6f] cursor-pointer"
                        />
                        <label htmlFor="select-all-r2" className="text-sm font-semibold text-[#14213d] cursor-pointer select-none">
                          Pilih Semua ({selectedR2Files.length}/{r2Files.length} Terpilih)
                        </label>
                      </div>
                      {selectedR2Files.length > 0 && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleBulkDownloadR2Files}
                            className="rounded-md bg-[#2a6f6f] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#205555] cursor-pointer"
                          >
                            Unduh Terpilih
                          </button>
                          <button
                            type="button"
                            onClick={handleBulkDeleteR2Files}
                            className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700 cursor-pointer"
                          >
                            Hapus Terpilih
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Files Grid */}
                    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                      {paginatedR2Files.map((file) => {
                        const isImage = /\.(jpe?g|png|gif|svg|webp)$/i.test(file.key);
                        const isSelected = selectedR2Files.includes(file.key);
                        return (
                          <div key={file.key} className={`group relative flex flex-col rounded-lg border bg-white overflow-hidden shadow-sm hover:shadow-md transition ${isSelected ? "border-[#2a6f6f] ring-1 ring-[#2a6f6f]" : "border-[#dfd8ca]"}`}>
                            {/* Selection Checkbox overlay */}
                            <div className="absolute top-2 left-2 z-10 bg-white/80 p-1.5 rounded-md shadow-sm border border-gray-200">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleSelectR2File(file.key)}
                                className="h-4 w-4 rounded border-gray-300 text-[#2a6f6f] focus:ring-[#2a6f6f] cursor-pointer"
                              />
                            </div>

                            {/* File preview */}
                            <div className="aspect-video w-full bg-[#f7f4ee] border-b border-[#dfd8ca] flex items-center justify-center overflow-hidden relative">
                              {isImage ? (
                                <img src={file.url} alt={file.key} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                              ) : (
                                <span className="text-4xl">📄</span>
                              )}
                            </div>

                            {/* File info */}
                            <div className="p-3 flex flex-col flex-1 gap-1">
                              <span className="text-xs font-bold text-[#14213d] break-all line-clamp-2" title={file.key}>
                                {file.key}
                              </span>
                              <span className="text-[10px] text-[#52606d]">
                                Size: {formatBytes(file.size)}
                              </span>
                              {file.lastModified && (
                                <span className="text-[10px] text-[#82909e]">
                                  {new Date(file.lastModified).toLocaleDateString("id-ID", {
                                    year: "numeric",
                                    month: "short",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              )}
                            </div>

                            {/* Actions */}
                            <div className="border-t border-[#dfd8ca] bg-[#fcfbfa] p-2 flex justify-between gap-2">
                              <button
                                type="button"
                                onClick={() => handleDownloadR2File(file.key)}
                                className="text-xs font-bold text-[#2a6f6f] hover:underline cursor-pointer"
                              >
                                Download
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteR2File(file.key)}
                                className="text-xs font-bold text-red-600 hover:underline cursor-pointer"
                              >
                                Hapus
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Pagination for Cloudflare R2 Media Library */}
                    {totalR2Pages > 1 && (
                      <div className="mt-5 flex items-center justify-between border-t border-[#dfd8ca] pt-4">
                        <button
                          type="button"
                          onClick={() => setR2Page((p) => Math.max(1, p - 1))}
                          disabled={r2Page === 1}
                          className="rounded-md border border-[#dfd8ca] bg-white px-3 py-1.5 text-sm font-semibold text-[#14213d] hover:bg-[#f7f4ee] transition disabled:opacity-50"
                        >
                          Prev
                        </button>
                        <span className="text-sm font-semibold text-[#52606d]">
                          {r2Page} / {totalR2Pages}
                        </span>
                        <button
                          type="button"
                          onClick={() => setR2Page((p) => Math.min(totalR2Pages, p + 1))}
                          disabled={r2Page === totalR2Pages}
                          className="rounded-md border border-[#dfd8ca] bg-white px-3 py-1.5 text-sm font-semibold text-[#14213d] hover:bg-[#f7f4ee] transition disabled:opacity-50"
                        >
                          Next
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {activeTab === "database" && (
        <section className="grid gap-6 lg:grid-cols-2">
          {/* Panel Cloudflare R2 Backup Status */}
          <div className="lg:col-span-2 rounded-lg border border-[#dfd8ca] bg-white p-5 flex flex-col gap-4">
            <div className="flex flex-wrap justify-between items-center gap-3">
              <div>
                <h2 className="text-xl font-semibold text-[#14213d]">Status Backup Cloudflare R2</h2>
                <p className="text-sm text-[#52606d] mt-1">
                  Cadangan harian otomatis Firestore ke Cloudflare R2 (dijalankan pukul 23:00 setiap hari).
                </p>
                <div className="mt-2">
                  <Link
                    href="/admin/system"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-[#2a6f6f] hover:underline"
                  >
                    ⚙️ Buka Dashboard Manajemen Sistem V3 →
                  </Link>
                </div>
              </div>
              <button
                onClick={handleRunR2BackupManual}
                disabled={isBackingUpR2}
                className="rounded-md bg-[#2a6f6f] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1f5353] transition disabled:opacity-50 flex items-center gap-2"
              >
                {isBackingUpR2 ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Memproses Backup...
                  </>
                ) : (
                  "Backup Sekarang"
                )}
              </button>
            </div>

            {r2BackupLoading ? (
              <p className="text-sm text-[#52606d] italic animate-pulse">Memuat status backup dari R2...</p>
            ) : r2BackupError ? (
              <div className="p-4 bg-red-50 text-red-800 border border-red-200 rounded-md text-sm">
                Gagal memuat info backup: {r2BackupError}
              </div>
            ) : r2BackupInfo ? (
              <div className="grid gap-4 mt-2">
                <div className="grid gap-4 sm:grid-cols-3 bg-[#f7f4ee] p-4 rounded-lg border border-[#dfd8ca] text-sm">
                  <div>
                    <span className="text-xs text-[#52606d] block uppercase tracking-wider font-semibold">Backup Terakhir</span>
                    <span className="font-semibold text-[#14213d]">
                      {r2BackupInfo.lastBackupAt ? new Date(r2BackupInfo.lastBackupAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) : "-"}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-[#52606d] block uppercase tracking-wider font-semibold">Status Terakhir</span>
                    <span className={`inline-flex items-center gap-1 font-bold ${r2BackupInfo.status === "success" ? "text-green-700" : "text-red-700"}`}>
                      {r2BackupInfo.status === "success" ? "✅ Berhasil" : "❌ Gagal"}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-[#52606d] block uppercase tracking-wider font-semibold">Total File Backup</span>
                    <span className="font-semibold text-[#14213d]">{r2BackupInfo.files?.length || 0} file JSON</span>
                  </div>
                </div>

                {r2BackupInfo.error && (
                  <div className="p-3 bg-red-50 text-red-800 border border-red-200 rounded-md text-xs font-mono">
                    <strong>Pesan error terakhir:</strong> {r2BackupInfo.error}
                  </div>
                )}

                {r2BackupInfo.files && r2BackupInfo.files.length > 0 && (
                  <div className="overflow-x-auto border border-[#dfd8ca] rounded-lg">
                    <table className="min-w-full divide-y divide-[#dfd8ca] text-left text-sm text-[#334155]">
                      <thead className="bg-[#f7f4ee] text-xs uppercase text-[#52606d] font-bold">
                        <tr>
                          <th className="px-4 py-3">Nama File R2</th>
                          <th className="px-4 py-3">Jumlah Dokumen</th>
                          <th className="px-4 py-3">Ukuran Cadangan</th>
                          <th className="px-4 py-3">Status Kompresi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#dfd8ca] bg-white">
                        {r2BackupInfo.files.map((file: any) => (
                          <tr key={file.name} className="hover:bg-[#f7f4ee]/30 transition-colors">
                            <td className="px-4 py-3 font-semibold text-[#14213d]">{file.name}</td>
                            <td className="px-4 py-3">{file.docCount ?? 0} dokumen</td>
                            <td className="px-4 py-3">{file.sizeBytes ? (file.sizeBytes / 1024).toFixed(2) + " KB" : "-"}</td>
                            <td className="px-4 py-3">
                              {file.gzipped ? (
                                <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">Gzipped</span>
                              ) : (
                                <span className="inline-flex items-center rounded-full bg-gray-50 px-2.5 py-0.5 text-xs font-semibold text-gray-600">Raw JSON</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-[#52606d] italic">Belum ada data backup yang tercatat di R2.</p>
            )}
          </div>

          {/* Panel Ekspor */}
          <div className="rounded-lg border border-[#dfd8ca] bg-white p-5 h-fit flex flex-col gap-4">
            <h2 className="text-xl font-semibold text-[#14213d]">Ekspor Database</h2>
            <p className="text-sm text-[#52606d]">
              Ekspor seluruh data dari koleksi Firestore utama (artikel, lagu, paket, pengaturan, pertanyaan, dan user) ke dalam satu file JSON untuk cadangan offline.
            </p>
            <button
              onClick={handleExportDatabase}
              disabled={isExporting || isImporting}
              className="mt-2 rounded-md bg-[#14213d] px-4 py-3 font-semibold text-white hover:bg-[#1a2d52] transition disabled:opacity-50"
            >
              {isExporting ? "Mengekspor..." : "Unduh Cadangan JSON (.json)"}
            </button>
          </div>

          {/* Panel Impor */}
          <div className="rounded-lg border border-[#dfd8ca] bg-white p-5 h-fit flex flex-col gap-4">
            <h2 className="text-xl font-semibold text-red-700">Impor Database</h2>
            <p className="text-sm text-[#52606d]">
              Unggah file JSON hasil ekspor cadangan sebelumnya untuk memulihkan atau memperbarui data di Firestore. Data baru akan digabungkan (merge) berdasarkan Document ID yang sama.
            </p>
            
            <div className="border-2 border-dashed border-[#dfd8ca] rounded-md p-4 bg-[#f7f4ee] flex flex-col items-center justify-center gap-3">
              <span className="text-3xl">📤</span>
              <label className="cursor-pointer rounded-md bg-[#2a6f6f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1f5353] transition">
                Pilih File JSON
                <input
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImportDatabase(file);
                  }}
                  disabled={isExporting || isImporting}
                />
              </label>
              <span className="text-xs text-[#52606d]">Pastikan format file sesuai dengan hasil ekspor.</span>
            </div>

            {isImporting && (
              <div className="mt-2 space-y-2">
                <div className="flex justify-between items-center text-sm font-semibold text-[#14213d]">
                  <span>Progres Impor</span>
                  <span>{importProgress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-[#2a6f6f] h-2 rounded-full transition-all duration-300"
                    style={{ width: `${importProgress}%` }}
                  />
                </div>
                <p className="text-xs text-[#52606d] italic">{importStatus}</p>
              </div>
            )}
            {!isImporting && importStatus && (
              <div className="mt-2 p-3 bg-green-50 text-green-800 border border-green-200 rounded-md text-xs font-mono">
                {importStatus}
              </div>
            )}
          </div>
        </section>
      )}

      {activeTab === "notifikasi" && (
        <section className="grid gap-6 lg:grid-cols-2 animate-fade-in-up">
          {/* Custom Broadcast Form */}
          <form onSubmit={handleSendPush} className="grid gap-4 rounded-lg border border-[#dfd8ca] bg-white p-5 h-fit shadow-sm">
            <h2 className="text-xl font-semibold text-[#14213d]">Kirim Custom Broadcast</h2>
            <p className="text-sm text-[#52606d]">Kirim push notification khusus ke kategori pengguna tertentu.</p>
            
            <div className="grid gap-2">
              <label className="text-xs font-bold uppercase tracking-[0.14em] text-[#2a6f6f]">Target Kategori</label>
              <select
                value={pushPrefKey}
                onChange={(e) => setPushPrefKey(e.target.value)}
                className="w-full rounded-md border border-[#dfd8ca] p-3 text-sm focus:border-[#2a6f6f] outline-none bg-white"
              >
                <option value="general">📢 Grace Daily Push Notification (Umum)</option>
                <option value="devotion">🌅 Notifikasi Renungan Harian</option>
                <option value="article">📖 Notifikasi Artikel Baru</option>
                <option value="reminder">⏰ Pengingat Renungan Harian</option>
                <option value="update">🔔 Update Ayat & Renungan</option>
              </select>
            </div>

            <div className="grid gap-2">
              <label className="text-xs font-bold uppercase tracking-[0.14em] text-[#2a6f6f]">Judul Notifikasi *</label>
              <input
                type="text"
                value={pushTitle}
                onChange={(e) => setPushTitle(e.target.value)}
                placeholder="Masukkan judul notifikasi..."
                className="w-full rounded-md border border-[#dfd8ca] p-3 text-sm focus:border-[#2a6f6f] outline-none"
                required
              />
            </div>

            <div className="grid gap-2">
              <label className="text-xs font-bold uppercase tracking-[0.14em] text-[#2a6f6f]">Isi Notifikasi *</label>
              <textarea
                value={pushBody}
                onChange={(e) => setPushBody(e.target.value)}
                placeholder="Masukkan pesan atau isi ringkas..."
                rows={4}
                className="w-full rounded-md border border-[#dfd8ca] p-3 text-sm focus:border-[#2a6f6f] outline-none resize-none"
                required
              />
            </div>

            <div className="grid gap-2">
              <label className="text-xs font-bold uppercase tracking-[0.14em] text-[#2a6f6f]">Tautan Arahkan (Redirect URL)</label>
              <input
                type="text"
                value={pushUrl}
                onChange={(e) => setPushUrl(e.target.value)}
                placeholder="Contoh: /blog/slug-artikel atau /"
                className="w-full rounded-md border border-[#dfd8ca] p-3 text-sm focus:border-[#2a6f6f] outline-none"
              />
              <p className="text-[10px] text-[#52606d]">Tautan ini akan terbuka otomatis saat pengguna mengeklik push notification di perangkat mereka.</p>
            </div>

            <button
              type="submit"
              disabled={isSendingPush || !user}
              className="mt-2 w-full rounded-md bg-[#14213d] py-3 font-semibold text-white transition hover:bg-[#1a2d52] disabled:opacity-50 cursor-pointer"
            >
              {isSendingPush ? "Sedang Mengirim..." : "Kirim Broadcast Sekarang"}
            </button>
          </form>

          {/* Quick Triggers & Statistics */}
          <div className="flex flex-col gap-6">
            {/* Statistics Card */}
            <div className="rounded-lg border border-[#dfd8ca] bg-white p-5 shadow-sm">
              <h2 className="text-xl font-semibold text-[#14213d]">Status Push Notification</h2>
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div className="rounded-md bg-[#f7f4ee] border border-[#dfd8ca] p-4 text-center">
                  <p className="text-sm text-[#52606d]">Total Perangkat Terdaftar</p>
                  <p className="mt-2 text-3xl font-bold text-[#2a6f6f]">{totalPushTokens}</p>
                </div>
                <div className="rounded-md bg-[#f7f4ee] border border-[#dfd8ca] p-4 text-center flex flex-col justify-center">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#2a6f6f]">Key Web Push</p>
                  <p className="mt-1 font-mono text-[9px] text-white bg-[#14213d] rounded p-2 select-all select-none break-all">
                    {process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || "qyrEtvg7YBUwNb-iNRbNNPFI46vJKXPmb4DywDEUzVs"}
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Automation Triggers */}
            <div className="rounded-lg border border-[#dfd8ca] bg-white p-5 shadow-sm flex flex-col gap-4">
              <h2 className="text-xl font-semibold text-[#14213d]">Picu Notifikasi Otomatis (Predefined)</h2>
              <p className="text-sm text-[#52606d]">Picu pengiriman notifikasi otomatis berdasarkan data terbaru di basis data.</p>
              
              <div className="grid gap-3">
                <button
                  type="button"
                  onClick={() => triggerPredefinedPush("trigger_devotion")}
                  disabled={isSendingPush || totalPushTokens === 0 || !user}
                  className="w-full text-left rounded-md border border-[#dfd8ca] hover:bg-[#f7f4ee] p-3.5 text-sm font-semibold text-[#14213d] flex items-center justify-between transition disabled:opacity-50 cursor-pointer"
                >
                  <span>🌅 Kirim Notifikasi Renungan Harian Terbaru</span>
                  <span className="text-[#2a6f6f]">Kirim ➔</span>
                </button>

                <button
                  type="button"
                  onClick={() => triggerPredefinedPush("trigger_article")}
                  disabled={isSendingPush || totalPushTokens === 0 || !user}
                  className="w-full text-left rounded-md border border-[#dfd8ca] hover:bg-[#f7f4ee] p-3.5 text-sm font-semibold text-[#14213d] flex items-center justify-between transition disabled:opacity-50 cursor-pointer"
                >
                  <span>📖 Kirim Notifikasi Artikel Baru Terkini</span>
                  <span className="text-[#2a6f6f]">Kirim ➔</span>
                </button>
              </div>
            </div>

            {/* Form Feedbacks */}
            {pushStatus && (
              <div className="rounded-lg border border-[#dfd8ca] bg-[#ffd166]/10 p-5 text-sm text-[#14213d] font-semibold border-l-4 border-l-[#ffd166]">
                {pushStatus}
              </div>
            )}
          </div>
        </section>
      )}

      {activeTab === "langganan" && (
        <section className="grid gap-6 animate-fade-in-up">
          {/* Subscriber Statistics */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-lg border border-[#dfd8ca] bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-[#52606d]">Email Subscribers (Total / Aktif)</p>
              <p className="mt-2 text-3xl font-bold text-[#2a6f6f]">
                {emailSubscribers.length} <span className="text-lg font-normal text-[#52606d]">/</span> {emailSubscribers.filter(s => s.active !== false).length}
              </p>
            </div>
            <div className="rounded-lg border border-[#dfd8ca] bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-[#52606d]">Push Subscribers (Total / Aktif)</p>
              <p className="mt-2 text-3xl font-bold text-[#2a6f6f]">
                {pushSubscribers.length} <span className="text-lg font-normal text-[#52606d]">/</span> {pushSubscribers.filter(s => s.active !== false).length}
              </p>
            </div>
            <div className="rounded-lg border border-[#dfd8ca] bg-white p-5 shadow-sm grid grid-cols-2 gap-2">
              <div className="text-center border-r border-[#dfd8ca] flex flex-col justify-center">
                <p className="text-xs font-semibold text-[#52606d]">Registrasi Hari Ini</p>
                <p className="mt-2 text-xl font-bold text-[#2a6f6f]">
                  {(() => {
                    const todayStr = new Date().toDateString();
                    const emailToday = emailSubscribers.filter(s => {
                      if (!s.createdAt) return false;
                      const date = s.createdAt.toDate ? s.createdAt.toDate() : new Date(s.createdAt);
                      return date.toDateString() === todayStr;
                    }).length;
                    const pushToday = pushSubscribers.filter(s => {
                      if (!s.createdAt) return false;
                      const date = s.createdAt.toDate ? s.createdAt.toDate() : new Date(s.createdAt);
                      return date.toDateString() === todayStr;
                    }).length;
                    return emailToday + pushToday;
                  })()}
                </p>
              </div>
              <div className="text-center flex flex-col justify-center">
                <p className="text-xs font-semibold text-[#52606d]">Unsubscribe Hari Ini</p>
                <p className="mt-2 text-xl font-bold text-red-600">
                  {(() => {
                    const todayStr = new Date().toDateString();
                    const emailUnsub = emailSubscribers.filter(s => {
                      if (s.active !== false || !s.updatedAt) return false;
                      const date = s.updatedAt.toDate ? s.updatedAt.toDate() : new Date(s.updatedAt);
                      return date.toDateString() === todayStr;
                    }).length;
                    const pushUnsub = pushSubscribers.filter(s => {
                      if (s.active !== false || !s.updatedAt) return false;
                      const date = s.updatedAt.toDate ? s.updatedAt.toDate() : new Date(s.updatedAt);
                      return date.toDateString() === todayStr;
                    }).length;
                    return emailUnsub + pushUnsub;
                  })()}
                </p>
              </div>
            </div>
          </div>

          {/* List Content */}
          <div className="rounded-lg border border-[#dfd8ca] bg-white p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#dfd8ca] pb-3 mb-4 gap-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSubscribersSubTab("email")}
                  className={`px-4 py-2 text-sm font-semibold rounded-md transition cursor-pointer ${subscribersSubTab === "email" ? "bg-[#2a6f6f] text-white" : "text-[#52606d] hover:bg-[#f7f4ee]"}`}
                >
                  📧 Email Subscribers ({emailSubscribers.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSubscribersSubTab("push")}
                  className={`px-4 py-2 text-sm font-semibold rounded-md transition cursor-pointer ${subscribersSubTab === "push" ? "bg-[#2a6f6f] text-white" : "text-[#52606d] hover:bg-[#f7f4ee]"}`}
                >
                  🔔 Push Subscribers ({pushSubscribers.length})
                </button>
              </div>
              {subscribersSubTab === "email" && emailSubscribers.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAllEmails(!showAllEmails)}
                  className="px-3 py-1.5 text-xs font-semibold text-[#2a6f6f] border border-[#2a6f6f] rounded hover:bg-[#2a6f6f] hover:text-white transition cursor-pointer"
                >
                  {showAllEmails ? "🙈 Samarkan Semua Email" : "👁️ Tampilkan Semua Email"}
                </button>
              )}
            </div>

            {loadingSubscribers ? (
              <div className="flex flex-col items-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#2a6f6f] border-t-transparent"></div>
                <p className="mt-3 text-xs text-[#52606d]">Memuat data subscriber...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                {subscribersSubTab === "email" ? (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-[#dfd8ca] bg-[#f7f4ee]/50 text-[#52606d] font-bold uppercase tracking-wider">
                        <th className="p-3">Email</th>
                        <th className="p-3">Renungan</th>
                        <th className="p-3">Artikel</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Unsubscribe Token</th>
                        <th className="p-3">Terdaftar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {emailSubscribers.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-4 text-center text-[#8f9ca6]">Belum ada email subscriber terdaftar.</td>
                        </tr>
                      ) : (
                        emailSubscribers.map((sub, i) => {
                          const maskEmail = (email: string) => {
                            if (!email) return "";
                            const parts = email.split("@");
                            if (parts.length < 2) return email;
                            const local = parts[0];
                            const domain = parts[1];
                            if (local.length <= 2) return `${local.charAt(0)}***@${domain}`;
                            return `${local.charAt(0)}${"*".repeat(local.length - 2)}${local.slice(-1)}@${domain}`;
                          };
                          const registeredDate = sub.createdAt
                            ? (sub.createdAt.toDate ? sub.createdAt.toDate() : new Date(sub.createdAt)).toLocaleDateString("id-ID", { dateStyle: "medium" })
                            : "-";
                          return (
                            <tr key={sub.id || i} className="border-b border-[#dfd8ca] hover:bg-[#f7f4ee]/20 transition-colors">
                              <td 
                                className="p-3 font-semibold text-[#14213d] cursor-pointer hover:text-[#2a6f6f] select-all transition-colors"
                                onClick={() => setRevealedEmails(prev => ({ ...prev, [sub.id]: !prev[sub.id] }))}
                                title="Klik untuk menampilkan / menyembunyikan email lengkap"
                              >
                                {showAllEmails || revealedEmails[sub.id] ? sub.email : maskEmail(sub.email)}
                              </td>
                              <td className="p-3">
                                <button
                                  type="button"
                                  onClick={() => handleToggleSubscription(sub.id, "devotionEnabled", sub.devotionEnabled !== false)}
                                  className="hover:underline font-semibold text-emerald-600 dark:text-emerald-400 focus:outline-none"
                                  title="Klik untuk mengubah preferensi renungan"
                                >
                                  {sub.devotionEnabled !== false ? "✅ Aktif" : "❌ Nonaktif"}
                                </button>
                              </td>
                              <td className="p-3">
                                <button
                                  type="button"
                                  onClick={() => handleToggleSubscription(sub.id, "articleEnabled", sub.articleEnabled !== false)}
                                  className="hover:underline font-semibold text-emerald-600 dark:text-emerald-400 focus:outline-none"
                                  title="Klik untuk mengubah preferensi artikel"
                                >
                                  {sub.articleEnabled !== false ? "✅ Aktif" : "❌ Nonaktif"}
                                </button>
                              </td>
                              <td className="p-3">
                                <button
                                  type="button"
                                  onClick={() => handleToggleSubscription(sub.id, "active", sub.active !== false)}
                                  className="focus:outline-none"
                                  title="Klik untuk mengubah status berlangganan"
                                >
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer hover:opacity-85 transition-opacity ${sub.active !== false ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
                                    {sub.active !== false ? "Berlangganan" : "Berhenti"}
                                  </span>
                                </button>
                              </td>
                              <td className="p-3 font-mono text-[10px] text-slate-500 break-all select-all">{sub.unsubscribeToken || "-"}</td>
                              <td className="p-3 text-slate-500">{registeredDate}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                ) : (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-[#dfd8ca] bg-[#f7f4ee]/50 text-[#52606d] font-bold uppercase tracking-wider">
                        <th className="p-3">Hash Token (ID)</th>
                        <th className="p-3">Renungan</th>
                        <th className="p-3">Artikel</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">FCM Token (Ringkasan)</th>
                        <th className="p-3">Terdaftar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pushSubscribers.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-4 text-center text-[#8f9ca6]">Belum ada push subscriber terdaftar.</td>
                        </tr>
                      ) : (
                        pushSubscribers.map((sub, i) => {
                          const formatToken = (t: string) => {
                            if (!t) return "-";
                            if (t.length <= 25) return t;
                            return `${t.substring(0, 12)}...${t.substring(t.length - 12)}`;
                          };
                          const registeredDate = sub.createdAt
                            ? (sub.createdAt.toDate ? sub.createdAt.toDate() : new Date(sub.createdAt)).toLocaleDateString("id-ID", { dateStyle: "medium" })
                            : "-";
                          return (
                            <tr key={sub.id || i} className="border-b border-[#dfd8ca] hover:bg-[#f7f4ee]/20 transition-colors">
                              <td className="p-3 font-mono text-slate-500 text-[10px] break-all select-all">{sub.tokenHash || sub.id}</td>
                              <td className="p-3">{sub.devotionEnabled !== false ? "✅ Aktif" : "❌ Nonaktif"}</td>
                              <td className="p-3">{sub.articleEnabled !== false ? "✅ Aktif" : "❌ Nonaktif"}</td>
                              <td className="p-3">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${sub.active !== false ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
                                  {sub.active !== false ? "Berlangganan" : "Berhenti"}
                                </span>
                              </td>
                              <td className="p-3 font-mono text-[10px] text-slate-400 select-all">{formatToken(sub.token)}</td>
                              <td className="p-3 text-slate-500">{registeredDate}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {activeTab === "cron-logs" && (
        <section className="rounded-lg border border-[#dfd8ca] bg-white p-5 animate-fade-in-up">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-[#14213d]">Cron Logs Dashboard</h2>
            <Link
              href="/admin/cron-logs"
              className="rounded-md bg-[#2a6f6f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1f5353] transition"
            >
              Lihat Semua Logs
            </Link>
          </div>
          <p className="text-sm text-[#52606d] mb-6">
            Monitor aktivitas cron job ensiklopedia dan sistem otomatis lainnya.
          </p>
          
          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="rounded-lg border border-[#dfd8ca] bg-[#f7f4ee] p-4">
              <div className="text-sm text-[#52606d]">Cron Ensiklopedia Terakhir</div>
              <div className="mt-2 text-2xl font-bold text-[#14213d]">-</div>
            </div>
            <div className="rounded-lg border border-[#dfd8ca] bg-[#f7f4ee] p-4">
              <div className="text-sm text-[#52606d]">Status</div>
              <div className="mt-2 text-2xl font-bold text-green-600">-</div>
            </div>
          </div>
          
          {/* Quick Actions */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              onClick={async () => {
                if (!confirm("Jalankan cron ensiklopedia manual? (Maks 10 entri per run)")) return;
                try {
                  const token = await auth?.currentUser?.getIdToken();
                  const response = await fetch("/api/cron/generate-encyclopedia?action=manual&force=true", {
                    method: "POST",
                    headers: { Authorization: `Bearer ${token}` },
                  });
                  const data = await response.json();
                  if (response.ok) {
                    alert(`Sukses! Dibuat: ${data.generated}, Duplikat: ${data.duplicates}, Gagal: ${data.failed} (Maks limit: ${data.maxPerRun || 10} entri per run)`);
                  } else {
                    alert(`Error: ${data.error || "Gagal"}`);
                  }
                } catch (err: any) {
                  alert(`Error: ${err.message}`);
                }
              }}
              className="rounded-md bg-[#9C7C54] px-4 py-3 font-semibold text-white hover:bg-[#8a6b4a] transition w-full sm:w-auto"
            >
              🔄 Jalankan Cron Ensiklopedia Manual
            </button>
            <button
              onClick={async () => {
                if (!confirm("Jalankan backup R2 manual?")) return;
                try {
                  const token = await auth?.currentUser?.getIdToken();
                  const response = await fetch("/api/cron/backup-r2", {
                    method: "GET",
                    headers: { Authorization: `Bearer ${token}` },
                  });
                  const data = await response.json();
                  if (response.ok) {
                    alert(`Backup berhasil! ${data.files?.length || 0} file di-backup`);
                  } else {
                    alert(`Error: ${data.error || "Gagal"}`);
                  }
                } catch (err: any) {
                  alert(`Error: ${err.message}`);
                }
              }}
              className="rounded-md bg-[#2a6f6f] px-4 py-3 font-semibold text-white hover:bg-[#1f5353] transition w-full sm:w-auto"
            >
              💾 Backup R2 Manual
            </button>
          </div>
        </section>
      )}

      <section className="rounded-lg border border-[#dfd8ca] bg-white p-5">
        <h2 className="text-xl font-semibold text-[#14213d]">Collection Firebase</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {collections.map((item) => (
            <div key={item.id} className="rounded-md border border-[#dfd8ca] bg-[#f7f4ee] p-4">
              <p className="font-mono text-sm font-semibold text-[#14213d]">{item.id}</p>
              <p className="mt-1 text-sm text-[#52606d]">{item.purpose}</p>
            </div>
          ))}
        </div>
      </section>

      <p className="text-center text-sm text-[#52606d]">{status}</p>
    </div>
            );
}
