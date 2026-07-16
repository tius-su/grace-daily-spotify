"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { WorshipSong, RecommendationPlayer } from "./RecommendationPlayer";
import { RecommendationList } from "./RecommendationList";
import { useLanguage } from "@/lib/i18n";

export function RecommendationSection() {
  const { t, language } = useLanguage();
  const [songs, setSongs] = useState<WorshipSong[]>([]);
  const [allSongs, setAllSongs] = useState<WorshipSong[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [selectedSong, setSelectedSong] = useState<WorshipSong | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSongs() {
      try {
        setLoading(true);
        // Attempt to load from localStorage cache first
        const cacheKey = "grace-daily-youtube-songs";
        const cacheTimeKey = "grace-daily-youtube-songs-time";
        const cachedData = localStorage.getItem(cacheKey);
        const cachedTime = localStorage.getItem(cacheTimeKey);
        
        // Cache is valid for 1 hour
        const isCacheValid = cachedData && cachedTime && (Date.now() - parseInt(cachedTime, 10) < 3600000);

        let data: WorshipSong[] = [];
        if (isCacheValid) {
          data = JSON.parse(cachedData);
        } else {
          const response = await fetch("/youtube-id.json");
          if (!response.ok) {
            throw new Error(language === "zh" ? "获取音乐推荐数据失败" : language === "en" ? "Failed to fetch music recommendation data" : "Gagal mengambil data rekomendasi musik");
          }
          data = await response.json();
          // Filter out inactive songs if there is an active property
          data = data.filter(song => song.active !== false);

          // Save to localStorage
          localStorage.setItem(cacheKey, JSON.stringify(data));
          localStorage.setItem(cacheTimeKey, Date.now().toString());
        }

        if (data.length === 0) {
          throw new Error(language === "zh" ? "没有可用的推荐歌曲" : language === "en" ? "No recommended songs available" : "Tidak ada lagu rekomendasi yang tersedia");
        }

        // Daily algorithm to select max 6 recommendations
        const today = Math.floor(Date.now() / 86400000);
        const startIndex = today % data.length;
        const recommendations = data
          .slice(startIndex)
          .concat(data.slice(0, startIndex))
          .slice(0, 6);

        setSongs(recommendations);
        setAllSongs(data);
        setSelectedSong(recommendations[0]);
        setError(null);
      } catch (err: any) {
        console.error(err);
        setError(err.message || (language === "zh" ? "加载数据时发生错误。" : language === "en" ? "An error occurred while loading data." : "Terjadi kesalahan saat memuat data."));
      } finally {
        setLoading(false);
      }
    }

    fetchSongs();
  }, [language]);

  if (error) {
    return (
      <section id="lagu" className="bg-[#e9f5db] px-5 py-16 sm:px-8">
        <div className="mx-auto max-w-7xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#2a6f6f]">
            {t("music.section_title")}
          </p>
          <h2 className="mt-3 text-4xl font-semibold text-[#14213d]">
            {t("music.section_subtitle")}
          </h2>
          <div className="mt-8 p-6 bg-red-50 border border-red-200 rounded-xl text-red-700 max-w-md mx-auto">
            <p className="font-semibold">
              {language === "zh" ? "加载音乐推荐失败" : language === "en" ? "Failed to load music recommendations" : "Gagal memuat rekomendasi musik"}
            </p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="lagu" className="bg-[#e9f5db] px-5 py-16 sm:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end mb-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#2a6f6f]">
              {t("music.section_title")}
            </p>
            <h2 className="mt-3 text-4xl font-semibold text-[#14213d]">
              {t("music.section_subtitle")}
            </h2>
          </div>
          <Link
            href="/ai?mode=song_recommendation"
            className="rounded-md bg-[#2a6f6f] px-5 py-2.5 font-semibold text-white transition hover:bg-[#1f5454] text-center shadow-sm"
          >
            {language === "zh" ? "获取 AI 歌曲推荐" : language === "en" ? "Get AI Song Recommendations" : "Dapatkan Rekomendasi Lagu Rohani"}
          </Link>
        </div>

        {/* Content Layout */}
        {loading ? (
          <div className="grid gap-8 lg:grid-cols-[0.7fr_0.3fr]">
            {/* Player Skeleton */}
            <div className="flex flex-col gap-4">
              <div className="w-full aspect-video bg-white/40 animate-pulse rounded-xl" />
              <div className="h-6 bg-white/40 animate-pulse rounded w-1/3 mt-2" />
              <div className="h-4 bg-white/40 animate-pulse rounded w-1/4" />
            </div>
            {/* List Skeleton */}
            <div className="flex flex-col gap-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex gap-3 p-3 bg-white/40 animate-pulse rounded-xl border border-transparent">
                  <div className="w-24 aspect-video bg-white/50 rounded-lg flex-shrink-0" />
                  <div className="flex flex-col flex-1 gap-2 justify-center">
                    <div className="h-4 bg-white/50 rounded w-3/4" />
                    <div className="h-3 bg-white/50 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[0.7fr_0.3fr]">
            {/* Left Column (70%) - Video Player */}
            <div className="w-full">
              <RecommendationPlayer song={selectedSong} />
            </div>

            {/* Right Column (30%) - Playlist */}
            <div className="w-full flex flex-col">
              <h3 className="text-lg font-bold text-[#14213d] mb-4">
                {showAll 
                  ? (language === "zh" ? "所有歌曲" : language === "en" ? "All Songs" : "Semua Lagu") 
                  : (language === "zh" ? "每日推荐列表" : language === "en" ? "Recommended Playlist" : "Daftar Rekomendasi")}
              </h3>
              <RecommendationList
                songs={showAll ? allSongs : songs}
                activeSong={selectedSong}
                onSelectSong={setSelectedSong}
              />
              <button
                onClick={() => setShowAll(!showAll)}
                className="mt-4 text-sm font-semibold text-[#2a6f6f] hover:underline flex items-center gap-1.5 w-full justify-center py-2.5 bg-white/70 hover:bg-white rounded-xl border border-[#dfd8ca] shadow-sm transition-all"
              >
                {showAll ? (
                  <>
                    <span>
                      {language === "zh" 
                        ? "显示每日推荐 (6 首歌曲)" 
                        : language === "en" 
                        ? "Show Daily Recommendations (6 Songs)" 
                        : "Tampilkan Rekomendasi Harian (6 Lagu)"}
                    </span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </>
                ) : (
                  <>
                    <span>
                      {language === "zh" 
                        ? `查看所有歌曲 (${allSongs.length} 首歌曲)` 
                        : language === "en" 
                        ? `View All Songs (${allSongs.length} Songs)` 
                        : `Lihat Semua Lagu (${allSongs.length} Lagu)`}
                    </span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
