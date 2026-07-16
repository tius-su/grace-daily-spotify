"use client";

import React from "react";
import { WorshipSong, getYoutubeId } from "./RecommendationPlayer";
import { useLanguage } from "@/lib/i18n";

interface RecommendationListProps {
  songs: WorshipSong[];
  activeSong: WorshipSong | null;
  onSelectSong: (song: WorshipSong) => void;
}

export function RecommendationList({ songs, activeSong, onSelectSong }: RecommendationListProps) {
  const { language } = useLanguage();

  return (
    <div className="flex flex-col gap-3 h-full overflow-y-auto max-h-[500px] pr-2 scrollbar-thin scrollbar-thumb-gray-300">
      {songs.map((song) => {
        const isActive = activeSong?.id === song.id;
        const videoId = getYoutubeId(song.youtubeVideoId);
        const thumbnail = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;

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
          <button
            key={song.id}
            onClick={() => onSelectSong(song)}
            className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all w-full group group ${
              isActive
                ? "bg-[#2a6f6f] border-[#2a6f6f] text-white shadow-md"
                : "bg-white border-[#dfd8ca] hover:border-[#2a6f6f] hover:bg-[#f7f4ee] text-[#1f2933]"
            }`}
          >
            {/* Thumbnail */}
            <div className="relative w-24 aspect-video rounded-lg overflow-hidden flex-shrink-0 bg-gray-200 shadow-sm">
              <img
                src={thumbnail}
                alt={song.title}
                loading="lazy"
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            </div>

            {/* Song Details */}
            <div className="flex flex-col min-w-0 flex-1">
              <h4 className={`font-semibold text-sm line-clamp-1 leading-snug ${isActive ? "text-white" : "text-[#14213d]"}`}>
                {displayedTitle}
              </h4>
              <p className={`text-xs mt-0.5 line-clamp-1 ${isActive ? "text-white/80" : "text-[#52606d]"}`}>
                {song.artist}
              </p>
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                    isActive ? "bg-white/20 text-white" : "bg-[#e9f5db] text-[#2a6f6f]"
                  }`}
                >
                  {displayedLanguage}
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                    isActive ? "bg-white/10 text-white/90" : "bg-[#f7f4ee] text-[#52606d]"
                  }`}
                >
                  {displayedTheme}
                </span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
