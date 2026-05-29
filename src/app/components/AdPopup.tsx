"use client";

import { useEffect, useState } from "react";

type AdConfig = {
  imageUrl?: string;
  targetUrl?: string;
  title?: string;
  isActive?: boolean;
  placement?: string;
};

export function AdPopup({ adConfig }: { adConfig: AdConfig | null }) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (adConfig && adConfig.isActive && adConfig.placement === "popup" && adConfig.imageUrl) {
      const shown = sessionStorage.getItem("grace-daily-popup-shown");
      if (!shown) {
        setIsOpen(true);
      }
    }
  }, [adConfig]);

  function handleClose() {
    setIsOpen(false);
    sessionStorage.setItem("grace-daily-popup-shown", "true");
  }

  if (!isOpen || !adConfig?.imageUrl) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl animate-in zoom-in-95 duration-300">
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white transition hover:bg-black/75"
          aria-label="Tutup"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-5 w-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {adConfig.targetUrl ? (
          <a
            href={adConfig.targetUrl}
            target="_blank"
            rel="noreferrer"
            onClick={handleClose}
            className="block cursor-pointer overflow-hidden"
          >
            <img
              src={adConfig.imageUrl}
              alt={adConfig.title || "Promosi"}
              className="h-auto w-full object-contain transition duration-300 hover:scale-[1.02]"
            />
          </a>
        ) : (
          <div className="overflow-hidden">
            <img
              src={adConfig.imageUrl}
              alt={adConfig.title || "Promosi"}
              className="h-auto w-full object-contain"
            />
          </div>
        )}
      </div>
    </div>
  );
}
