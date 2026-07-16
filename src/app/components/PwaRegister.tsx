"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      // Don't register Service Worker in development mode to avoid dev server reload loops
      if (process.env.NODE_ENV === "development") {
        return;
      }
      
      // Catat apakah halaman sudah dikontrol oleh Service Worker saat pertama dimuat
      const wasControlled = !!navigator.serviceWorker.controller;
      let refreshing = false;

      const reloadForNewServiceWorker = () => {
        if (refreshing) return;
        
        // Jika sebelumnya belum dikontrol (misal: kunjungan pertama),
        // claim pertama oleh service worker baru tidak perlu memicu reload halaman.
        if (!wasControlled) {
          return;
        }

        refreshing = true;
        window.location.reload();
      };

      const registerServiceWorker = () => {
        navigator.serviceWorker.register("/sw.js").then((registration) => {
          // Lakukan pengecekan update secara aman sekali saja
          registration.update().catch((err) => {
            console.warn("Service Worker update failed:", err);
          });
        }).catch((err) => {
          console.error("Service Worker registration failed:", err);
        });
      };

      if (document.readyState === "complete") {
        registerServiceWorker();
      } else {
        window.addEventListener("load", registerServiceWorker, { once: true });
      }

      navigator.serviceWorker.addEventListener("controllerchange", reloadForNewServiceWorker);

      return () => {
        window.removeEventListener("load", registerServiceWorker);
        navigator.serviceWorker.removeEventListener("controllerchange", reloadForNewServiceWorker);
      };
    }
  }, []);

  return null;
}
