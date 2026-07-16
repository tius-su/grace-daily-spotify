"use client";

import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  onSnapshot,
  Timestamp,
} from "firebase/firestore";
import { format } from "date-fns";
import { id as idLocale, enUS, zhCN } from "date-fns/locale";
import { shareToWhatsApp } from "@/lib/share";
import { toggleAudio } from "@/lib/audio";
import { useLanguage } from "@/lib/i18n";

type JournalEntry = {
  id: string;
  title: string;
  content: string;
  mood: string;
  gratitude: string;
  prayer: string;
  sharePageUrl?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export default function SpiritualJournal() {
  const { t, language } = useLanguage();

  const moods = [
    { id: "joyful", label: t("journal.mood_joyful"), emoji: "😊" },
    { id: "grateful", label: t("journal.mood_grateful"), emoji: "🙏" },
    { id: "peaceful", label: t("journal.mood_peaceful"), emoji: "🕊️" },
    { id: "anxious", label: t("journal.mood_anxious"), emoji: "😰" },
    { id: "sad", label: t("journal.mood_sad"), emoji: "😢" },
    { id: "hopeful", label: t("journal.mood_hopeful"), emoji: "🌟" },
    { id: "tired", label: t("journal.mood_tired"), emoji: "😴" },
    { id: "excited", label: t("journal.mood_excited"), emoji: "🎉" },
  ];

  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [mood, setMood] = useState("joyful");
  const [gratitude, setGratitude] = useState("");
  const [prayer, setPrayer] = useState("");
  const [loading, setLoading] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const dateLocale = language === "zh" ? zhCN : language === "en" ? enUS : idLocale;

  useEffect(() => {
    if (!db) return;
    const q = query(
      collection(db!, "spiritual_journal"),
      orderBy("createdAt", "desc")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const entriesData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as JournalEntry[];
      setEntries(entriesData);
    });
    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !content || !db) return;

    setLoading(true);
    try {
      if (editingId) {
        await updateDoc(doc(db!, "spiritual_journal", editingId), {
          title,
          content,
          mood,
          gratitude,
          prayer,
          updatedAt: Timestamp.now(),
        });
      } else {
        await addDoc(collection(db!, "spiritual_journal"), {
          title,
          content,
          mood,
          gratitude,
          prayer,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
      }
      resetForm();
    } catch (error) {
      console.error("Failed to save journal:", error);
      alert(t("journal.saving") + " error");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (entry: JournalEntry) => {
    setEditingId(entry.id);
    setTitle(entry.title);
    setContent(entry.content);
    setMood(entry.mood);
    setGratitude(entry.gratitude || "");
    setPrayer(entry.prayer || "");
    setIsEditing(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("journal.confirm_delete"))) return;
    if (!db) return;
    try {
      await deleteDoc(doc(db!, "spiritual_journal", id));
    } catch (error) {
      console.error("Failed to delete journal:", error);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setTitle("");
    setContent("");
    setMood("joyful");
    setGratitude("");
    setPrayer("");
    setIsEditing(false);
  };

  const buildEntryContent = (entry: JournalEntry) => {
    return [
      entry.content,
      entry.gratitude ? `## ${t("journal.gratitude_section")}\n\n${entry.gratitude}` : "",
      entry.prayer ? `## ${t("journal.prayer_section")}\n\n${entry.prayer}` : "",
    ].filter(Boolean).join("\n\n");
  };

  const ensureJournalPage = async (entry: JournalEntry) => {
    if (entry.sharePageUrl) {
      window.open(entry.sharePageUrl, "_blank", "noopener,noreferrer");
      return;
    }

    const currentUser = auth?.currentUser;
    if (!currentUser || !db) {
      alert(t("journal.save"));
      return;
    }

    try {
      const token = await currentUser.getIdToken();
      const moodData = moods.find((m) => m.id === entry.mood);
      const pageResponse = await fetch("/api/share-page", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: t("journal.title"),
          title: `${t("journal.title")}: ${entry.title}`,
          subtitle: moodData ? `Mood: ${moodData.label}` : t("journal.title"),
          content: buildEntryContent(entry),
          sourceId: entry.id,
        }),
      });
      const pageData = await pageResponse.json();
      if (!pageResponse.ok || !pageData.url) {
        throw new Error(pageData.error || "Failed to create journal page.");
      }

      await updateDoc(doc(db, "spiritual_journal", entry.id), { sharePageUrl: pageData.url });
      window.open(pageData.url, "_blank", "noopener,noreferrer");
    } catch (error: any) {
      alert(error.message || "Failed to create journal page.");
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f4ee] py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#14213d] mb-2">
            {t("journal.title")}
          </h1>
          <p className="text-[#52606d]">
            {t("journal.subtitle")}
          </p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-lg border border-[#dfd8ca] p-6 mb-8">
          <h2 className="text-xl font-semibold text-[#14213d] mb-4">
            {isEditing ? t("journal.edit_entry") : t("journal.new_entry")}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-[#334155] mb-1">
                {t("journal.title_label")}
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-md border border-[#dfd8ca] px-4 py-2 focus:border-[#2a6f6f] outline-none"
                placeholder={t("journal.title_placeholder")}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#334155] mb-1">
                {t("journal.mood_label")}
              </label>
              <div className="flex flex-wrap gap-2">
                {moods.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMood(m.id)}
                    className={`px-3 py-2 rounded-full text-sm ${
                      mood === m.id
                        ? "bg-[#2a6f6f] text-white"
                        : "bg-[#f7f4ee] text-[#14213d] border border-[#dfd8ca]"
                    }`}
                  >
                    {m.emoji} {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#334155] mb-1">
                {t("journal.content_label")}
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full rounded-md border border-[#dfd8ca] px-4 py-2 min-h-32 focus:border-[#2a6f6f] outline-none"
                placeholder={t("journal.content_placeholder")}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#334155] mb-1">
                {t("journal.gratitude_label")}
              </label>
              <textarea
                value={gratitude}
                onChange={(e) => setGratitude(e.target.value)}
                className="w-full rounded-md border border-[#dfd8ca] px-4 py-2 min-h-20 focus:border-[#2a6f6f] outline-none"
                placeholder={t("journal.gratitude_placeholder")}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#334155] mb-1">
                {t("journal.prayer_label")}
              </label>
              <textarea
                value={prayer}
                onChange={(e) => setPrayer(e.target.value)}
                className="w-full rounded-md border border-[#dfd8ca] px-4 py-2 min-h-20 focus:border-[#2a6f6f] outline-none"
                placeholder={t("journal.prayer_placeholder")}
              />
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading}
                className="rounded-md bg-[#2a6f6f] px-6 py-2 font-semibold text-white disabled:opacity-50"
              >
                {loading ? t("journal.saving") : isEditing ? t("journal.update") : t("journal.save")}
              </button>
              {isEditing && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-md border border-[#dfd8ca] px-6 py-2 font-semibold text-[#14213d]"
                >
                  {t("journal.cancel")}
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Entries List */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-[#14213d]">{t("journal.your_journal")}</h2>
          {entries.length === 0 ? (
            <div className="bg-white rounded-lg border border-[#dfd8ca] p-8 text-center">
              <p className="text-[#52606d]">{t("journal.no_entries")}</p>
            </div>
          ) : (
            entries.map((entry) => {
              const moodData = moods.find((m) => m.id === entry.mood);
              return (
                <div
                  key={entry.id}
                  className="bg-white rounded-lg border border-[#dfd8ca] p-6"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="text-lg font-semibold text-[#14213d]">
                        {entry.title}
                      </h3>
                      <p className="text-sm text-[#52606d]">
                        {entry.createdAt
                          ? format(entry.createdAt.toDate(), "EEEE, dd MMMM yyyy HH:mm", {
                              locale: dateLocale,
                            })
                          : ""}
                      </p>
                    </div>
                    <div className="flex gap-2 flex-wrap justify-end">
                      <button
                        onClick={() => ensureJournalPage(entry)}
                        className="text-sm font-semibold text-[#2a6f6f] hover:text-[#1a4a4a]"
                      >
                        {t("journal.page_btn")}
                      </button>
                      <button
                        onClick={() => shareToWhatsApp(`${t("journal.title")}: ${entry.title}`, buildEntryContent(entry))}
                        className="text-sm font-semibold text-[#2a6f6f] hover:text-[#1a4a4a]"
                      >
                        {t("journal.share")}
                      </button>
                      <button
                        onClick={() => toggleAudio(buildEntryContent(entry), playingId === entry.id, (isPlaying) => setPlayingId(isPlaying ? entry.id : null))}
                        className="text-sm font-semibold text-[#d97706] hover:text-[#b45309]"
                      >
                        {playingId === entry.id ? t("journal.stop") : t("journal.audio")}
                      </button>
                      <button
                        onClick={() => handleEdit(entry)}
                        className="text-sm font-semibold text-blue-600 hover:text-blue-800"
                      >
                        {t("journal.edit")}
                      </button>
                      <button
                        onClick={() => handleDelete(entry.id)}
                        className="text-sm font-semibold text-red-600 hover:text-red-800"
                      >
                        {t("journal.delete")}
                      </button>
                    </div>
                  </div>
                  <div className="mb-3">
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm bg-[#f7f4ee] text-[#14213d]">
                      {moodData?.emoji} {moodData?.label}
                    </span>
                  </div>
                  <p className="text-[#14213d] whitespace-pre-wrap mb-3">
                    {entry.content}
                  </p>
                  {entry.gratitude && (
                    <div className="mb-3 p-3 bg-[#f7f4ee] rounded-md">
                      <p className="text-sm font-semibold text-[#14213d] mb-1">
                        {t("journal.gratitude_section")}
                      </p>
                      <p className="text-sm text-[#52606d]">{entry.gratitude}</p>
                    </div>
                  )}
                  {entry.prayer && (
                    <div className="p-3 bg-[#f7f4ee] rounded-md">
                      <p className="text-sm font-semibold text-[#14213d] mb-1">{t("journal.prayer_section")}</p>
                      <p className="text-sm text-[#52606d]">{entry.prayer}</p>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
