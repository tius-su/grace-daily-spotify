"use client";

import { useState, useEffect } from "react";
import { auth, db, getOrCreateGuestId } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  query,
  orderBy,
  onSnapshot,
  Timestamp,
  increment,
} from "firebase/firestore";
import { format } from "date-fns";
import { id as idLocale, enUS, zhCN } from "date-fns/locale";
import Link from "next/link";
import { useLanguage } from "@/lib/i18n";

type PrayerRequest = {
  id: string;
  userId?: string;
  name: string;
  email: string;
  request: string;
  category: string;
  isAnonymous: boolean;
  supports: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export default function DailyPrayerWall() {
  const { t, language } = useLanguage();

  const categories = [
    { id: "health", label: t("prayer_wall.cat_health"), emoji: "🏥" },
    { id: "family", label: t("prayer_wall.cat_family"), emoji: "👨‍👩‍👧‍👦" },
    { id: "work", label: t("prayer_wall.cat_work"), emoji: "💼" },
    { id: "spiritual", label: t("prayer_wall.cat_spiritual"), emoji: "🙏" },
    { id: "financial", label: t("prayer_wall.cat_financial"), emoji: "💰" },
    { id: "relationship", label: t("prayer_wall.cat_relationship"), emoji: "❤️" },
    { id: "other", label: t("prayer_wall.cat_other"), emoji: "📝" },
  ];

  const [requests, setRequests] = useState<PrayerRequest[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [request, setRequest] = useState("");
  const [category, setCategory] = useState("spiritual");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [filterCategory, setFilterCategory] = useState("all");
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser && db) {
        try {
          const userDoc = await getDoc(doc(db!, "users", currentUser.uid));
          if (userDoc.exists()) {
            setIsAdmin(userDoc.data().role === "admin");
          } else {
            setIsAdmin(false);
          }
        } catch (e) {
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
      }
    });
  }, []);

  useEffect(() => {
    if (!db) return;
    const q = query(
      collection(db!, "prayer_wall"),
      orderBy("createdAt", "desc")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const requestsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as PrayerRequest[];
      setRequests(requestsData);
    });
    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!request || !db) return;
    const activeUserId = user ? user.uid : getOrCreateGuestId();

    setLoading(true);
    try {
      await addDoc(collection(db!, "prayer_wall"), {
        userId: activeUserId,
        name: isAnonymous ? "Anonim" : (name || (user ? user.displayName : "") || "Jemaat (Tamu)"),
        email: isAnonymous ? "" : (email || (user ? user.email : "") || ""),
        request,
        category,
        isAnonymous,
        supports: 0,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      setName("");
      setEmail("");
      setRequest("");
      setCategory("spiritual");
      setIsAnonymous(false);
      alert(t("prayer_wall.alert_success"));
    } catch (error) {
      console.error("Gagal mengirim permohonan doa:", error);
      alert(t("prayer_wall.alert_error"));
    } finally {
      setLoading(false);
    }
  };

  const handleSupport = async (id: string) => {
    if (!db) return;
    try {
      await updateDoc(doc(db!, "prayer_wall", id), {
        supports: increment(1),
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error("Gagal memberikan dukungan:", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("prayer_wall.confirm_delete"))) return;
    if (!db) return;
    try {
      await deleteDoc(doc(db!, "prayer_wall", id));
    } catch (error) {
      console.error("Gagal menghapus permohonan doa:", error);
      alert(t("prayer_wall.alert_error"));
    }
  };

  const filteredRequests =
    filterCategory === "all"
      ? requests
      : requests.filter((r) => r.category === filterCategory);

  const dateLocale = language === "zh" ? zhCN : language === "en" ? enUS : idLocale;

  if (!isMounted) {
    return (
      <div className="min-h-screen bg-[#f7f4ee] py-8 px-4 animate-pulse">
        <div className="max-w-4xl mx-auto">
          <div className="h-8 w-48 bg-gray-200 rounded mb-4"></div>
          <div className="h-4 w-96 bg-gray-200 rounded mb-8"></div>
          <div className="bg-white rounded-lg border border-[#dfd8ca] p-6 h-64"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f4ee] py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#14213d] mb-2">
            {t("prayer_wall.title")}
          </h1>
          <p className="text-[#52606d]">
            {t("prayer_wall.subtitle")}
          </p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-lg border border-[#dfd8ca] p-6 mb-8">
          <h2 className="text-xl font-semibold text-[#14213d] mb-4">
            {t("prayer_wall.send_request")}
          </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isAnonymous && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-[#334155] mb-1">
                      {t("prayer_wall.name_label")}
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full rounded-md border border-[#dfd8ca] px-4 py-2 focus:border-[#2a6f6f] outline-none"
                      placeholder={(user ? user.displayName : "") || t("prayer_wall.name_label")}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-[#334155] mb-1">
                      {t("prayer_wall.email_label")}
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-md border border-[#dfd8ca] px-4 py-2 focus:border-[#2a6f6f] outline-none"
                      placeholder={(user ? user.email : "") || t("prayer_wall.email_label")}
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-semibold text-[#334155] mb-1">
                  {t("prayer_wall.category_label")}
                </label>
                <div className="flex flex-wrap gap-2">
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategory(cat.id)}
                      className={`px-3 py-2 rounded-full text-sm ${
                        category === cat.id
                          ? "bg-[#2a6f6f] text-white"
                          : "bg-[#f7f4ee] text-[#14213d] border border-[#dfd8ca]"
                      }`}
                    >
                      {cat.emoji} {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#334155] mb-1">
                  {t("prayer_wall.request_label")}
                </label>
                <textarea
                  value={request}
                  onChange={(e) => setRequest(e.target.value)}
                  className="w-full rounded-md border border-[#dfd8ca] px-4 py-2 min-h-32 focus:border-[#2a6f6f] outline-none"
                  placeholder={t("prayer_wall.request_placeholder")}
                  required
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="anonymous"
                  checked={isAnonymous}
                  onChange={(e) => setIsAnonymous(e.target.checked)}
                  className="rounded border-[#dfd8ca] text-[#2a6f6f] focus:ring-[#2a6f6f]"
                />
                <label htmlFor="anonymous" className="text-sm text-[#14213d]">
                  {t("prayer_wall.anonymous")}
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="rounded-md bg-[#2a6f6f] px-6 py-2 font-semibold text-white disabled:opacity-50"
              >
                {loading ? t("prayer_wall.submitting") : t("prayer_wall.submit")}
              </button>
            </form>
        </div>

        {/* Filter */}
        <div className="mb-6">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilterCategory("all")}
              className={`px-3 py-2 rounded-full text-sm ${
                filterCategory === "all"
                  ? "bg-[#2a6f6f] text-white"
                  : "bg-white text-[#14213d] border border-[#dfd8ca]"
              }`}
            >
              {t("prayer_wall.all")}
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setFilterCategory(cat.id)}
                className={`px-3 py-2 rounded-full text-sm ${
                  filterCategory === cat.id
                    ? "bg-[#2a6f6f] text-white"
                    : "bg-white text-[#14213d] border border-[#dfd8ca]"
                }`}
              >
                {cat.emoji} {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Prayer Requests List */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-[#14213d]">
            {t("prayer_wall.requests_title")} ({filteredRequests.length})
          </h2>
          {filteredRequests.length === 0 ? (
            <div className="bg-white rounded-lg border border-[#dfd8ca] p-8 text-center">
              <p className="text-[#52606d]">{t("prayer_wall.no_requests")}</p>
            </div>
          ) : (
            filteredRequests.map((prayer) => {
              const categoryData = categories.find((c) => c.id === prayer.category);
              return (
                <div
                  key={prayer.id}
                  className="bg-white rounded-lg border border-[#dfd8ca] p-6"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm bg-[#f7f4ee] text-[#14213d]">
                          {categoryData?.emoji} {categoryData?.label}
                        </span>
                        <span className="text-sm text-[#52606d]">
                          {prayer.createdAt
                            ? format(prayer.createdAt.toDate(), "dd MMM yyyy HH:mm", {
                                locale: dateLocale,
                              })
                            : ""}
                        </span>
                      </div>
                      <p className="font-semibold text-[#14213d] mb-1">
                        {prayer.name}
                      </p>
                      {prayer.email && !prayer.isAnonymous && (
                        <p className="text-sm text-[#52606d] mb-1">
                          📧 {prayer.email}
                        </p>
                      )}
                      <p className="text-[#14213d] whitespace-pre-wrap">
                        {prayer.request}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-[#dfd8ca]">
                    <button
                      onClick={() => handleSupport(prayer.id)}
                      className="flex items-center gap-2 text-sm font-semibold text-[#2a6f6f] hover:text-[#1a4a4a]"
                    >
                      🙏 {t("prayer_wall.support")} ({prayer.supports})
                    </button>
                    {user && (isAdmin || prayer.userId === user.uid) && (
                      <button
                        onClick={() => handleDelete(prayer.id)}
                        className="text-sm font-semibold text-red-600 hover:text-red-800"
                      >
                        {t("prayer_wall.delete")}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
