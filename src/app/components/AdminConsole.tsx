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
} from "firebase/firestore";
import Link from "next/link";
import { auth, db, hasFirebaseConfig } from "@/lib/firebase";
import { blogCategories } from "@/lib/data";
import { Editor } from "@tinymce/tinymce-react";
import ReactMarkdown from "react-markdown";

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

export function AdminConsole() {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isAdmin, setIsAdmin] = useState(false);
  const [status, setStatus] = useState("Memeriksa sesi admin...");
  const [plans, setPlans] = useState<PlanDoc[]>([]);
  const [posts, setPosts] = useState<BlogDoc[]>([]);
  const [usersList, setUsersList] = useState<UserDoc[]>([]);
  const [songs, setSongs] = useState<SongDoc[]>([]);
  const [questions, setQuestions] = useState<PastoralQuestionDoc[]>([]);
  const [bulletin, setBulletin] = useState<BulletinDoc>({ title: "", content: "", isActive: false, url: "" });
  
  const [aiRequests, setAiRequests] = useState<any[]>([]);
  const [activitiesPage, setActivitiesPage] = useState(1);
  const [activitySearch, setActivitySearch] = useState("");
  const [activityFilter, setActivityFilter] = useState("Semua");
  const [expandedActivityId, setExpandedActivityId] = useState<string | null>(null);

  const [usersPage, setUsersPage] = useState(1);
  const [postsPage, setPostsPage] = useState(1);
  const [questionsPage, setQuestionsPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Database backup states
  const [importStatus, setImportStatus] = useState<string>("");
  const [importProgress, setImportProgress] = useState<number>(0);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

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
  const [showCategoryManager, setShowCategoryManager] = useState(false);

  // Integrasi Google & script global
  const [googleAnalyticsId, setGoogleAnalyticsId] = useState("");
  const [googleTagManagerId, setGoogleTagManagerId] = useState("");
  const [googleSearchConsoleToken, setGoogleSearchConsoleToken] = useState("");
  const [globalHeaderScripts, setGlobalHeaderScripts] = useState("");
  const [globalBodyScripts, setGlobalBodyScripts] = useState("");

  // Iklan / Ads
  const [adImageUrl, setAdImageUrl] = useState("");
  const [adTargetUrl, setAdTargetUrl] = useState("");
  const [adPlacement, setAdPlacement] = useState("popup");
  const [adIsActive, setAdIsActive] = useState(false);
  const [adTitle, setAdTitle] = useState("");

  // Voice to Text states
  const [isListeningTitle, setIsListeningTitle] = useState(false);
  const [isListeningExcerpt, setIsListeningExcerpt] = useState(false);
  const [isListeningBody, setIsListeningBody] = useState(false);

  const [planName, setPlanName] = useState("Premium");
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [planPrice, setPlanPrice] = useState("49000");
  const [planDays, setPlanDays] = useState("30");
  const [planRequests, setPlanRequests] = useState("300");
  const [planFeatures, setPlanFeatures] = useState("Pendeta, Export PDF, Jurnal spiritual");
  const [planAllowedModes, setPlanAllowedModes] = useState<string[]>([]);
  const [adminUid, setAdminUid] = useState("");

  const [userSearch, setUserSearch] = useState("");
  const [selectedUserPlans, setSelectedUserPlans] = useState<Record<string, string>>({});

  // Sync selected blog category
  useEffect(() => {
    if (categoriesList.length > 0 && !categoriesList.includes(blogCategory)) {
      setBlogCategory(categoriesList[0]);
    }
  }, [categoriesList]);

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

  async function loadAdminData() {
    if (!db) return;

    try {
      const [planSnapshot, postSnapshot, userSnapshot, songSnapshot, questionSnapshot, bulletinSnap, aiSnapshot, googleCodesSnap, adsSnap, blogCatsSnap] = await Promise.all([
        getDocs(query(collection(db, "plans"), limit(20))),
        getDocs(query(collection(db, "blog_posts"), orderBy("updatedAt", "desc"), limit(20))),
        getDocs(query(collection(db, "users"), limit(50))),
        getDocs(query(collection(db, "songs"), limit(50))),
        getDocs(query(collection(db, "pastoral_questions"), orderBy("createdAt", "desc"), limit(500))),
        getDoc(doc(db, "settings", "bulletin")),
        getDocs(query(collection(db, "ai_requests"), limit(500))),
        getDoc(doc(db, "settings", "google_codes")),
        getDoc(doc(db, "settings", "ads")),
        getDoc(doc(db, "settings", "blog_categories")),
      ]);

      setPlans(
        planSnapshot.docs.map((item) => {
          const data = item.data() as Omit<PlanDoc, "id">;
          return { id: item.id, ...data, features: data.features ?? [], allowedModes: data.allowedModes ?? [] }; // Default array kosong
        }),
      );
      setPosts(
        postSnapshot.docs.map((item) => {
          const data = item.data() as Omit<BlogDoc, "id">;
          return { id: item.id, ...data };
        }),
      );
      setUsersList(
        userSnapshot.docs.map((item) => {
          const data = item.data() as Omit<UserDoc, "uid">;
          return { uid: item.id, ...data };
        }),
      );
      setSongs(
        songSnapshot.docs.map((item) => {
          const data = item.data() as Omit<SongDoc, "id">;
          return { id: item.id, ...data };
        }),
      );
      setQuestions(
        questionSnapshot.docs.map((item) => ({ id: item.id, ...item.data() } as PastoralQuestionDoc))
      );
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
        setGoogleTagManagerId(data.googleTagManagerId ?? "");
        setGoogleSearchConsoleToken(data.googleSearchConsoleToken ?? "");
        setGlobalHeaderScripts(data.globalHeaderScripts ?? "");
        setGlobalBodyScripts(data.globalBodyScripts ?? "");
      }
      if (adsSnap.exists()) {
        const data = adsSnap.data();
        setAdImageUrl(data.imageUrl ?? "");
        setAdTargetUrl(data.targetUrl ?? "");
        setAdPlacement(data.placement ?? "popup");
        setAdIsActive(data.isActive ?? false);
        setAdTitle(data.title ?? "");
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
    } catch (error) {
      console.error("Gagal memuat data:", error);
      setStatus("Gagal memuat data. Pastikan Firestore Rules mengizinkan akses admin.");
    }
  }

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

    await setDoc(
      doc(db, "blog_posts", id),
      {
        title: blogTitle,
        category: blogCategory,
        ...(editingPostId
          ? {}
          : {
            createdAt: serverTimestamp(),
            authorName: user.displayName ?? user.email,
          }),
        status: blogStatus,
        excerpt: blogExcerpt,
        body: blogBody,
        imageUrl: blogImage,
        authorId: user.uid,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
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

    const id = editingPlanId ?? slugify(planName);
    await setDoc(
      doc(db, "plans", id),
      {
        name: planName,
        price: Number(planPrice),
        durationDays: Number(planDays),
        aiRequests: Number(planRequests),
        features: planFeatures.split(",").map((item) => item.trim()).filter(Boolean),
        allowedModes: planAllowedModes,
        active: true,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    setStatus(`Paket ${planName} disimpan.`);
    clearPlanForm();
    await loadAdminData();
  }

  function handleEditPlan(plan: PlanDoc) {
    setActiveTab("plans");
    setEditingPlanId(plan.id);
    setPlanName(plan.name);
    setPlanPrice(plan.price.toString());
    setPlanDays(plan.durationDays.toString());
    setPlanRequests(plan.aiRequests.toString());
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

  function clearPlanForm() {
    setEditingPlanId(null);
    setPlanName("");
    setPlanPrice("");
    setPlanDays("");
    setPlanRequests("");
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

  const filteredUsers = usersList.filter((u) =>
    u.email?.toLowerCase().includes(userSearch.toLowerCase()),
  );
  const totalUsersPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE);
  const paginatedUsers = filteredUsers.slice((usersPage - 1) * ITEMS_PER_PAGE, usersPage * ITEMS_PER_PAGE);

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
      await deleteDoc(doc(db, "blog_posts", postId));
      setStatus(`Artikel "${postTitle}" telah dihapus.`);
      await loadAdminData();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Gagal menghapus artikel.");
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
    await setDoc(
      doc(db, "songs", id),
      {
        title: songTitle,
        artist: songArtist,
        url: songUrl,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
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
    setStatus(`Lagu "${songTitle}" dihapus.`);
    await loadAdminData();
  }

  function clearSongForm() {
    setEditingSongId(null);
    setSongTitle("");
    setSongArtist("");
    setSongUrl("");
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
      await setDoc(doc(db, "settings", "google_codes"), {
        googleAnalyticsId,
        googleTagManagerId,
        googleSearchConsoleToken,
        globalHeaderScripts,
        globalBodyScripts,
        updatedAt: serverTimestamp(),
      });
      setStatus("Pengaturan Google & script global disimpan.");
      alert("Pengaturan Google & script global berhasil disimpan.");
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
        {(["dashboard", "aktivitas", "statistik", "forum", "pengumuman", "blog", "lagu", "users", "plans", "pengaturan", "database"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`rounded-md px-4 py-2 font-semibold capitalize transition ${activeTab === tab
                ? "bg-[#14213d] text-white"
                : "border border-transparent text-[#334155] hover:bg-white hover:border-[#dfd8ca]"
              }`}
          >
            {tab === "users" ? "Pengguna" : tab === "plans" ? "Paket" : tab === "aktivitas" ? "Aktivitas User" : tab === "pengaturan" ? "Pengaturan" : tab === "database" ? "Database Backup" : tab}
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
                  <p className="text-sm text-[#52606d]">Rp{plan.price.toLocaleString("id-ID")} - {plan.durationDays} hari - {plan.aiRequests} interaksi</p>
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

      {activeTab === "aktivitas" && (
        <section className="grid gap-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-[#dfd8ca] bg-white p-5 shadow-sm">
              <p className="text-sm text-[#52606d]">Total Interaksi AI</p>
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
                onInit={(evt, editor) => {
                  blogEditorRef.current = editor;
                }}
                value={blogBody}
                onEditorChange={(newValue) => setBlogBody(newValue)}
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
                    <p className="font-semibold">{post.title}</p>
                    <p className="text-sm text-[#52606d]">{post.category} - {post.status}</p>
                    <div className="mt-3 flex gap-2">
                      <button onClick={() => handleEditPost(post)} className="rounded-md border border-[#dfd8ca] bg-white px-3 py-1.5 text-sm font-semibold text-[#14213d]">Edit</button>
                      <button onClick={() => handleDeletePost(post.id, post.title)} className="rounded-md border border-transparent bg-red-100 px-3 py-1.5 text-sm font-semibold text-red-700">Hapus</button>
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
        <section className="rounded-lg border border-[#dfd8ca] bg-white p-5">
          <h2 className="text-xl font-semibold text-[#14213d]">Manajemen Pengguna</h2>
          <input
            type="search"
            value={userSearch}
            onChange={(e) => {
              setUserSearch(e.target.value);
              setUsersPage(1);
            }}
            className="mt-4 w-full rounded-md border border-[#dfd8ca] px-4 py-3"
            placeholder="Cari pengguna berdasarkan email..."
          />
          <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {paginatedUsers.map((u) => (
              <div key={u.uid} className="rounded-md border border-[#dfd8ca] bg-[#f7f4ee] p-4">
                <p className="truncate font-semibold text-[#14213d]" title={u.email}>{u.email}</p>
                <p className="mt-1 text-sm text-[#52606d]">
                  Role: <span className="font-semibold">{u.role}</span> &bull; Paket: <span className="font-semibold">{u.selectedPlan}</span>
                </p>
                <p className="mt-2 truncate font-mono text-xs text-[#52606d]" title={u.uid}>{u.uid}</p>
                {u.role !== "admin" && (
                  <button onClick={() => handleMakeAdmin(u)} className="mt-3 rounded-md border border-[#dfd8ca] bg-white px-3 py-1.5 text-sm font-semibold text-[#14213d]">
                    Jadikan Admin
                  </button>
                )}
                <div className="mt-4 grid gap-2 border-t border-[#dfd8ca] pt-3">
                  <label className="grid gap-1 text-sm font-semibold text-[#14213d]">
                    Tambah paket manual
                    <select
                      value={selectedUserPlans[u.uid] ?? u.selectedPlan ?? plans[0]?.name ?? ""}
                      onChange={(event) =>
                        setSelectedUserPlans((current) => ({ ...current, [u.uid]: event.target.value }))
                      }
                      className="rounded-md border border-[#dfd8ca] bg-white px-3 py-2 text-sm font-normal text-[#334155]"
                    >
                      {plans.map((plan) => (
                        <option key={plan.id} value={plan.name}>
                          {plan.name} - {plan.durationDays} hari
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={() => handleAssignPlan(u)}
                    disabled={plans.length === 0}
                    className="rounded-md bg-[#2a6f6f] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    Aktifkan Paket
                  </button>
                </div>
              </div>
            ))}
          </div>
          {totalUsersPages > 1 && (
            <div className="mt-5 flex items-center justify-between border-t border-[#dfd8ca] pt-4">
              <button onClick={() => setUsersPage(p => Math.max(1, p - 1))} disabled={usersPage === 1} className="rounded-md border border-[#dfd8ca] px-3 py-1.5 text-sm font-semibold disabled:opacity-50">Prev</button>
              <span className="text-sm font-semibold text-[#52606d]">{usersPage} / {totalUsersPages}</span>
              <button onClick={() => setUsersPage(p => Math.min(totalUsersPages, p + 1))} disabled={usersPage === totalUsersPages} className="rounded-md border border-[#dfd8ca] px-3 py-1.5 text-sm font-semibold disabled:opacity-50">Next</button>
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
                <input value={planRequests} onChange={(event) => setPlanRequests(event.target.value)} className="rounded-md border border-[#dfd8ca] px-4 py-3" placeholder="Contoh: 300" inputMode="numeric" />
                <span className="text-xs text-[#52606d]">Info: 1 = 1x bertanya ke pendeta.</span>
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

          <div className="rounded-lg border border-[#dfd8ca] bg-white p-5 lg:col-span-2">
            <h2 className="text-xl font-semibold text-[#14213d]">Daftar Paket</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {plans.map((plan) => (
                <div key={plan.id} className="rounded-md border border-[#dfd8ca] bg-[#f7f4ee] p-4">
                  <p className="font-semibold">{plan.name}</p>
                  <p className="text-sm text-[#52606d]">Rp{plan.price.toLocaleString("id-ID")} - {plan.durationDays} hari - {plan.aiRequests} interaksi</p>
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

      {activeTab === "pengaturan" && (
        <section className="grid gap-6 lg:grid-cols-2">
          {/* Form Google & Global Scripts */}
          <form onSubmit={saveGoogleCodes} className="grid gap-4 rounded-lg border border-[#dfd8ca] bg-white p-5 h-fit">
            <h2 className="text-xl font-semibold text-[#14213d]">Integrasi Google & Script Global</h2>
            <p className="text-xs text-[#52606d] -mt-2">Masukkan kode pelacakan dan script global untuk diinjeksi ke layout.</p>
            
            <label className="grid gap-1">
              <span className="text-sm font-semibold text-[#334155]">Google Analytics ID</span>
              <input value={googleAnalyticsId} onChange={(e) => setGoogleAnalyticsId(e.target.value)} className="rounded-md border border-[#dfd8ca] px-4 py-3 bg-white text-[#1f2933]" placeholder="Contoh: G-XXXXXXXXXX" />
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
              <span className="text-sm font-semibold text-[#334155]">Script Header Tambahan (Head)</span>
              <textarea value={globalHeaderScripts} onChange={(e) => setGlobalHeaderScripts(e.target.value)} className="min-h-24 rounded-md border border-[#dfd8ca] px-4 py-3 font-mono text-xs bg-white text-[#1f2933]" placeholder="<script>...</script>" />
            </label>

            <label className="grid gap-1">
              <span className="text-sm font-semibold text-[#334155]">Script Body Tambahan (Body)</span>
              <textarea value={globalBodyScripts} onChange={(e) => setGlobalBodyScripts(e.target.value)} className="min-h-24 rounded-md border border-[#dfd8ca] px-4 py-3 font-mono text-xs bg-white text-[#1f2933]" placeholder="<script>...</script>" />
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
        </section>
      )}

      {activeTab === "database" && (
        <section className="grid gap-6 lg:grid-cols-2">
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
