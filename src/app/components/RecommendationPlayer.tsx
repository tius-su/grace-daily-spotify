"use client";

import React from "react";
import { useLanguage } from "@/lib/i18n";

export interface WorshipSong {
  id: string;
  title: string;
  titlePinyin?: string;
  titleIndonesia?: string;
  artist: string;
  language: string;
  theme: string;
  youtubeVideoId: string;
  featured?: boolean;
  active?: boolean;
  views?: number;
  plays?: number;
  favoriteCount?: number;
  sortOrder?: number;
}

export function getYoutubeId(urlOrId: string): string {
  if (!urlOrId) return "";
  const trimmed = urlOrId.trim();
  if (!trimmed.includes("/") && !trimmed.includes(".")) {
    return trimmed;
  }
  try {
    if (trimmed.includes("youtu.be/")) {
      const parts = trimmed.split("youtu.be/");
      if (parts[1]) {
        return parts[1].split("?")[0].split("/")[0].trim();
      }
    }
    if (trimmed.includes("watch?v=")) {
      const parts = trimmed.split("watch?v=");
      if (parts[1]) {
        return parts[1].split("&")[0].trim();
      }
    }
    if (trimmed.includes("embed/")) {
      const parts = trimmed.split("embed/");
      if (parts[1]) {
        return parts[1].split("?")[0].trim();
      }
    }
  } catch (e) {
    console.error("Failed to parse YouTube ID from URL:", urlOrId, e);
  }
  const lastPart = trimmed.substring(trimmed.lastIndexOf("/") + 1);
  return lastPart.split("?")[0].trim();
}

interface RecommendationPlayerProps {
  song: WorshipSong | null;
}

export function RecommendationPlayer({ song }: RecommendationPlayerProps) {
  const { language } = useLanguage();

  if (!song) {
    return (
      <div className="w-full h-full bg-gray-200 animate-pulse rounded-xl flex items-center justify-center aspect-video">
        <span className="text-gray-500 font-medium">
          {language === "zh" ? "视频加载中..." : language === "en" ? "Loading Video..." : "Memuat Video..."}
        </span>
      </div>
    );
  }

  const videoId = getYoutubeId(song.youtubeVideoId);

  // Select localized title
  const displayedTitle =
    language === "id" && song.titleIndonesia
      ? song.titleIndonesia
      : language === "zh" && song.titlePinyin
      ? `${song.title} (${song.titlePinyin})`
      : song.title;

  // Localize metadata fields
  const displayedLanguage =
    song.language === "Indonesia"
      ? (language === "zh" ? "印尼语" : language === "en" ? "Indonesian" : "Indonesia")
      : song.language === "English"
      ? (language === "zh" ? "英语" : language === "en" ? "English" : "Inggris")
      : song.language === "Chinese"
      ? (language === "zh" ? "中文" : language === "en" ? "Chinese" : "Mandarin")
      : song.language;

  const displayedTheme =
    song.theme === "Worship"
      ? (language === "zh" ? "敬拜" : language === "en" ? "Worship" : "Penyembahan")
      : song.theme === "Praise"
      ? (language === "zh" ? "赞美" : language === "en" ? "Praise" : "Pujian")
      : song.theme === "Prayer"
      ? (language === "zh" ? "祷告" : language === "en" ? "Prayer" : "Doa")
      : song.theme;

  return (
    <div className="flex flex-col w-full h-full">
      <div className="w-full aspect-video rounded-xl overflow-hidden shadow-lg bg-black">
        <iframe
          className="w-full h-full"
          src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=0`}
          title={song.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        ></iframe>
      </div>
      <div className="mt-4 px-1">
        <h3 className="text-2xl font-bold text-[#14213d]">{displayedTitle}</h3>
        <p className="text-lg text-[#52606d] mt-1 font-medium">{song.artist}</p>
        <div className="flex items-center gap-3 mt-3">
          <span className="px-3 py-1 rounded-full bg-[#e9f5db] text-[#2a6f6f] text-xs font-bold uppercase tracking-wider">
            {displayedLanguage}
          </span>
          <span className="px-3 py-1 rounded-full bg-[#f7f4ee] text-[#52606d] text-xs font-bold uppercase tracking-wider">
            {displayedTheme}
          </span>
        </div>
      </div>
    </div>
  );
}
