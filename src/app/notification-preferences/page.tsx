"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function PreferencesForm() {
  const searchParams = useSearchParams();
  const token = searchParams ? searchParams.get("token") || "" : "";
  const pushToken = searchParams ? searchParams.get("pushToken") || "" : "";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  
  const [subType, setSubType] = useState<"email" | "push" | null>(null);
  const [emailAddress, setEmailAddress] = useState("");
  const [devotionEnabled, setDevotionEnabled] = useState(true);
  const [articleEnabled, setArticleEnabled] = useState(true);
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (!token && !pushToken) {
      // Try to load push token from browser cache/local storage or FCM if available
      setError("Token langganan tidak ditemukan di tautan Anda. Buka tautan ini dari email Anda.");
      setLoading(false);
      return;
    }

    async function loadPreferences() {
      try {
        const query = token ? `token=${token}` : `pushToken=${pushToken}`;
        const response = await fetch(`/api/notification-preferences?${query}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Gagal memuat preferensi.");
        }

        setSubType(data.type);
        if (data.type === "email") {
          setEmailAddress(data.email);
        }
        setDevotionEnabled(data.devotionEnabled);
        setArticleEnabled(data.articleEnabled);
        setActive(data.active);
      } catch (err: any) {
        setError(err.message || "Gagal menghubungi server.");
      } finally {
        setLoading(false);
      }
    }

    loadPreferences();
  }, [token, pushToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const payload = {
        token: token || undefined,
        pushToken: pushToken || undefined,
        devotionEnabled,
        articleEnabled,
        active,
      };

      const response = await fetch("/api/notification-preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal menyimpan perubahan.");

      setSuccess("Pengaturan preferensi Anda telah disimpan!");
    } catch (err: any) {
      setError(err.message || "Gagal menyimpan perubahan.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#2a6f6f] border-t-transparent"></div>
        <p className="mt-4 text-sm font-semibold text-[#14213d]">Memuat preferensi...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md bg-white border border-[#dfd8ca] rounded-2xl p-8 shadow-xl">
      <div className="text-center mb-6">
        <span className="text-3xl">⚙️</span>
        <h1 className="text-2xl font-bold text-[#14213d] mt-2">Pengaturan Notifikasi</h1>
        {subType === "email" ? (
          <p className="text-xs text-[#52606d] mt-1 font-mono">{emailAddress}</p>
        ) : (
          <p className="text-xs text-[#52606d] mt-1">Langganan Notifikasi Push Browser</p>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 mb-6 leading-relaxed">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 mb-6 leading-relaxed">
          {success}
        </div>
      )}

      {(!error || success) && (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            {/* Devotions Toggle */}
            <label className="flex items-start justify-between gap-4 p-4 rounded-xl border border-[#dfd8ca] hover:bg-[#f7f4ee]/30 transition cursor-pointer">
              <div className="grid gap-1">
                <span className="text-sm font-bold text-[#14213d]">Renungan Harian</span>
                <span className="text-xs text-[#52606d]">Terima ayat dan renungan Kristen setiap pagi.</span>
              </div>
              <input
                type="checkbox"
                checked={devotionEnabled}
                onChange={(e) => setDevotionEnabled(e.target.checked)}
                className="mt-1 h-5 w-5 rounded border-[#dfd8ca] text-[#2a6f6f] focus:ring-[#2a6f6f]"
              />
            </label>

            {/* Articles Toggle */}
            <label className="flex items-start justify-between gap-4 p-4 rounded-xl border border-[#dfd8ca] hover:bg-[#f7f4ee]/30 transition cursor-pointer">
              <div className="grid gap-1">
                <span className="text-sm font-bold text-[#14213d]">Artikel Baru</span>
                <span className="text-xs text-[#52606d]">Terima pemberitahuan saat ada pembahasan Alkitab baru.</span>
              </div>
              <input
                type="checkbox"
                checked={articleEnabled}
                onChange={(e) => setArticleEnabled(e.target.checked)}
                className="mt-1 h-5 w-5 rounded border-[#dfd8ca] text-[#2a6f6f] focus:ring-[#2a6f6f]"
              />
            </label>

            {/* Unsubscribe completely option */}
            <label className="flex items-center gap-3 p-3 text-xs text-[#52606d]">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="h-4 w-4 rounded border-[#dfd8ca] text-[#2a6f6f] focus:ring-[#2a6f6f]"
              />
              <span>Aktifkan status berlangganan saya (uncheck untuk berhenti total)</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-md bg-[#2a6f6f] py-3 text-sm font-semibold text-white shadow transition hover:bg-[#1a4a4a] disabled:opacity-50"
          >
            {saving ? "Menyimpan..." : "Simpan Perubahan"}
          </button>
        </form>
      )}

      <div className="text-center mt-6 border-t border-[#dfd8ca] pt-4">
        <Link href="/" className="text-xs font-semibold text-[#2a6f6f] hover:underline">
          Kembali ke Beranda
        </Link>
      </div>
    </div>
  );
}

export default function NotificationPreferencesPage() {
  return (
    <main className="min-h-screen bg-[#f7f4ee] flex items-center justify-center p-4">
      <Suspense fallback={
        <div className="w-full max-w-md bg-white border border-[#dfd8ca] rounded-2xl p-8 text-center shadow-xl">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#2a6f6f] border-t-transparent mx-auto"></div>
          <p className="mt-4 text-sm font-semibold text-[#14213d]">Memuat preferensi...</p>
        </div>
      }>
        <PreferencesForm />
      </Suspense>
    </main>
  );
}
