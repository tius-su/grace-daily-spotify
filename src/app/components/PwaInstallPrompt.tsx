"use client";

import { useEffect, useState, useCallback } from "react";

// --- Config ---
const WHATSAPP_CHANNEL_URL = "https://www.whatsapp.com/channel/0029VbCUBJfG8l5A2qoOPN0w";
const TELEGRAM_CHANNEL_URL = "https://t.me/gracedailybible";
const DISMISSED_KEY = "pwa-community-prompt-dismissed";
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 hari

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type PromptStep = "community" | "install";

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState<PromptStep>("community");
  const [installing, setInstalling] = useState(false);
  const [joinedWa, setJoinedWa] = useState(false);
  const [joinedTg, setJoinedTg] = useState(false);

  useEffect(() => {
    // Jangan tampilkan jika sudah dismiss dalam 7 hari
    const dismissed = localStorage.getItem(DISMISSED_KEY);
    if (dismissed && Date.now() - Number(dismissed) < DISMISS_DURATION_MS) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
      setStep("community");
      setJoinedWa(false);
      setJoinedTg(false);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const dismiss = useCallback(() => {
    setVisible(false);
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
  }, []);

  const handleJoinWa = () => {
    window.open(WHATSAPP_CHANNEL_URL, "_blank");
    setJoinedWa(true);
  };

  const handleJoinTg = () => {
    window.open(TELEGRAM_CHANNEL_URL, "_blank");
    setJoinedTg(true);
  };

  const handleContinueToInstall = () => {
    setStep("install");
  };

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        localStorage.setItem(DISMISSED_KEY, String(Date.now()));
      }
    } finally {
      setDeferredPrompt(null);
      setInstalling(false);
      setVisible(false);
    }
  };

  if (!visible) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="pwa-backdrop"
        onClick={dismiss}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className="pwa-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Install Grace Daily App"
      >
        {/* Header gradient bar */}
        <div className="pwa-modal-bar" />

        {/* Close button */}
        <button
          className="pwa-close-btn"
          onClick={dismiss}
          aria-label="Tutup"
        >
          ✕
        </button>

        {/* App Identity */}
        <div className="pwa-app-identity">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo1.jpg"
            alt="Grace Daily Logo"
            className="pwa-app-logo"
          />
          <div>
            <div className="pwa-app-name">Grace Daily Mini App</div>
            <div className="pwa-app-domain">app.gracedaily.my.id</div>
          </div>
        </div>

        {/* STEP 1: Community Prompt */}
        {step === "community" && (
          <div className="pwa-step">
            <div className="pwa-step-badge">Sebelum Install</div>
            <h2 className="pwa-step-title">
              Bergabung ke Komunitas kami!
            </h2>
            <p className="pwa-step-desc">
              Dapatkan renungan harian, update fitur terbaru, dan konten rohani eksklusif langsung di channel kami.
            </p>

            <div className="pwa-channels">
              {/* WhatsApp Channel */}
              <button
                className={`pwa-channel-btn pwa-channel-wa ${joinedWa ? "pwa-channel-joined" : ""}`}
                onClick={handleJoinWa}
              >
                <span className="pwa-channel-icon">
                  {joinedWa ? "✅" : (
                    <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                    </svg>
                  )}
                </span>
                <div className="pwa-channel-info">
                  <span className="pwa-channel-name">Channel WhatsApp</span>
                  <span className="pwa-channel-sub">{joinedWa ? "Sudah bergabung ✓" : "Ketuk untuk bergabung"}</span>
                </div>
              </button>

              {/* Telegram Channel */}
              <button
                className={`pwa-channel-btn pwa-channel-tg ${joinedTg ? "pwa-channel-joined" : ""}`}
                onClick={handleJoinTg}
              >
                <span className="pwa-channel-icon">
                  {joinedTg ? "✅" : (
                    <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
                      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                    </svg>
                  )}
                </span>
                <div className="pwa-channel-info">
                  <span className="pwa-channel-name">Channel Telegram</span>
                  <span className="pwa-channel-sub">{joinedTg ? "Sudah bergabung ✓" : "@gracedailybible"}</span>
                </div>
              </button>
            </div>

            <button
              className="pwa-btn-primary"
              onClick={handleContinueToInstall}
            >
              Lanjutkan Install App →
            </button>
            <button className="pwa-btn-skip" onClick={dismiss}>
              Lewati, jangan ingatkan lagi
            </button>
          </div>
        )}

        {/* STEP 2: Install Prompt */}
        {step === "install" && (
          <div className="pwa-step">
            <div className="pwa-step-badge pwa-badge-green">Install PWA</div>
            <h2 className="pwa-step-title">
              Install Grace Daily App
            </h2>
            <p className="pwa-step-desc">
              Nikmati pengalaman terbaik seperti aplikasi native — akses cepat, offline support, dan notifikasi rohani harian.
            </p>

            <div className="pwa-features">
              {[
                { icon: "⚡", text: "Akses super cepat dari Home Screen" },
                { icon: "📶", text: "Dukungan offline & caching konten" },
                { icon: "🔔", text: "Notifikasi renungan harian" },
                { icon: "📱", text: "Tampilan layar penuh tanpa browser bar" },
              ].map((f) => (
                <div key={f.text} className="pwa-feature-item">
                  <span>{f.icon}</span>
                  <span>{f.text}</span>
                </div>
              ))}
            </div>

            <button
              className="pwa-btn-primary"
              onClick={handleInstall}
              disabled={installing}
            >
              {installing ? "Memproses..." : "📲 Install Sekarang"}
            </button>
            <button className="pwa-btn-skip" onClick={dismiss}>
              Nanti saja
            </button>
          </div>
        )}
      </div>

      {/* Scoped styles */}
      <style>{`
        .pwa-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.65);
          backdrop-filter: blur(6px);
          z-index: 9998;
          animation: pwaFadeIn 0.25s ease;
        }
        .pwa-modal {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          z-index: 9999;
          background: linear-gradient(160deg, #0f172a 0%, #1e293b 100%);
          border-radius: 24px 24px 0 0;
          padding: 28px 24px 32px;
          box-shadow: 0 -8px 60px rgba(0,0,0,0.6);
          animation: pwaSlideUp 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
          max-width: 480px;
          margin: 0 auto;
          border-top: 1px solid rgba(99,102,241,0.25);
        }
        .pwa-modal-bar {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: linear-gradient(90deg, #0d9488, #6366f1, #a855f7);
          border-radius: 24px 24px 0 0;
        }
        .pwa-close-btn {
          position: absolute;
          top: 16px;
          right: 20px;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.12);
          color: #94a3b8;
          font-size: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
        }
        .pwa-close-btn:hover { background: rgba(255,255,255,0.15); color: #e2e8f0; }
        .pwa-app-identity {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 20px;
          margin-top: 4px;
        }
        .pwa-app-logo {
          width: 52px;
          height: 52px;
          border-radius: 14px;
          border: 2px solid rgba(99,102,241,0.35);
          object-fit: cover;
        }
        .pwa-app-name {
          font-size: 16px;
          font-weight: 700;
          color: #f1f5f9;
          letter-spacing: -0.01em;
        }
        .pwa-app-domain {
          font-size: 11px;
          color: #64748b;
          margin-top: 2px;
        }
        .pwa-step { display: flex; flex-direction: column; gap: 0; }
        .pwa-step-badge {
          display: inline-block;
          background: rgba(99,102,241,0.18);
          border: 1px solid rgba(99,102,241,0.3);
          color: #a5b4fc;
          font-size: 9px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          padding: 3px 10px;
          border-radius: 999px;
          width: fit-content;
          margin-bottom: 10px;
        }
        .pwa-badge-green {
          background: rgba(13,148,136,0.18);
          border-color: rgba(13,148,136,0.3);
          color: #5eead4;
        }
        .pwa-step-title {
          font-size: 20px;
          font-weight: 800;
          color: #f8fafc;
          margin: 0 0 8px;
          line-height: 1.25;
        }
        .pwa-step-desc {
          font-size: 13px;
          color: #94a3b8;
          line-height: 1.6;
          margin: 0 0 20px;
        }
        .pwa-channels { display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px; }
        .pwa-channel-btn {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 14px 16px;
          border-radius: 14px;
          border: 1.5px solid transparent;
          cursor: pointer;
          text-align: left;
          transition: all 0.25s;
          width: 100%;
        }
        .pwa-channel-wa {
          background: rgba(37,211,102,0.1);
          border-color: rgba(37,211,102,0.25);
          color: #4ade80;
        }
        .pwa-channel-wa:hover { background: rgba(37,211,102,0.18); border-color: rgba(37,211,102,0.45); }
        .pwa-channel-tg {
          background: rgba(0,136,204,0.1);
          border-color: rgba(0,136,204,0.25);
          color: #38bdf8;
        }
        .pwa-channel-tg:hover { background: rgba(0,136,204,0.18); border-color: rgba(0,136,204,0.45); }
        .pwa-channel-joined {
          opacity: 0.7;
          border-color: rgba(255,255,255,0.1) !important;
        }
        .pwa-channel-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 38px;
          height: 38px;
          border-radius: 10px;
          background: rgba(255,255,255,0.07);
          flex-shrink: 0;
          font-size: 20px;
        }
        .pwa-channel-info { display: flex; flex-direction: column; gap: 2px; }
        .pwa-channel-name { font-size: 13px; font-weight: 700; color: #e2e8f0; }
        .pwa-channel-sub { font-size: 11px; color: #64748b; }
        .pwa-features { display: flex; flex-direction: column; gap: 10px; margin-bottom: 22px; }
        .pwa-feature-item {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 13px;
          color: #cbd5e1;
          background: rgba(255,255,255,0.04);
          padding: 10px 14px;
          border-radius: 10px;
          border: 1px solid rgba(255,255,255,0.06);
        }
        .pwa-btn-primary {
          width: 100%;
          padding: 15px;
          border-radius: 14px;
          background: linear-gradient(135deg, #0d9488 0%, #6366f1 100%);
          color: white;
          font-size: 14px;
          font-weight: 700;
          border: none;
          cursor: pointer;
          transition: all 0.2s;
          margin-bottom: 10px;
          letter-spacing: 0.01em;
          box-shadow: 0 4px 20px rgba(99,102,241,0.35);
        }
        .pwa-btn-primary:hover { transform: translateY(-1px); box-shadow: 0 6px 24px rgba(99,102,241,0.45); }
        .pwa-btn-primary:active { transform: translateY(0); }
        .pwa-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
        .pwa-btn-skip {
          width: 100%;
          padding: 10px;
          border-radius: 10px;
          background: transparent;
          border: none;
          color: #475569;
          font-size: 12px;
          cursor: pointer;
          transition: color 0.2s;
        }
        .pwa-btn-skip:hover { color: #64748b; }
        @keyframes pwaFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes pwaSlideUp { from { transform: translateY(100%) } to { transform: translateY(0) } }
      `}</style>
    </>
  );
}
