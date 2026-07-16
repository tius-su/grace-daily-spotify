"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useLanguage } from "@/lib/i18n";

const buttonTranslations = {
  id: {
    whatsappBtn: "Ikuti WhatsApp Channel Grace Daily",
  },
  en: {
    whatsappBtn: "Follow Grace Daily WhatsApp Channel",
  },
  zh: {
    whatsappBtn: "关注 Grace Daily WhatsApp 频道",
  }
};

interface WhatsAppChannelButtonProps {
  variant?: "primary" | "outline" | "text";
  size?: "sm" | "md" | "lg";
  sourcePage: string;
  className?: string;
}

const DEFAULT_CHANNEL_URL = "https://whatsapp.com/channel/0029VbCUBJfG8l5A2qoOPN0w";

export function WhatsAppChannelButton({
  variant = "primary",
  size = "md",
  sourcePage,
  className = "",
}: WhatsAppChannelButtonProps) {
  const [channelUrl, setChannelUrl] = useState(DEFAULT_CHANNEL_URL);
  const { language } = useLanguage();
  const t = buttonTranslations[language] || buttonTranslations.id;

  useEffect(() => {
    async function fetchChannelUrl() {
      if (!db) return;
      try {
        const docRef = doc(db, "settings", "google_codes");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.WHATSAPP_CHANNEL_URL) {
            setChannelUrl(data.WHATSAPP_CHANNEL_URL);
          }
        }
      } catch (err) {
        console.warn("Gagal mengambil WHATSAPP_CHANNEL_URL dari Firestore settings:", err);
      }
    }
    fetchChannelUrl();
  }, []);

  const handleClick = () => {
    // Tracking Google Analytics
    if (typeof window !== "undefined" && (window as any).gtag) {
      (window as any).gtag("event", "whatsapp_channel_click", {
        source_page: sourcePage,
        channel_url: channelUrl,
      });
    }
    console.log(`[WA Tracking] whatsapp_channel_click dari ${sourcePage}`);
  };

  // Styles based on variant
  let variantClasses = "";
  if (variant === "primary") {
    variantClasses = "bg-[#25D366] hover:bg-[#20ba56] text-white font-semibold shadow-md hover:shadow-lg transition-all duration-300 border border-transparent";
  } else if (variant === "outline") {
    variantClasses = "bg-transparent hover:bg-[#25D366]/10 text-[#25D366] border border-[#25D366] font-semibold transition-all duration-300";
  } else {
    variantClasses = "bg-transparent text-[#25D366] hover:underline font-medium";
  }

  // Styles based on size
  let sizeClasses = "";
  if (size === "sm") {
    sizeClasses = "px-3 py-1.5 text-xs rounded-lg gap-1.5";
  } else if (size === "lg") {
    sizeClasses = "px-6 py-3.5 text-base rounded-xl gap-3";
  } else {
    sizeClasses = "px-5 py-2.5 text-sm rounded-lg gap-2";
  }

  return (
    <a
      href={channelUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className={`inline-flex items-center justify-center font-sans tracking-wide active:scale-[0.98] transition-transform ${variantClasses} ${sizeClasses} ${className}`}
    >
      {/* WhatsApp SVG Icon */}
      <svg
        className={size === "sm" ? "w-4 h-4" : size === "lg" ? "w-6 h-6" : "w-5 h-5"}
        fill="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.625 1.45 5.539 0 10.046-4.502 10.05-10.04.002-2.684-1.034-5.207-2.92-7.096C16.516 1.58 14.007.545 11.33.545 5.792.545 1.286 5.048 1.282 10.59c-.001 1.542.413 3.053 1.2 4.417l-.993 3.63 3.731-.978c1.332.727 2.8.109 2.8.109zm11.366-7.46c-.092-.15-.339-.24-.707-.424-.367-.184-2.172-1.072-2.502-1.193-.33-.12-.57-.18-.809.18-.24.36-.93 1.162-1.139 1.396-.21.235-.42.264-.788.08-.368-.183-1.554-.572-2.962-1.828-1.096-.975-1.837-2.18-2.05-2.549-.214-.369-.022-.568.16-.75.163-.165.368-.425.55-.638.183-.213.244-.365.368-.61.122-.245.061-.459-.03-.643-.092-.184-.81-1.947-1.11-2.677-.291-.703-.587-.607-.81-.617-.208-.01-.447-.01-.687-.01-.24 0-.63.09-.96.45-.33.36-1.258 1.23-1.258 3.003 0 1.771 1.289 3.486 1.472 3.73 1.83 2.458 4.296 4.09 7.785 5.378.828.307 1.474.49 1.977.65.83.264 1.587.227 2.184.138.666-.099 2.172-.888 2.477-1.745.305-.856.305-1.591.214-1.744z" />
      </svg>
      <span>{t.whatsappBtn}</span>
    </a>
  );
}
