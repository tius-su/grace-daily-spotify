"use client";

import React, { useState, useRef, useEffect } from "react";
import { useLanguage } from "@/lib/i18n";

export interface PodcastChannel {
  platform: "spotify" | "apple" | "amazon" | "youtube" | "rss";
  platformName: string;
  language: "id" | "en" | "zh" | "es";
  languageName: string;
  flag: string;
  url: string;
}

export const PODCAST_CHANNELS: PodcastChannel[] = [
  // Spotify
  {
    platform: "spotify",
    platformName: "Spotify",
    language: "id",
    languageName: "Bahasa Indonesia",
    flag: "🇮🇩",
    url: "https://open.spotify.com/show/033TJ6MdOOn5mIhWPv2Geo",
  },
  {
    platform: "spotify",
    platformName: "Spotify",
    language: "en",
    languageName: "English",
    flag: "🇬🇧",
    url: "https://open.spotify.com/show/033UhoKoU6sKib8rT73I5t",
  },
  {
    platform: "spotify",
    platformName: "Spotify",
    language: "zh",
    languageName: "中文 (Chinese)",
    flag: "🇨🇳",
    url: "https://open.spotify.com/show/033Uo7IV3l9y2lDwAtwbao",
  },

  // Apple Podcasts
  {
    platform: "apple",
    platformName: "Apple Podcasts",
    language: "id",
    languageName: "Bahasa Indonesia",
    flag: "🇮🇩",
    url: "https://podcasts.apple.com/us/podcast/grace-daily-podcast/id6793798200",
  },
  {
    platform: "apple",
    platformName: "Apple Podcasts",
    language: "en",
    languageName: "English",
    flag: "🇬🇧",
    url: "https://podcasts.apple.com/us/podcast/grace-daily-podcast-english/id6793818425",
  },
  {
    platform: "apple",
    platformName: "Apple Podcasts",
    language: "zh",
    languageName: "中文 (Chinese)",
    flag: "🇨🇳",
    url: "https://podcasts.apple.com/us/podcast/grace-daily-播客（中文）/id6793876025",
  },
  {
    platform: "apple",
    platformName: "Apple Podcasts",
    language: "es",
    languageName: "Español",
    flag: "🇪🇸",
    url: "https://podcasts.apple.com/us/podcast/grace-daily-podcast-espa%C3%B1ol/id6793820073",
  },

  // Amazon Podcasts
  {
    platform: "amazon",
    platformName: "Amazon Music / Podcasts",
    language: "id",
    languageName: "Bahasa Indonesia",
    flag: "🇮🇩",
    url: "https://music.amazon.co.uk/podcasts/eb78e0d1-8cb5-4731-b36e-d250e246c4b9/grace-daily-podcast",
  },
  {
    platform: "amazon",
    platformName: "Amazon Music / Podcasts",
    language: "en",
    languageName: "English",
    flag: "🇬🇧",
    url: "https://podcasters.amazon.com/podcasts/db5af01b-a452-400c-8520-43471db198a6",
  },
  {
    platform: "amazon",
    platformName: "Amazon Music / Podcasts",
    language: "zh",
    languageName: "中文 (Chinese)",
    flag: "🇨🇳",
    url: "https://podcasters.amazon.com/podcasts/0c90e3a4-1247-48e2-936c-89d1bbd80791",
  },
  {
    platform: "amazon",
    platformName: "Amazon Music / Podcasts",
    language: "es",
    languageName: "Español",
    flag: "🇪🇸",
    url: "https://podcasters.amazon.com/podcasts/00b1838d-a557-4e0f-946a-36539b90fed5",
  },

  // YouTube Playlists
  {
    platform: "youtube",
    platformName: "YouTube Podcasts",
    language: "id",
    languageName: "Bahasa Indonesia",
    flag: "🇮🇩",
    url: "https://www.youtube.com/playlist?list=PLFfn4I0uzgWs",
  },
  {
    platform: "youtube",
    platformName: "YouTube Podcasts",
    language: "en",
    languageName: "English",
    flag: "🇬🇧",
    url: "https://www.youtube.com/playlist?list=PLNLriYyOVhPE",
  },
  {
    platform: "youtube",
    platformName: "YouTube Podcasts",
    language: "zh",
    languageName: "中文 (Chinese)",
    flag: "🇨🇳",
    url: "https://www.youtube.com/playlist?list=PLMpPAL_Fhrss",
  },
  {
    platform: "youtube",
    platformName: "YouTube Podcasts",
    language: "es",
    languageName: "Español",
    flag: "🇪🇸",
    url: "https://www.youtube.com/playlist?list=PLMn2jqoyPYD0",
  },

  // RSS Feed
  {
    platform: "rss",
    platformName: "RSS Feed Proxy",
    language: "id",
    languageName: "Bahasa Indonesia",
    flag: "🇮🇩",
    url: "/api/podcast.xml",
  },
  {
    platform: "rss",
    platformName: "RSS Feed Proxy",
    language: "en",
    languageName: "English",
    flag: "🇬🇧",
    url: "/api/podcast-en.xml",
  },
  {
    platform: "rss",
    platformName: "RSS Feed Proxy",
    language: "zh",
    languageName: "中文 (Chinese)",
    flag: "🇨🇳",
    url: "/api/podcast-zh.xml",
  },
  {
    platform: "rss",
    platformName: "RSS Feed Proxy",
    language: "es",
    languageName: "Español",
    flag: "🇪🇸",
    url: "/api/podcast-es.xml",
  },
];

