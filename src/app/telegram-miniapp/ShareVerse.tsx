"use client";

import React, { useRef, useEffect, useState } from "react";

interface ShareVerseProps {
  initialVerseText?: string;
  initialVerseRef?: string;
  isDarkGlobal?: boolean;
}

const TEMPLATES = [
  {
    id: "earthy",
    name: "Earthy Cream",
    bgGradient: ["#fdfcf7", "#f5eedc"],
    textColor: "#2e3a2f",
    accentColor: "#9c7c54",
    borderColor: "#e5d5c0",
    fontFamily: "Georgia, serif"
  },
  {
    id: "sunrise",
    name: "Morning Grace",
    bgGradient: ["#ff9a9e", "#fecfef"],
    textColor: "#3e2723",
    accentColor: "#d81b60",
    borderColor: "rgba(255,255,255,0.4)",
    fontFamily: "Georgia, serif"
  },
  {
    id: "midnight",
    name: "Midnight Stars",
    bgGradient: ["#0f172a", "#1e1b4b"],
    textColor: "#f8fafc",
    accentColor: "#fbbf24",
    borderColor: "rgba(99,102,241,0.3)",
    fontFamily: "Georgia, serif"
  },
  {
    id: "forest",
    name: "Forest Peace",
    bgGradient: ["#14532d", "#052e16"],
    textColor: "#f0fdf4",
    accentColor: "#fde047",
    borderColor: "rgba(22,101,52,0.6)",
    fontFamily: "Georgia, serif"
  },
  {
    id: "lavender",
    name: "Lavender Prayer",
    bgGradient: ["#6366f1", "#a855f7"],
    textColor: "#ffffff",
    accentColor: "#fef08a",
    borderColor: "rgba(255,255,255,0.3)",
    fontFamily: "Georgia, serif"
  }
];

