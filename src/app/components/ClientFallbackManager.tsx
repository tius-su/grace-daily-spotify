"use client";

import { useEffect, useState } from "react";
import { getFromCache, saveToCache, clearOldCache } from "@/lib/indexeddb-cache";

interface ClientFallbackManagerProps<T> {
  cacheKey: string;
  serverData: T | null;
  isEmpty: (data: T | null) => boolean;
  children: (data: T) => React.ReactNode;
}

export function ClientFallbackManager<T>({
  cacheKey,
  serverData,
  isEmpty,
  children,
}: ClientFallbackManagerProps<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [maintenance, setMaintenance] = useState(false);

  useEffect(() => {
    const start = Date.now();
    async function init() {
      // Clean up old cache entries older than 30 days
      await clearOldCache();

      let finalData: T | null = null;
      if (serverData && !isEmpty(serverData)) {
        // Server fetch succeeded, cache it in IndexedDB
        await saveToCache(cacheKey, serverData);
        finalData = serverData;
      } else {
        // Server fetch failed (or empty), attempt to load from IndexedDB cache
        console.warn(`[ClientFallbackManager] Server data empty for '${cacheKey}'. Falling back to IndexedDB...`);
        const cached = await getFromCache(cacheKey);
        if (cached && !isEmpty(cached)) {
          console.log(`[ClientFallbackManager] Successfully loaded '${cacheKey}' from IndexedDB.`);
          finalData = cached as T;
        }
      }

      const elapsed = Date.now() - start;
      const minDuration = 1200; // Minimum splash screen duration (1.2 seconds)
      const delay = Math.max(0, minDuration - elapsed);

      setTimeout(() => {
        if (finalData) {
          setData(finalData);
        } else {
          console.error(`[ClientFallbackManager] IndexedDB cache is empty for '${cacheKey}'. Directing to maintenance...`);
          setMaintenance(true);
        }
        setLoading(false);
      }, delay);
    }
    init();
  }, [cacheKey, serverData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#14213d] flex flex-col items-center justify-center text-white p-4">
        <style>{`
          @keyframes loadProgress {
            0% { transform: translateX(-100%); }
            50% { transform: translateX(0); }
            100% { transform: translateX(100%); }
          }
          .animate-progress-bar {
            animation: loadProgress 1.6s infinite ease-in-out;
          }
        `}</style>

        <div className="flex flex-col items-center max-w-sm text-center gap-6 animate-pulse">
          {/* Splash Image Container with Pulsing Glow */}
          <div className="relative w-32 h-32 md:w-40 md:h-40 rounded-3xl overflow-hidden shadow-2xl border border-white/10">
            <img
              src="/logo1.jpg"
              alt="Grace Daily Splash"
              className="w-full h-full object-contain"
            />
          </div>

          {/* Loading details */}
          <div className="space-y-2">
            <h1 className="text-2xl font-bold uppercase tracking-widest text-[#ffd166]">
              Grace Daily
            </h1>
            <p className="text-xs text-white/60 tracking-widest uppercase">
              Menyiapkan Saat Teduh Anda...
            </p>
          </div>

          {/* Premium Loader Bar */}
          <div className="w-48 h-1 bg-white/10 rounded-full overflow-hidden relative">
            <div className="absolute top-0 left-0 w-full h-full bg-[#ffd166] rounded-full animate-progress-bar"></div>
          </div>
        </div>
      </div>
    );
  }

  if (maintenance) {
    if (typeof window !== "undefined") {
      window.location.href = "/maintenance";
    }
    return null;
  }

  if (!data) return null;

  return <>{children(data)}</>;
}
