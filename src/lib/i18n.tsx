"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import idDict from "../locales/id.json";
import enDict from "../locales/en.json";
import zhDict from "../locales/zh.json";

export type LanguageCode = "id" | "en" | "zh";

const dictionaries = {
  id: idDict,
  en: enDict,
  zh: zhDict,
};

interface LanguageContextType {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  t: (path: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>("id");

  useEffect(() => {
    const validLangs: LanguageCode[] = ["id", "en", "zh"];

    // 1. Check localStorage (user's explicit choice takes priority)
    const stored = localStorage.getItem("gda-language") as LanguageCode;
    if (stored && validLangs.includes(stored)) {
      setLanguageState(stored);
      return;
    }

    // 2. Check cookie set by IP-detection middleware (gda-language)
    const cookieMatch = document.cookie.match(/(?:^|;\s*)gda-language=([^;]*)/);
    if (cookieMatch) {
      const cookieLang = decodeURIComponent(cookieMatch[1]) as LanguageCode;
      if (validLangs.includes(cookieLang)) {
        setLanguageState(cookieLang);
        localStorage.setItem("gda-language", cookieLang);
        return;
      }
    }

    // 3. Check Telegram WebApp user language
    if (typeof window !== "undefined" && (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.language_code) {
      const tgLang = (window as any).Telegram.WebApp.initDataUnsafe.user.language_code.toLowerCase();
      if (tgLang.startsWith("zh")) {
        setLanguageState("zh");
        return;
      } else if (tgLang.startsWith("en")) {
        setLanguageState("en");
        return;
      }
    }

    // 4. Check browser language preference
    if (typeof navigator !== "undefined" && navigator.language) {
      const browserLang = navigator.language.toLowerCase();
      if (browserLang.startsWith("zh")) {
        setLanguageState("zh");
      } else if (browserLang.startsWith("en")) {
        setLanguageState("en");
      }
    }
  }, []);


  const setLanguage = (lang: LanguageCode) => {
    setLanguageState(lang);
    localStorage.setItem("gda-language", lang);
    // Set cookie for server-side compatibility if needed
    document.cookie = `gda-language=${lang}; path=/; max-age=31536000; SameSite=Lax`;
  };

  const t = (path: string): string => {
    const keys = path.split(".");
    let current: any = dictionaries[language];

    for (const key of keys) {
      if (current && typeof current === "object" && key in current) {
        current = current[key];
      } else {
        // Fallback to English dictionary if not found in active dictionary
        let fallback: any = dictionaries["en"];
        for (const fKey of keys) {
          if (fallback && typeof fallback === "object" && fKey in fallback) {
            fallback = fallback[fKey];
          } else {
            return path; // Return raw path as ultimate fallback
          }
        }
        return typeof fallback === "string" ? fallback : path;
      }
    }

    return typeof current === "string" ? current : path;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
