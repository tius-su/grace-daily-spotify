"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  collection,
  query,
  orderBy,
  limit as firestoreLimit,
  onSnapshot,
  where,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { CronLogEntry } from "@/lib/types/cron-logs";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.gracedaily.my.id";

export default function CronLogsPage() {
  const [logs, setLogs] = useState<CronLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "success" | "attention" | "encyclopedia">("all");
  const [displayLimit, setDisplayLimit] = useState(50);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [telegramStatus, setTelegramStatus] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  // Fetch logs from Firestore
  useEffect(() => {
    if (!db) {
      setError("Firebase tidak terkonfigurasi");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let q = query(
        collection(db, "cron_logs"),
        orderBy("createdAt", "desc"),
        firestoreLimit(displayLimit)
      );

      if (filter === "encyclopedia") {
        q = query(q, where("cronType", "==", "generate-encyclopedia"));
      } else if (filter === "success") {
        q = query(q, where("status", "==", "BERHASIL"));
      } else if (filter === "attention") {
        q = query(q, where("status", "==", "PERLU_PERHATIAN"));
      }

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const logsData: CronLogEntry[] = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
            createdAt:
              doc.data().createdAt?.toDate?.() || new Date(doc.data().createdAt),
          })) as CronLogEntry[];
          setLogs(logsData);
          setLoading(false);
        },
        (err) => {
          setError(err.message);
          setLoading(false);
        }
      );

      return () => unsubscribe();
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  }, [filter, displayLimit]);

  // Trigger manual generation
  const handleManualTrigger = async () => {
    if (!confirm("Apakah Anda yakin ingin menjalankan cron ensiklopedia secara manual?")) return;
    try {
      const token = await auth?.currentUser?.getIdToken();
      const response = await fetch("/api/cron/generate-encyclopedia?action=manual&force=true", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const data = await response.json();
        alert(`Gagal: ${data.error || "Terjadi kesalahan"}`);
        return;
      }
      const result = await response.json();
      alert(`Sukses! ${result.generated} entri dibuat, ${result.duplicates} duplikat, ${result.failed} gagal`);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  // Test Telegram
  const handleTestTelegram = async () => {
    setIsTesting(true);
    setTelegramStatus("Mengirim pesan test ke Telegram...");
    try {
      const token = await auth?.currentUser?.getIdToken();
      const response = await fetch("/api/admin/test-telegram", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message: "🔔 Test notifikasi dari Admin Dashboard Cron Ensiklopedia" }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setTelegramStatus(`✅ Berhasil! Message ID: ${data.messageId}`);
      } else {
        setTelegramStatus(`❌ Gagal: ${data.error || "Unknown error"}`);
      }
    } catch (err: any) {
      setTelegramStatus(`❌ Error: ${err.message}`);
    } finally {
      setIsTesting(false);
    }
  };

  // Format date
  const formatDate = (date: Date | string) => {
    const d = typeof date === "string" ? new Date(date) : date;
    return new Intl.DateTimeFormat("id-ID", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Jakarta",
    }).format(d);
  };

  // Format generated time from ISO string
  const formatGeneratedAt = (iso: string) => {
    try {
      return new Intl.DateTimeFormat("id-ID", {
        timeStyle: "medium",
        timeZone: "Asia/Jakarta",
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  };

  // Status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case "BERHASIL": return "bg-green-100 text-green-800";
      case "PERLU_PERHATIAN": return "bg-yellow-100 text-yellow-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  // Entry badge color
  const getEntryBadgeStyle = (status: string) => {
    switch (status) {
      case "success": return "bg-green-50 text-green-700 border-green-200";
      case "duplicate": return "bg-yellow-50 text-yellow-700 border-yellow-200";
      default: return "bg-red-50 text-red-700 border-red-200";
    }
  };

  // Entry status icon
  const getEntryIcon = (status: string) => {
    switch (status) {
      case "success": return "✅";
      case "duplicate": return "⚠️";
      default: return "❌";
    }
  };

  // Statistics
  const stats = {
    total: logs.length,
    success: logs.filter((l) => l.status === "BERHASIL").length,
    attention: logs.filter((l) => l.status === "PERLU_PERHATIAN").length,
    encyclopedia: logs.filter((l) => l.cronType === "generate-encyclopedia").length,
    totalGenerated: logs.reduce((sum, l) => sum + (l.success || 0), 0),
    totalFailed: logs.reduce((sum, l) => sum + (l.failed || 0), 0),
    totalDuplicates: logs.reduce((sum, l) => sum + (l.duplicate || 0), 0),
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f4ee] px-5 py-8 text-[#1f2933] sm:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-center justify-center py-20">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#2a6f6f] border-t-transparent" />
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-[#f7f4ee] px-5 py-8 text-[#1f2933] sm:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-md bg-red-50 p-4 text-red-600">Error: {error}</div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f4ee] px-5 py-8 text-[#1f2933] sm:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Header */}
        <header className="flex flex-col justify-between gap-4 border-b border-[#dfd8ca] pb-6 md:flex-row md:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#2a6f6f]">
              Cron Logs
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-[#14213d]">
              Dashboard Log Cron Ensiklopedia
            </h1>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin"
              className="rounded-md bg-[#14213d] px-4 py-2 text-center font-semibold text-white"
            >
              ← Admin
            </Link>
            <button
              onClick={handleManualTrigger}
              className="rounded-md bg-[#9C7C54] px-4 py-2 font-semibold text-white hover:bg-[#8a6b4a] transition-colors"
            >
              ▶ Jalankan Manual
            </button>
            <button
              onClick={handleTestTelegram}
              disabled={isTesting}
              className="rounded-md bg-[#2a6f6f] px-4 py-2 font-semibold text-white hover:bg-[#1e5252] transition-colors disabled:opacity-60"
            >
              {isTesting ? "Mengirim..." : "📨 Test Telegram"}
            </button>
          </div>
        </header>

        {/* Telegram status */}
        {telegramStatus && (
          <div
            className={`rounded-md px-4 py-3 text-sm font-medium ${
              telegramStatus.startsWith("✅")
                ? "bg-green-50 text-green-700 border border-green-200"
                : telegramStatus.startsWith("❌")
                ? "bg-red-50 text-red-700 border border-red-200"
                : "bg-blue-50 text-blue-700 border border-blue-200"
            }`}
          >
            {telegramStatus}
          </div>
        )}

        {/* Statistics */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: "Total Log", value: stats.total, color: "text-[#14213d]" },
            { label: "Berhasil", value: stats.success, color: "text-green-600" },
            { label: "Perlu Perhatian", value: stats.attention, color: "text-yellow-600" },
            { label: "Total Dibuat", value: stats.totalGenerated, color: "text-[#9C7C54]" },
            { label: "Duplikat", value: stats.totalDuplicates, color: "text-blue-500" },
            { label: "Gagal", value: stats.totalFailed, color: "text-red-500" },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border border-[#dfd8ca] bg-white p-4 shadow-sm">
              <div className="text-xs text-gray-500">{s.label}</div>
              <div className={`mt-1 text-3xl font-bold ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[#52606d]">Filter:</span>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="rounded-md border border-[#dfd8ca] px-3 py-2 text-sm bg-white"
            >
              <option value="all">Semua Logs</option>
              <option value="encyclopedia">Hanya Ensiklopedia</option>
              <option value="success">Berhasil</option>
              <option value="attention">Perlu Perhatian</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[#52606d]">Tampilkan:</span>
            <select
              value={displayLimit}
              onChange={(e) => setDisplayLimit(Number(e.target.value))}
              className="rounded-md border border-[#dfd8ca] px-3 py-2 text-sm bg-white"
            >
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        {/* Logs */}
        <div className="space-y-3">
          {logs.length === 0 ? (
            <div className="rounded-lg border border-[#dfd8ca] bg-white p-8 text-center text-gray-500">
              Tidak ada log cron ditemukan
            </div>
          ) : (
            logs.map((log) => {
              const isExpanded = expandedLogId === log.id;
              const successEntries = log.entries?.filter((e) => e && typeof e === "object" && (e.status === "success" || !e.status)) ?? [];
              const dupEntries = log.entries?.filter((e) => e && typeof e === "object" && e.status === "duplicate") ?? [];
              const failedEntries = log.entries?.filter((e) => e && typeof e === "object" && e.status === "failed") ?? [];
              const legacyEntries = log.entries?.filter((e) => typeof e === "string") ?? [];

              return (
                <div
                  key={log.id}
                  className="rounded-lg border border-[#dfd8ca] bg-white shadow-sm overflow-hidden"
                >
                  {/* Log header row */}
                  <button
                    type="button"
                    onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                    className="w-full text-left px-5 py-4 hover:bg-[#f9f7f2] transition-colors"
                  >
                    <div className="flex flex-wrap items-center gap-3 justify-between">
                      <div className="flex flex-wrap items-center gap-3">
                        {/* Status badge */}
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusColor(log.status)}`}
                        >
                          {log.status}
                        </span>

                        {/* Cron type */}
                        <span className="text-sm font-semibold text-[#14213d]">
                          {log.cronType}
                        </span>

                        {/* Stats pills */}
                        <span className="text-xs text-gray-500">
                          Target: <b>{log.target}</b>
                        </span>
                        <span className="text-xs text-green-600 font-semibold">
                          ✅ {log.success} berhasil
                        </span>
                        {log.duplicate > 0 && (
                          <span className="text-xs text-yellow-600 font-semibold">
                            ⚠️ {log.duplicate} duplikat
                          </span>
                        )}
                        {log.failed > 0 && (
                          <span className="text-xs text-red-500 font-semibold">
                            ❌ {log.failed} gagal
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-400 whitespace-nowrap">
                          {formatDate(log.createdAt)}
                        </span>
                        <svg
                          className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  </button>

                  {/* Expanded entry detail */}
                  {isExpanded && (
                    <div className="border-t border-[#dfd8ca] bg-[#faf8f4] px-5 py-4">
                      {(!log.entries || log.entries.length === 0) ? (
                        <p className="text-sm text-gray-400 italic">Tidak ada detail entri tersimpan.</p>
                      ) : (
                        <div className="space-y-4">
                          {/* Success entries */}
                          {successEntries.length > 0 && (
                            <div>
                              <p className="text-xs font-bold uppercase tracking-widest text-green-700 mb-2">
                                ✅ Berhasil Dibuat ({successEntries.length})
                              </p>
                              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                {successEntries.map((entry, idx) => (
                                  <div
                                    key={idx}
                                    className="rounded-lg border border-green-200 bg-white p-3 text-sm"
                                  >
                                    <p className="font-semibold text-[#14213d] line-clamp-2">
                                      {entry.title || entry.keyword}
                                    </p>
                                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                                      <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700">
                                        {entry.kategori}
                                      </span>
                                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
                                        {entry.keyword}
                                      </span>
                                    </div>
                                    <div className="mt-1.5 flex items-center justify-between gap-2">
                                      <span className="text-xs text-gray-400">
                                        {entry.generatedAt ? formatGeneratedAt(entry.generatedAt) : ""}
                                      </span>
                                      {entry.slug && (
                                        <a
                                          href={`${APP_URL}/ensiklopedia/${entry.kategori}/${entry.slug}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-xs font-semibold text-[#2a6f6f] hover:underline shrink-0"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          Lihat →
                                        </a>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Duplicate entries */}
                          {dupEntries.length > 0 && (
                            <div>
                              <p className="text-xs font-bold uppercase tracking-widest text-yellow-700 mb-2">
                                ⚠️ Duplikat ({dupEntries.length})
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {dupEntries.map((entry, idx) => (
                                  <span
                                    key={idx}
                                    className="inline-flex items-center gap-1.5 rounded border border-yellow-200 bg-yellow-50 px-2.5 py-1 text-xs font-medium text-yellow-700"
                                    title={entry.error || "Duplikat"}
                                  >
                                    <b>{entry.title || entry.keyword}</b>
                                    <span className="opacity-60">({entry.kategori})</span>
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Failed entries */}
                          {failedEntries.length > 0 && (
                            <div>
                              <p className="text-xs font-bold uppercase tracking-widest text-red-700 mb-2">
                                ❌ Gagal ({failedEntries.length})
                              </p>
                              <div className="space-y-2">
                                {failedEntries.map((entry, idx) => (
                                  <div
                                    key={idx}
                                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs"
                                  >
                                    <p className="font-semibold text-red-700">
                                      {entry.title || entry.keyword}{" "}
                                      <span className="font-normal opacity-70">({entry.kategori})</span>
                                    </p>
                                    {entry.error && (
                                      <p className="mt-0.5 text-red-600 opacity-80">{entry.error}</p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Legacy string entries */}
                          {legacyEntries.length > 0 && (
                            <div>
                              <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
                                📝 Detail Entri (Format Lama) ({legacyEntries.length})
                              </p>
                              <ul className="list-disc pl-5 text-sm space-y-1">
                                {legacyEntries.map((entry, idx) => (
                                  <li key={idx} className="text-gray-700">{entry}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </main>
  );
}
