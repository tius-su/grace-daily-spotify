/**
 * AdSenseAd Component - Client-side Google AdSense renderer with localStorage caching
 * Fetches configuration from R2 and renders ads based on page/section matching
 */

"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

interface AdSenseConfig {
  ad_client: string;
  ad_slot: string;
  position: string;
  targets: Record<string, boolean>;
  landingSection: string;
  intensity: string;
  isEnabled: boolean;
}

export function AdSenseAd({ placement }: { placement: string }) {
  const [config, setConfig] = useState<AdSenseConfig | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    // Jika sudah diketahui tidak ada config, jangan fetch lagi
    if (notFound || loaded) return;

    // Try to load from localStorage first
    try {
      const cachedConfig = localStorage.getItem("adsenseConfig");
      if (cachedConfig) {
        const parsed = JSON.parse(cachedConfig) as AdSenseConfig;
        if (isConfigValid(parsed)) {
          setConfig(parsed);
          setLoaded(true);
          return;
        }
      }
    } catch {
      // Ignore parse errors
    }

    // Fetch from R2
    const fetchConfig = async () => {
      try {
        const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "";
        if (!R2_PUBLIC_URL) return;

        const url = `${R2_PUBLIC_URL}/ads_config.json`;
        const response = await fetch(url, { cache: "no-store" });

        if (!response.ok) {
          // Jika 404, simpan flag agar tidak fetch ulang — ini normal sebelum config diupload
          setNotFound(true);
          return;
        }

        const data = await response.json();
        if (isConfigValid(data)) {
          localStorage.setItem("adsenseConfig", JSON.stringify(data));
          setConfig(data);
          setLoaded(true);
        } else {
          setNotFound(true);
        }
      } catch {
        // Silent fail — jangan polusi console saat fetch gagal
      }
    };

    fetchConfig();
  }, [loaded, notFound]);

  // Validate config structure
  function isConfigValid(data: any): data is AdSenseConfig {
    return (
      data &&
      typeof data === "object" &&
      typeof data.ad_client === "string" &&
      typeof data.ad_slot === "string" &&
      typeof data.position === "string" &&
      typeof data.targets === "object" &&
      typeof data.landingSection === "string" &&
      typeof data.intensity === "string" &&
      typeof data.isEnabled === "boolean"
    );
  }

  // Check if current page matches config targets
  function isPageTargeted(): boolean {
    if (!config || !config.isEnabled) return false;

    // Check if current page type is targeted
    const pageType = getPageType(pathname);
    return config.targets[pageType] === true;
  }

  // Determine page type from pathname
  // (getPageType has been moved outside)

  // Check if placement matches config
  function isPlacementMatch(): boolean {
    if (!config) return false;
    
    // For landing page, check landingSection
    if (getPageType(pathname) === "landing") {
      return config.landingSection === placement;
    }
    
    // For other pages, check general position
    return config.position === placement;
  }

  // Render the ad if conditions are met
  if (!loaded || notFound || !config || !config.isEnabled || !isPageTargeted() || !isPlacementMatch()) {
    return null;
  }

  return (
    <div className="adsense-container">
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={config.ad_client}
        data-ad-slot={config.ad_slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
      <script
        dangerouslySetInnerHTML={{
          __html: "(adsbygoogle = window.adsbygoogle || []).push({});"
        }}
      />
    </div>
  );
}

// Determine page type from pathname
export function getPageType(path: string): string {
  if (path === "/") return "landing";
  if (path.startsWith("/renungan")) return "renungan";
  if (path.startsWith("/blog")) return "artikel";
  if (path.startsWith("/ensiklopedia")) return "ensiklopedia";
  return "other";
}

// Helper function to determine if AdSense should be loaded on this page
export function shouldLoadAdSense(path: string): boolean {
  const pageType = getPageType(path);
  // Add your logic here based on typical AdSense requirements
  return ["landing", "renungan", "artikel", "ensiklopedia"].includes(pageType);
}