export function PodcastDropdown() {
  const { language } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [activePlatform, setActivePlatform] = useState<"all" | "spotify" | "apple" | "amazon" | "youtube" | "rss">("all");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const buttonText =
    language === "zh"
      ? "🎙️ Grace Daily 播客频道"
      : language === "en"
      ? "🎙️ Grace Daily Podcasts"
      : "🎙️ Grace Daily Podcasts";

  const closeDropdown = () => setIsOpen(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredChannels =
    activePlatform === "all"
      ? PODCAST_CHANNELS
      : PODCAST_CHANNELS.filter((item) => item.platform === activePlatform);

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 rounded-lg border border-[#dfd8ca] bg-white px-3.5 py-2 text-xs font-semibold text-[#14213d] shadow-sm hover:bg-[#f7f4ee] hover:border-[#2a6f6f] transition-all focus:outline-none focus:ring-2 focus:ring-[#2a6f6f]"
        aria-expanded={isOpen}
      >
        <span>{buttonText}</span>
        <svg
          className={`h-4 w-4 text-[#52606d] transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 sm:left-auto sm:right-0 sm:translate-x-0 z-50 w-80 sm:w-96 rounded-2xl bg-white p-4 shadow-2xl border border-[#dfd8ca] animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center justify-between border-b border-[#dfd8ca] pb-3 mb-3">
            <h4 className="text-sm font-bold text-[#14213d] flex items-center gap-2">
              <span>🎙️</span>
              <span>{language === "zh" ? "选择播客平台与语言" : language === "en" ? "Select Podcast Platform & Language" : "Pilih Platform & Bahasa Podcast"}</span>
            </h4>
            <button
              onClick={closeDropdown}
              className="text-[#52606d] hover:text-[#14213d] text-xs font-bold px-1.5 py-0.5 rounded hover:bg-[#f7f4ee]"
            >
              ✕
            </button>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap gap-1 mb-3">
            {[
              { id: "all", label: language === "zh" ? "全部" : language === "en" ? "All" : "Semua" },
              { id: "spotify", label: "Spotify" },
              { id: "apple", label: "Apple" },
              { id: "amazon", label: "Amazon" },
              { id: "youtube", label: "YouTube" },
              { id: "rss", label: "RSS Feed" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActivePlatform(tab.id as any)}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-full transition-colors ${
                  activePlatform === tab.id
                    ? "bg-[#2a6f6f] text-white"
                    : "bg-[#f7f4ee] text-[#52606d] hover:bg-[#e9f5db] hover:text-[#14213d]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Channel Links List */}
          <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
            {filteredChannels.map((item, idx) => {
              const getBadgeColor = (platform: string) => {
                switch (platform) {
                  case "spotify":
                    return "bg-[#1DB954]/10 text-[#1DB954] border-[#1DB954]/30";
                  case "apple":
                    return "bg-[#A259FF]/10 text-[#A259FF] border-[#A259FF]/30";
                  case "amazon":
                    return "bg-[#FF9900]/10 text-[#D97706] border-[#FF9900]/30";
                  case "youtube":
                    return "bg-[#FF0000]/10 text-[#FF0000] border-[#FF0000]/30";
                  default:
                    return "bg-gray-100 text-gray-700 border-gray-200";
                }
              };

              return (
                <a
                  key={idx}
                  href={item.url}
                  target={item.platform === "rss" ? "_self" : "_blank"}
                  rel={item.platform === "rss" ? "" : "noopener noreferrer"}
                  onClick={closeDropdown}
                  className="flex items-center justify-between p-2 rounded-xl hover:bg-[#f7f4ee] border border-transparent hover:border-[#dfd8ca] transition-all group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-base shrink-0">{item.flag}</span>
                    <div className="truncate">
                      <p className="text-xs font-semibold text-[#14213d] truncate group-hover:text-[#2a6f6f]">
                        {item.languageName}
                      </p>
                      <p className="text-[10px] text-[#52606d] truncate">
                        {item.platformName}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${getBadgeColor(
                      item.platform
                    )}`}
                  >
                    {item.platform.toUpperCase()}
                  </span>
                </a>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
