"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { collection, doc, getDoc, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { plans as defaultPlans } from "@/lib/data";

const ITEMS_PER_PAGE = 8;

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

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [aiCount, setAiCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activitySearch, setActivitySearch] = useState("");
  const [activityPage, setActivityPage] = useState(1);
  const [expandedActivityId, setExpandedActivityId] = useState<string | null>(null);
  const [noteSearch, setNoteSearch] = useState("");
  const [notePage, setNotePage] = useState(1);
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    return onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const token = await currentUser.getIdToken();
          const response = await fetch("/api/me", {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
          });
          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.error ?? "Profil gagal dimuat.");
          }
          const loadedProfile = data.profile ?? null;
          setProfile(loadedProfile);
          setActivities(data.activities ?? []);
          setNotes(data.biblePlanNotes ?? []);

          // Fetch AI Requests Count
          if (db) {
            const aiSnap = await getDocs(query(
              collection(db, "ai_requests"),
              where("userId", "==", currentUser.uid)
            )).catch(() => null);

            if (aiSnap) {
              const activatedAt = toDate(loadedProfile?.premiumActivatedAt);
              const startMs = activatedAt?.getTime() ?? 0;

              const count = aiSnap.docs.filter((d) => {
                const createdAt = toDate(d.data().createdAt);
                return createdAt ? createdAt.getTime() >= startMs : false;
              }).length;
              setAiCount(count);
            }
          }
        } catch (err) {
          let loadedProfile = null;
          if (db) {
            const [userDoc, activitySnap, notesSnap, aiSnap] = await Promise.all([
              getDoc(doc(db, "users", currentUser.uid)).catch(() => null),
              getDocs(query(collection(db, "users", currentUser.uid, "activities"), orderBy("createdAt", "desc"), limit(100))).catch(() => null),
              getDocs(query(collection(db, "users", currentUser.uid, "bible_plan_notes"), orderBy("updatedAt", "desc"), limit(100))).catch(() => null),
              getDocs(query(collection(db, "ai_requests"), where("userId", "==", currentUser.uid))).catch(() => null),
            ]);
            loadedProfile = userDoc?.exists() ? userDoc.data() : null;
            setProfile(loadedProfile);
            setActivities(activitySnap?.docs.map((item) => ({ id: item.id, ...item.data() })) ?? []);
            setNotes(notesSnap?.docs.map((item) => ({ id: item.id, ...item.data() })) ?? []);

            if (aiSnap) {
              const activatedAt = toDate(loadedProfile?.premiumActivatedAt);
              const startMs = activatedAt?.getTime() ?? 0;

              const count = aiSnap.docs.filter((d) => {
                const createdAt = toDate(d.data().createdAt);
                return createdAt ? createdAt.getTime() >= startMs : false;
              }).length;
              setAiCount(count);
            }
          }
          setError(err instanceof Error ? err.message : "Profil dimuat dengan data terbatas.");
        }
      }
      setLoading(false);
    });
  }, []);

  function formatDate(value: any) {
    const date = toDate(value);
    return date
      ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(date)
      : "Tanggal belum tersedia";
  }

  const activatedDate = useMemo(() => {
    return toDate(profile?.premiumActivatedAt);
  }, [profile]);

  const expiryDate = useMemo(() => {
    const storedExpiry = toDate(profile?.premiumExpiresAt);
    if (storedExpiry) return storedExpiry;
    if (!activatedDate) return null;
    const plan = defaultPlans.find((item) => item.name === (profile?.selectedPlan || "Free"));
    const days = Number(plan?.durationDays || 0);
    if (!days) return null;
    return new Date(activatedDate.getTime() + days * 24 * 60 * 60 * 1000);
  }, [activatedDate, profile]);

  const aiQuota = useMemo(() => {
    const storedQuota = Number(profile?.aiRequestsQuota);
    if (Number.isFinite(storedQuota) && storedQuota > 0) return storedQuota;
    const legacyRemaining = Number(profile?.aiRequestsRemaining);
    if (Number.isFinite(legacyRemaining) && legacyRemaining > 0) return legacyRemaining + aiCount;
    const plan = defaultPlans.find((item) => item.name === (profile?.selectedPlan || "Free"));
    return plan?.aiRequests ?? 0;
  }, [aiCount, profile]);

  const aiRemaining = useMemo(() => {
    const calculatedRemaining = Math.max(0, aiQuota - aiCount);
    const storedRemaining = Number(profile?.aiRequestsRemaining);
    if (Number.isFinite(storedRemaining) && storedRemaining >= 0) {
      return Math.min(storedRemaining, calculatedRemaining);
    }
    return calculatedRemaining;
  }, [aiCount, aiQuota, profile]);

  const filteredActivities = useMemo(() => {
    const keyword = activitySearch.toLowerCase().trim();
    if (!keyword) return activities;

    return activities.filter((activity) =>
      [
        activity.title,
        activity.type,
        activity.description,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(keyword),
    );
  }, [activities, activitySearch]);

  const activityTotalPages = Math.max(1, Math.ceil(filteredActivities.length / ITEMS_PER_PAGE));
  const paginatedActivities = filteredActivities.slice(
    (activityPage - 1) * ITEMS_PER_PAGE,
    activityPage * ITEMS_PER_PAGE,
  );

  const filteredNotes = useMemo(() => {
    const keyword = noteSearch.toLowerCase().trim();
    if (!keyword) return notes;

    return notes.filter((note) =>
      [`Hari ${note.day}`, note.note]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(keyword),
    );
  }, [notes, noteSearch]);

  const noteTotalPages = Math.max(1, Math.ceil(filteredNotes.length / ITEMS_PER_PAGE));
  const paginatedNotes = filteredNotes.slice(
    (notePage - 1) * ITEMS_PER_PAGE,
    notePage * ITEMS_PER_PAGE,
  );

  return (
    <main className="min-h-screen bg-[#f7f4ee] px-5 py-6 text-[#1f2933] sm:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-col justify-between gap-4 border-b border-[#dfd8ca] pb-6 md:flex-row md:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#2a6f6f]">
              Profil
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-[#14213d]">
              Data akun, paket, dan aktivitas rohani Anda.
            </h1>
          </div>
          <Link href="/" className="rounded-md bg-[#14213d] px-4 py-2 text-center font-semibold text-white">
            Kembali ke beranda
          </Link>
        </header>

        {loading ? (
          <p className="py-10 text-[#52606d]">Memuat profil...</p>
        ) : !user ? (
          <div className="mt-8 rounded-lg border border-[#dfd8ca] bg-white p-8 text-center">
            <h2 className="text-xl font-semibold text-[#14213d]">Anda belum login</h2>
            <Link href="/login" className="mt-5 inline-block rounded-md bg-[#2a6f6f] px-5 py-3 font-semibold text-white">
              Login Sekarang
            </Link>
          </div>
        ) : (
          <section className="grid gap-6 py-8 lg:grid-cols-[0.8fr_1.2fr]">
            <div className="rounded-lg border border-[#dfd8ca] bg-white p-5">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#14213d] text-xl font-bold text-white">
                  {(user.displayName?.[0] ?? user.email?.[0] ?? "P").toUpperCase()}
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-[#14213d]">{user.displayName ?? "Pengguna Grace Daily"}</h2>
                  <p className="text-sm text-[#52606d]">{user.email}</p>
                </div>
              </div>
              <dl className="mt-6 grid gap-3 text-sm">
                <div className="rounded-md bg-[#f7f4ee] p-3">
                  <dt className="font-semibold text-[#2a6f6f]">Role</dt>
                  <dd className="mt-1">{profile?.role ?? "user"}</dd>
                </div>
                <div className="rounded-md bg-[#f7f4ee] p-3">
                  <dt className="font-semibold text-[#2a6f6f]">Paket</dt>
                  <dd className="mt-1">{profile?.selectedPlan ?? "Free"}</dd>
                </div>
                {activatedDate && (
                  <>
                    <div className="rounded-md bg-[#f7f4ee] p-3">
                      <dt className="font-semibold text-[#2a6f6f]">Mulai Langganan</dt>
                      <dd className="mt-1">
                        {new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(activatedDate)}
                      </dd>
                    </div>
                    <div className="rounded-md bg-[#f7f4ee] p-3">
                      <dt className="font-semibold text-[#2a6f6f]">Berlaku Hingga</dt>
                      <dd className="mt-1">
                        {expiryDate ? new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(expiryDate) : "-"}
                      </dd>
                    </div>
                  </>
                )}
                <div className="rounded-md bg-[#f7f4ee] p-3">
                  <dt className="font-semibold text-[#2a6f6f]">Kuota Tanya AI</dt>
                  <dd className="mt-1">
                    {aiCount} / {aiQuota} interaksi digunakan (Sisa: {aiRemaining} kali)
                  </dd>
                </div>
                <div className="rounded-md bg-[#f7f4ee] p-3">
                  <dt className="font-semibold text-[#2a6f6f]">Rencana baca</dt>
                  <dd className="mt-1">Hari {profile?.biblePlanDay ?? 1} dari 365</dd>
                </div>
              </dl>
            </div>

            <div className="rounded-lg border border-[#dfd8ca] bg-white p-5">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <h2 className="text-xl font-semibold text-[#14213d]">Aktivitas Terakhir</h2>
                <input
                  type="search"
                  value={activitySearch}
                  onChange={(event) => {
                    setActivitySearch(event.target.value);
                    setActivityPage(1);
                  }}
                  className="rounded-md border border-[#dfd8ca] px-3 py-2 text-sm"
                  placeholder="Cari aktivitas..."
                />
              </div>
              <div className="mt-4 grid gap-3">
                {error ? (
                  <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>
                ) : filteredActivities.length === 0 ? (
                  <p className="text-sm text-[#52606d]">Belum ada aktivitas yang tercatat.</p>
                ) : (
                  paginatedActivities.map((activity) => (
                    <article key={activity.id} className="rounded-md border border-[#dfd8ca] bg-[#f7f4ee] p-4">
                      <button
                        type="button"
                        onClick={() => setExpandedActivityId((current) => current === activity.id ? null : activity.id)}
                        className="flex w-full flex-col justify-between gap-1 text-left sm:flex-row sm:items-center"
                      >
                        <span className="font-semibold text-[#14213d]">{activity.title ?? activity.type}</span>
                        <time className="text-xs font-semibold uppercase tracking-[0.12em] text-[#2a6f6f]">
                          {formatDate(activity.createdAt)}
                        </time>
                      </button>
                      {expandedActivityId === activity.id && (
                        <div className="mt-3 rounded-md bg-white p-3 text-sm leading-7 text-[#52606d]">
                          <p className="whitespace-pre-wrap">{activity.description || "Tidak ada detail tambahan."}</p>
                          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#52606d]">
                            Tipe: {activity.type ?? "aktivitas"}
                          </p>
                        </div>
                      )}
                    </article>
                  ))
                )}
              </div>
              {filteredActivities.length > ITEMS_PER_PAGE && (
                <div className="mt-5 flex items-center justify-between border-t border-[#dfd8ca] pt-4">
                  <button
                    type="button"
                    onClick={() => setActivityPage((page) => Math.max(1, page - 1))}
                    disabled={activityPage === 1}
                    className="rounded-md border border-[#dfd8ca] px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
                  >
                    Prev
                  </button>
                  <span className="text-sm font-semibold text-[#52606d]">
                    {activityPage} / {activityTotalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setActivityPage((page) => Math.min(activityTotalPages, page + 1))}
                    disabled={activityPage === activityTotalPages}
                    className="rounded-md border border-[#dfd8ca] px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-[#dfd8ca] bg-white p-5 lg:col-span-2">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <h2 className="text-xl font-semibold text-[#14213d]">Catatan Rencana Baca</h2>
                <input
                  type="search"
                  value={noteSearch}
                  onChange={(event) => {
                    setNoteSearch(event.target.value);
                    setNotePage(1);
                  }}
                  className="rounded-md border border-[#dfd8ca] px-3 py-2 text-sm"
                  placeholder="Cari catatan..."
                />
              </div>
              <div className="mt-4 grid gap-3">
                {filteredNotes.length === 0 ? (
                  <p className="text-sm text-[#52606d]">Belum ada catatan rencana baca.</p>
                ) : (
                  paginatedNotes.map((note) => (
                    <article key={note.id} className="rounded-md border border-[#dfd8ca] bg-[#f7f4ee] p-4">
                      <button
                        type="button"
                        onClick={() => setExpandedNoteId((current) => current === note.id ? null : note.id)}
                        className="flex w-full flex-col justify-between gap-1 text-left sm:flex-row sm:items-center"
                      >
                        <span className="font-semibold text-[#14213d]">Hari {note.day}</span>
                        <time className="text-xs font-semibold uppercase tracking-[0.12em] text-[#2a6f6f]">
                          {formatDate(note.updatedAt)}
                        </time>
                      </button>
                      {expandedNoteId === note.id && (
                        <p className="mt-3 whitespace-pre-wrap rounded-md bg-white p-3 text-sm leading-7 text-[#52606d]">
                          {note.note || "Catatan kosong."}
                        </p>
                      )}
                    </article>
                  ))
                )}
              </div>
              {filteredNotes.length > ITEMS_PER_PAGE && (
                <div className="mt-5 flex items-center justify-between border-t border-[#dfd8ca] pt-4">
                  <button
                    type="button"
                    onClick={() => setNotePage((page) => Math.max(1, page - 1))}
                    disabled={notePage === 1}
                    className="rounded-md border border-[#dfd8ca] px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
                  >
                    Prev
                  </button>
                  <span className="text-sm font-semibold text-[#52606d]">
                    {notePage} / {noteTotalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setNotePage((page) => Math.min(noteTotalPages, page + 1))}
                    disabled={notePage === noteTotalPages}
                    className="rounded-md border border-[#dfd8ca] px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
