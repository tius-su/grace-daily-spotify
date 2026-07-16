"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";

type StorageConfig = {
  tokoh: "firebase" | "r2";
  tempat: "firebase" | "r2";
  kamus: "firebase" | "r2";
  mukjizat: "firebase" | "r2";
  perumpamaan: "firebase" | "r2";
  kitab: "firebase" | "r2";
  kronologi: "firebase" | "r2";
  artikel: "firebase" | "r2";
  renungan: "firebase" | "r2";
  songs: "firebase" | "r2";
  goldenVerse: "firebase" | "r2";
  bibleVerse: "vercel" | "firebase";
};

type FirestoreUsage = {
  reads: number;
  writes: number;
  readQuota: number;
  writeQuota: number;
  readsWarning: boolean;
  writesWarning: boolean;
};

type QueryLog = {
  timestamp: string;
  category: string;
  source: string;
  pathOrUrl: string;
  durationMs: number;
  cacheStatus: string;
};

type ValidationItem = {
  category: string;
  firebase: number;
  r2: number;
  status: "match" | "error";
};

export default function AdminSystemPage() {
  const [config, setConfig] = useState<StorageConfig | null>(null);
  const [usage, setUsage] = useState<FirestoreUsage | null>(null);
  const [logs, setLogs] = useState<QueryLog[]>([]);
  const [validationReport, setValidationReport] = useState<ValidationItem[]>([]);
  const [r2Counts, setR2Counts] = useState<Record<string, number>>({});
  
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [syncingEncyclopedia, setSyncingEncyclopedia] = useState(false);
  const [syncingD1, setSyncingD1] = useState(false);
  const [d1Counts, setD1Counts] = useState<{ articles: number; encyclopedia: number } | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const loadData = async () => {
    try {
      const user = auth?.currentUser;
      if (!user) return;
      const token = await user.getIdToken();
      const res = await fetch("/api/admin/system", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        setConfig(data.config);
        setUsage(data.usage);
        setLogs(data.logs);
        setValidationReport(data.validationReport);
        setR2Counts(data.r2Counts || {});
      }
    } catch (err) {
      console.error("Failed to load system admin data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        loadData();
      }
    });
    return () => unsubscribe();
  }, []);

  const handleSwitch = async (key: keyof StorageConfig, source: "firebase" | "r2" | "vercel") => {
    if (!config) return;
    setUpdating(true);
    setStatusMessage(`Memperbarui sumber ${key} menjadi ${source.toUpperCase()}...`);
    try {
      const user = auth?.currentUser;
      if (!user) throw new Error("No authenticated user");
      const token = await user.getIdToken();
      
      const newConfig = { ...config, [key]: source };
      
      const res = await fetch("/api/admin/system", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: "update_config",
          config: newConfig,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setConfig(data.config);
        setStatusMessage(`Sumber untuk ${key} berhasil diubah ke ${source.toUpperCase()}.`);
      } else {
        const data = await res.json();
        throw new Error(data.error || "Gagal mengubah sumber");
      }
    } catch (err: any) {
      setStatusMessage(`Gagal mengubah sumber: ${err.message}`);
    } finally {
      setUpdating(false);
      loadData();
    }
  };

  const handleTriggerBackup = async () => {
    setBackingUp(true);
    setStatusMessage("Menjalankan sinkronisasi & backup Firestore ke Cloudflare R2... Mohon tunggu, proses ini dapat memakan waktu.");
    try {
      const user = auth?.currentUser;
      if (!user) throw new Error("No authenticated user");
      const token = await user.getIdToken();

      const res = await fetch("/api/admin/system", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: "trigger_backup",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setStatusMessage("Sinkronisasi & backup Cloudflare R2 berhasil diselesaikan! Report migrasi telah diperbarui.");
        } else {
          throw new Error(data.result?.error || "Gagal menyelesaikan backup");
        }
      } else {
        const data = await res.json();
        throw new Error(data.error || "Gagal melakukan backup");
      }
    } catch (err: any) {
      setStatusMessage(`Gagal sinkronisasi: ${err.message}`);
    } finally {
      setBackingUp(false);
      loadData();
    }
  };

  const handleSyncD1FromR2 = async (target: "all" | "articles" | "encyclopedia" = "all") => {
    setSyncingD1(true);
    setStatusMessage(`Menjalankan Sync D1 dari R2 (target: ${target})... Mohon tunggu.`);
    try {
      const user = auth?.currentUser;
      if (!user) throw new Error("No authenticated user");
      const token = await user.getIdToken();

      const res = await fetch("/api/admin/sync-d1", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ target }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setD1Counts(data.d1Verification);
          setStatusMessage(data.message || "Sync D1 dari R2 berhasil!");
        } else {
          throw new Error("Sync tidak berhasil");
        }
      } else {
        const data = await res.json();
        throw new Error(data.error || "Gagal sync D1");
      }
    } catch (err: any) {
      setStatusMessage(`Gagal sync D1: ${err.message}`);
    } finally {
      setSyncingD1(false);
      loadData();
    }
  };

  const handleSyncEncyclopedia = async () => {
    setSyncingEncyclopedia(true);
    setStatusMessage("Menjalankan sinkronisasi Ensiklopedia ke Cloudflare R2 (Hemat Quota)...");
    try {
      const user = auth?.currentUser;
      if (!user) throw new Error("No authenticated user");
      const token = await user.getIdToken();

      const res = await fetch("/api/admin/system", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: "sync_encyclopedia",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setStatusMessage(`Sinkronisasi Ensiklopedia berhasil! ${data.result?.count || 0} artikel disinkronkan ke R2.`);
        } else {
          throw new Error(data.result?.error || "Gagal melakukan sinkronisasi ensiklopedia");
        }
      } else {
        const data = await res.json();
        throw new Error(data.error || "Gagal melakukan sinkronisasi");
      }
    } catch (err: any) {
      setStatusMessage(`Gagal sinkronisasi ensiklopedia: ${err.message}`);
    } finally {
      setSyncingEncyclopedia(false);
      loadData();
    }
  };

  const getSourceBadgeClass = (source: string) => {
    switch (source.toLowerCase()) {
      case "r2":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "vercel":
        return "bg-sky-100 text-sky-800 border-sky-200";
      case "indexeddb":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "firebase":
      case "firebase sdk":
      case "firebase rest":
        return "bg-rose-100 text-rose-800 border-rose-200";
      default:
        return "bg-slate-100 text-slate-800 border-slate-200";
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f4ee] px-5 py-6 text-[#1f2933] sm:px-8">
        <div className="mx-auto max-w-7xl flex flex-col items-center justify-center py-20">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#2a6f6f] border-t-transparent"></div>
          <p className="mt-4 font-semibold text-[#14213d]">Memuat arsitektur sistem...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f4ee] px-5 py-6 text-[#1f2933] sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col justify-between gap-4 border-b border-[#dfd8ca] pb-6 md:flex-row md:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#2a6f6f]">
              Grace Daily System Dashboard
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-[#14213d]">
              Bible Encyclopedia V3 System Management
            </h1>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/admin"
              className="rounded-md border border-[#dfd8ca] bg-white px-4 py-2 text-center font-semibold text-[#14213d] hover:bg-[#f7f4ee] transition"
            >
              Kembali ke Admin Console
            </Link>
            <button
              onClick={() => startTransition(() => loadData())}
              disabled={isPending}
              className="rounded-md bg-[#2a6f6f] px-4 py-2 font-semibold text-white hover:bg-[#1a4a4a] transition disabled:opacity-50"
            >
              {isPending ? "Menyegarkan..." : "Segarkan Status"}
            </button>
          </div>
        </header>

        {statusMessage && (
          <div className="mt-6 rounded-lg border border-[#dfd8ca] bg-white p-4 text-sm font-medium text-[#14213d] shadow-sm flex items-center justify-between">
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#2a6f6f] animate-pulse"></span>
              {statusMessage}
            </span>
            <button onClick={() => setStatusMessage("")} className="text-xs text-slate-400 hover:text-slate-600">
              Tutup
            </button>
          </div>
        )}

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          {/* Column 1: Storage Status & Switcher */}
          <div className="lg:col-span-2 grid gap-6">
            <div className="rounded-xl border border-[#dfd8ca] bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between border-b border-[#dfd8ca] pb-4 mb-4">
                <h2 className="text-xl font-bold text-[#14213d] flex items-center gap-2">
                  <span>📂</span> Status & Kontrol Penyimpanan
                </h2>
                <span className="text-xs text-slate-500 font-medium">Beralih sumber instan tanpa deploy</span>
              </div>
              
              <div className="grid gap-3">
                {config && Object.keys(config).map((key) => {
                  const currentVal = config[key as keyof StorageConfig];
                  const keyLabel = key.charAt(0).toUpperCase() + key.slice(1);
                  return (
                    <div key={key} className="flex flex-col sm:flex-row sm:items-center justify-between rounded-lg border border-slate-100 bg-[#f7f4ee]/30 p-3.5 gap-3">
                      <div>
                        <span className="font-semibold text-[#14213d] text-base">{keyLabel}</span>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="text-xs text-[#52606d]">Active Source:</span>
                          <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold uppercase ${getSourceBadgeClass(currentVal)}`}>
                            {currentVal}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        {key === "bibleVerse" ? (
                          <>
                            <button
                              disabled={updating}
                              onClick={() => handleSwitch("bibleVerse", "vercel")}
                              className={`rounded px-3 py-1.5 text-xs font-bold transition border ${
                                currentVal === "vercel"
                                  ? "bg-sky-600 border-sky-600 text-white"
                                  : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                              }`}
                            >
                              Vercel Static
                            </button>
                            <button
                              disabled={updating}
                              onClick={() => handleSwitch("bibleVerse", "firebase")}
                              className={`rounded px-3 py-1.5 text-xs font-bold transition border ${
                                currentVal === "firebase"
                                  ? "bg-rose-600 border-rose-600 text-white"
                                  : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                              }`}
                            >
                              Firebase
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              disabled={updating}
                              onClick={() => handleSwitch(key as keyof StorageConfig, "r2")}
                              className={`rounded px-3 py-1.5 text-xs font-bold transition border ${
                                currentVal === "r2"
                                  ? "bg-emerald-600 border-emerald-600 text-white"
                                  : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                              }`}
                            >
                              Cloudflare R2
                            </button>
                            <button
                              disabled={updating}
                              onClick={() => handleSwitch(key as keyof StorageConfig, "firebase")}
                              className={`rounded px-3 py-1.5 text-xs font-bold transition border ${
                                currentVal === "firebase"
                                  ? "bg-rose-600 border-rose-600 text-white"
                                  : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                              }`}
                            >
                              Firebase
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Network Query Logger */}
            <div className="rounded-xl border border-[#dfd8ca] bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-[#14213d] border-b border-[#dfd8ca] pb-4 mb-4 flex items-center gap-2">
                <span>⚡</span> Network Query Debugger (Recent Queries)
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-[#dfd8ca] text-xs font-bold uppercase tracking-wider text-[#52606d] bg-slate-50/50">
                      <th className="py-3 px-3">Waktu</th>
                      <th className="py-3 px-3">Kategori</th>
                      <th className="py-3 px-3">Sumber</th>
                      <th className="py-3 px-3">Path / URL</th>
                      <th className="py-3 px-3 text-right">Durasi (ms)</th>
                      <th className="py-3 px-3 text-center">Cache</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-10 text-center text-slate-400 font-medium">
                          Belum ada request yang dicatat. Cari ensiklopedia atau muat beranda untuk mencatat logs.
                        </td>
                      </tr>
                    ) : (
                      logs.map((log, idx) => (
                        <tr key={idx} className="border-b border-slate-100 hover:bg-[#f7f4ee]/30 transition text-xs">
                          <td className="py-3 px-3 text-[#52606d] whitespace-nowrap">
                            {new Date(log.timestamp).toLocaleTimeString("id-ID", { hourCycle: "h23" })}
                          </td>
                          <td className="py-3 px-3 font-semibold text-[#14213d] capitalize">{log.category}</td>
                          <td className="py-3 px-3">
                            <span className={`rounded border px-2 py-0.5 font-bold text-2xs uppercase ${getSourceBadgeClass(log.source)}`}>
                              {log.source}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono text-[#718096] truncate max-w-[200px]">{log.pathOrUrl}</td>
                          <td className={`py-3 px-3 text-right font-bold ${log.durationMs > 500 ? "text-amber-600" : "text-[#2a6f6f]"}`}>
                            {log.durationMs}ms
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className={`rounded px-1.5 py-0.5 text-2xs font-extrabold ${log.cacheStatus === "HIT" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                              {log.cacheStatus}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Column 2: Migration Status & Firestore Protection Quota */}
          <div className="grid gap-6 h-fit">
            {/* Sync Manager */}
            <div className="rounded-xl border border-[#dfd8ca] bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-[#14213d] mb-3 flex items-center gap-2">
                <span>🔄</span> Kontrol Sinkronisasi
              </h2>
              <p className="text-xs text-[#52606d] mb-5 leading-relaxed">
                Jalankan migrasi manual untuk memindah data Firestore baru ke Cloudflare R2 secara instant dan buat validation report.
              </p>
              <div className="flex flex-col gap-3">
                {/* Sync D1 from R2 — Critical fix for empty listings */}
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                  <p className="text-xs font-bold text-blue-800 mb-2">🗄️ Cloudflare D1 Database</p>
                  {d1Counts && (
                    <p className="text-xs text-blue-600 mb-3">
                      Artikel: <strong>{d1Counts.articles}</strong> | Ensiklopedia: <strong>{d1Counts.encyclopedia}</strong>
                    </p>
                  )}
                  <div className="flex gap-2 flex-wrap">
                    <button
                      disabled={syncingD1 || backingUp || syncingEncyclopedia}
                      onClick={() => handleSyncD1FromR2("all")}
                      className="rounded px-3 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition"
                    >
                      {syncingD1 ? "Syncing..." : "Sync D1 (Semua)"}
                    </button>
                    <button
                      disabled={syncingD1 || backingUp || syncingEncyclopedia}
                      onClick={() => handleSyncD1FromR2("articles")}
                      className="rounded px-3 py-2 text-xs font-bold text-white bg-blue-500 hover:bg-blue-600 disabled:opacity-50 transition"
                    >
                      {syncingD1 ? "..." : "Artikel Saja"}
                    </button>
                    <button
                      disabled={syncingD1 || backingUp || syncingEncyclopedia}
                      onClick={() => handleSyncD1FromR2("encyclopedia")}
                      className="rounded px-3 py-2 text-xs font-bold text-white bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 transition"
                    >
                      {syncingD1 ? "..." : "Ensiklopedia Saja"}
                    </button>
                  </div>
                </div>

                <button
                  disabled={backingUp || syncingEncyclopedia}
                  onClick={handleSyncEncyclopedia}
                  className="w-full rounded-md bg-[#2a6f6f] py-3 text-center text-sm font-bold text-white transition hover:bg-[#1a4a4a] disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {syncingEncyclopedia ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Sedang Sinkronisasi Ensiklopedia...
                    </>
                  ) : (
                    "Sinkronisasi Ensiklopedia (Hemat Quota)"
                  )}
                </button>

                <button
                  disabled={backingUp || syncingEncyclopedia}
                  onClick={handleTriggerBackup}
                  className="w-full rounded-md bg-[#14213d] py-3 text-center text-sm font-bold text-white transition hover:bg-[#1f2933] disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {backingUp ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Sedang Sinkronisasi Full...
                    </>
                  ) : (
                    "Picu Sinkronisasi Full R2"
                  )}
                </button>
              </div>
            </div>

            {/* Firestore Quota Monitor */}
            <div className="rounded-xl border border-[#dfd8ca] bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-[#14213d] border-b border-[#dfd8ca] pb-3 mb-4 flex items-center gap-2">
                <span>🛡️</span> Proteksi Quota Firestore
              </h2>

              {usage ? (
                <div className="grid gap-5">
                  {/* Reads Progress Bar */}
                  <div>
                    <div className="flex justify-between text-xs font-bold mb-1.5">
                      <span className="text-[#14213d]">Reads Today</span>
                      <span className={usage.readsWarning ? "text-rose-600 font-extrabold" : "text-[#2a6f6f]"}>
                        {usage.reads.toLocaleString("id-ID")} / {usage.readQuota.toLocaleString("id-ID")} ({Math.round((usage.reads / usage.readQuota) * 100)}%)
                      </span>
                    </div>
                    <div className="w-full bg-[#f7f4ee] rounded-full h-3 overflow-hidden border border-slate-100">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${usage.readsWarning ? "bg-rose-500" : "bg-[#2a6f6f]"}`}
                        style={{ width: `${Math.min(100, (usage.reads / usage.readQuota) * 100)}%` }}
                      ></div>
                    </div>
                    {usage.readsWarning && (
                      <p className="mt-1.5 text-rose-600 font-bold text-3xs flex items-center gap-1 leading-none uppercase tracking-wide">
                        ⚠️ Warning: Penggunaan Firestore Reads melebihi 70% kuota harian!
                      </p>
                    )}
                  </div>

                  {/* Writes Progress Bar */}
                  <div>
                    <div className="flex justify-between text-xs font-bold mb-1.5">
                      <span className="text-[#14213d]">Writes Today</span>
                      <span className={usage.writesWarning ? "text-rose-600 font-extrabold" : "text-[#2a6f6f]"}>
                        {usage.writes.toLocaleString("id-ID")} / {usage.writeQuota.toLocaleString("id-ID")} ({Math.round((usage.writes / usage.writeQuota) * 100)}%)
                      </span>
                    </div>
                    <div className="w-full bg-[#f7f4ee] rounded-full h-3 overflow-hidden border border-slate-100">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${usage.writesWarning ? "bg-rose-500" : "bg-[#2a6f6f]"}`}
                        style={{ width: `${Math.min(100, (usage.writes / usage.writeQuota) * 100)}%` }}
                      ></div>
                    </div>
                    {usage.writesWarning && (
                      <p className="mt-1.5 text-rose-600 font-bold text-3xs flex items-center gap-1 leading-none uppercase tracking-wide">
                        ⚠️ Warning: Penggunaan Firestore Writes melebihi 70% kuota harian!
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-slate-400 text-xs font-medium text-center">Data penggunaan Firestore tidak tersedia.</p>
              )}
            </div>

            {/* Migration Status Report */}
            <div className="rounded-xl border border-[#dfd8ca] bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-[#14213d] border-b border-[#dfd8ca] pb-3 mb-4 flex items-center gap-2">
                <span>📊</span> Laporan Migrasi & Validasi
              </h2>

              <div className="grid gap-3.5">
                {validationReport.length === 0 ? (
                  <p className="text-slate-400 text-xs font-medium text-center py-4">Belum ada laporan migrasi. Klik tombol sinkronisasi R2 untuk memperbarui status.</p>
                ) : (
                  validationReport.map((item) => (
                    <div key={item.category} className="flex items-center justify-between border-b border-slate-50 pb-2">
                      <div>
                        <span className="font-bold text-slate-800 text-sm capitalize">{item.category}</span>
                        <p className="text-3xs text-[#52606d] mt-0.5">
                          Firestore: {item.firebase} docs | R2 JSON: {r2Counts[item.category] || item.r2 || 0} files
                        </p>
                      </div>
                      <span className={`rounded px-2 py-0.5 text-3xs font-bold uppercase tracking-wider ${
                        item.status === "match" 
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-rose-100 text-rose-800"
                      }`}>
                        {item.status === "match" ? "Complete" : "Error / Lag"}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