export default function ShareVerse({
  initialVerseText = "Karena Allah sangat mengasihi dunia ini, Ia memberikan Anak-Nya yang tunggal supaya setiap orang yang percaya kepada-Nya tidak binasa, melainkan memperoleh hidup yang kekal.",
  initialVerseRef = "Yohanes 3:16",
  isDarkGlobal = false
}: ShareVerseProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [verseText, setVerseText] = useState(initialVerseText);
  const [verseRef, setVerseRef] = useState(initialVerseRef);
  const [selectedTemplate, setSelectedTemplate] = useState(TEMPLATES[0]);
  const [logoImg, setLogoImg] = useState<HTMLImageElement | null>(null);

  const [isListening, setIsListening] = useState(false);

  const startVoiceInput = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Browser Anda tidak mendukung perekaman suara (Speech Recognition).");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "id-ID";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      if (text) {
        setVerseText(text);
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  // Sync state if props change
  useEffect(() => {
    if (initialVerseText) setVerseText(initialVerseText);
    if (initialVerseRef) setVerseRef(initialVerseRef);
  }, [initialVerseText, initialVerseRef]);

  // Load logo on mount
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = "/logo1.jpg";
    img.onload = () => {
      setLogoImg(img);
    };
  }, []);

  // Function to draw canvas
  const drawImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = 1080;
    const height = 1080;
    canvas.width = width;
    canvas.height = height;

    // 1. Draw Background Gradient
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, selectedTemplate.bgGradient[0]);
    grad.addColorStop(1, selectedTemplate.bgGradient[1]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // 2. Draw Subtle Watermark/Background Motif (Cross icon)
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.rotate(0);
    ctx.fillStyle = selectedTemplate.id === "midnight" || selectedTemplate.id === "forest" || selectedTemplate.id === "lavender"
      ? "rgba(255, 255, 255, 0.03)"
      : "rgba(0, 0, 0, 0.02)";
    
    // Draw simple cross shape in background
    ctx.beginPath();
    ctx.rect(-40, -300, 80, 600); // vertical bar
    ctx.rect(-180, -140, 360, 80); // horizontal bar
    ctx.fill();
    ctx.restore();

    // Draw Large Center Watermark using logoImg with low opacity
    if (logoImg) {
      ctx.save();
      ctx.globalAlpha = selectedTemplate.id === "midnight" || selectedTemplate.id === "forest"
        ? 0.04
        : 0.06;
      const watermarkSize = 480;
      ctx.drawImage(logoImg, width / 2 - watermarkSize / 2, height / 2 - watermarkSize / 2, watermarkSize, watermarkSize);
      ctx.restore();
    }

    // 3. Draw Outer Elegant Border Frame
    ctx.strokeStyle = selectedTemplate.borderColor;
    ctx.lineWidth = 14;
    ctx.strokeRect(50, 50, width - 100, height - 100);

    // Double frame
    ctx.strokeStyle = selectedTemplate.borderColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(70, 70, width - 140, height - 140);

    // 4. Draw Header/Logo Watermark
    let textY = 140;
    let lineY = 160;
    
    if (logoImg) {
      const logoSize = 100;
      ctx.drawImage(logoImg, width / 2 - logoSize / 2, 95, logoSize, logoSize);
      textY = 230;
      lineY = 250;
    }

    ctx.fillStyle = selectedTemplate.accentColor;
    ctx.font = "bold 26px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("GRACE DAILY", width / 2, textY);

    // Mini decorative lines under header
    ctx.strokeStyle = selectedTemplate.accentColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(width / 2 - 40, lineY);
    ctx.lineTo(width / 2 + 40, lineY);
    ctx.stroke();

    // 5. Draw Verse Text (Wrapping text helper)
    ctx.fillStyle = selectedTemplate.textColor;
    ctx.font = `italic 42px ${selectedTemplate.fontFamily}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const text = `“ ${verseText} ”`;
    const words = text.split(" ");
    let line = "";
    const lines = [];
    const maxWidth = width - 240;
    const lineHeight = 65;

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + " ";
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;
      if (testWidth > maxWidth && n > 0) {
        lines.push(line);
        line = words[n] + " ";
      } else {
        line = testLine;
      }
    }
    lines.push(line);

    // Calculate vertical start position to center text block
    const textBlockHeight = lines.length * lineHeight;
    let startY = Math.max(logoImg ? 280 : 180, (height - textBlockHeight) / 2);

    // Adjust font size dynamically if text is very long
    if (lines.length > 8) {
      ctx.font = `italic 34px ${selectedTemplate.fontFamily}`;
      // recalculate wrap with smaller font size
      let line2 = "";
      const lines2 = [];
      for (let n = 0; n < words.length; n++) {
        const testLine = line2 + words[n] + " ";
        const metrics = ctx.measureText(testLine);
        const testWidth = metrics.width;
        if (testWidth > maxWidth && n > 0) {
          lines2.push(line2);
          line2 = words[n] + " ";
        } else {
          line2 = testLine;
        }
      }
      lines2.push(line2);
      lines.length = 0;
      lines.push(...lines2);
    }

    lines.forEach((lineText, index) => {
      ctx.fillText(lineText.trim(), width / 2, startY + index * lineHeight);
    });

    // 6. Draw Verse Reference
    const refY = height - 160;
    ctx.fillStyle = selectedTemplate.accentColor;
    ctx.font = `bold 32px ${selectedTemplate.fontFamily}`;
    ctx.fillText(`—  ${verseRef}  —`, width / 2, refY);
  };

  // Redraw when states change
  useEffect(() => {
    drawImage();
  }, [verseText, verseRef, selectedTemplate, logoImg]);

  // Download image handler
  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL("image/jpeg", 0.95);
    const link = document.createElement("a");
    link.download = `GraceDaily_Verse_${verseRef.replace(/[:\s]/g, "_")}.jpg`;
    link.href = url;
    link.click();
  };

  return (
    <div className="space-y-4 pt-2">
      <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
        🎨 Bagikan Ayat Estetik (Social Sharing)
      </h4>

      {/* Preview Canvas - responsive scale down */}
      <div className="flex justify-center border border-gray-300/20 rounded-2xl overflow-hidden shadow-lg bg-black/5">
        <canvas
          ref={canvasRef}
          className="w-full max-w-sm aspect-square bg-[#f7f4ee] object-contain shadow-inner"
          style={{ maxHeight: "350px" }}
        />
      </div>

      {/* Editor Controls */}
      <div className="space-y-3">
        <div>
          <label className="block text-[11px] font-bold uppercase mb-1 text-slate-400">
            Pilih Template Desain
          </label>
          <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
            {TEMPLATES.map((tmpl) => (
              <button
                key={tmpl.id}
                onClick={() => setSelectedTemplate(tmpl)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 border transition-all active:scale-95 ${
                  selectedTemplate.id === tmpl.id
                    ? "bg-indigo-600 text-white border-transparent shadow"
                    : isDarkGlobal
                      ? "bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700"
                      : "bg-white border-gray-200 text-slate-700 hover:border-gray-300"
                }`}
              >
                {tmpl.name}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2.5">
          <div>
            <label className="block text-[11px] font-bold uppercase mb-1 text-slate-400">
              Referensi Ayat
            </label>
            <input
              type="text"
              className={`w-full border rounded-xl py-2 px-3 text-xs focus:outline-none focus:ring-1 ${
                isDarkGlobal
                  ? "bg-slate-950 border-slate-800 text-slate-100 focus:ring-indigo-500"
                  : "bg-white border-[#dfd8ca] text-slate-900 focus:ring-teal-600"
              }`}
              value={verseRef}
              onChange={(e) => setVerseRef(e.target.value)}
              placeholder="Yohanes 3:16"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-[11px] font-bold uppercase text-slate-400">
                Isi Ayat
              </label>
              <button
                type="button"
                onClick={startVoiceInput}
                className={`text-[10px] font-semibold flex items-center gap-1 transition-all active:scale-95 ${
                  isListening 
                    ? "text-red-500 animate-pulse font-bold" 
                    : isDarkGlobal ? "text-indigo-400 hover:text-indigo-300" : "text-teal-650 hover:text-teal-800"
                }`}
                title="Input isi ayat menggunakan suara (Voice to Text)"
              >
                {isListening ? "🔴 Merekam..." : "🎙️ Voice to Text"}
              </button>
            </div>
            <textarea
              rows={3}
              className={`w-full border rounded-xl py-2 px-3 text-xs focus:outline-none focus:ring-1 resize-none ${
                isDarkGlobal
                  ? "bg-slate-950 border-slate-800 text-slate-100 focus:ring-indigo-500"
                  : "bg-white border-[#dfd8ca] text-slate-900 focus:ring-teal-600"
              }`}
              value={verseText}
              onChange={(e) => setVerseText(e.target.value)}
              placeholder="Tuliskan isi ayat di sini..."
            />
          </div>
        </div>

        <button
          onClick={handleDownload}
          className="w-full font-bold py-3 px-4 rounded-xl text-xs transition-all active:scale-95 text-center flex items-center justify-center gap-1.5 shadow-md bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white"
        >
          📥 Unduh Gambar (Resolusi Tinggi)
        </button>
      </div>
    </div>
  );
}
