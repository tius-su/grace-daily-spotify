import { jsPDF } from "jspdf";
import { auth, db } from "./firebase";
import { doc as fsDoc, getDoc } from "firebase/firestore";

export function shareToWhatsApp(title: string, content: string) {
  let cleanContent = content || "";
  cleanContent = cleanContent.replace(/\r\n/g, "\n");

  // Format markdown headers to WhatsApp bold and add paragraph spacing
  cleanContent = cleanContent.replace(/^#{1,6}\s+(.*)$/gm, '\n\n*$1*\n\n');

  // Format numbered lists to ensure they start on a new paragraph spacing
  cleanContent = cleanContent.replace(/^(\d+\.\s+.*)$/gm, '\n\n$1\n\n');

  // Format section labels ending in a colon (e.g. "Tujuan Pengajaran:")
  cleanContent = cleanContent.replace(/^([A-Za-z0-9\s]{3,30}:)$/gm, '\n\n*$1*\n\n');

  // Clean Markdown bold to WhatsApp bold
  cleanContent = cleanContent.replace(/\*\*(.*?)\*\*/g, '*$1*');

  // Strip links and convert markdown bullet lists to WhatsApp list style
  cleanContent = cleanContent.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  cleanContent = cleanContent.replace(/^\s*\*\s+/gm, '- ');

  // Collapse multiple newlines into clean paragraph double newlines
  cleanContent = cleanContent.replace(/\n{3,}/g, '\n\n');
  cleanContent = cleanContent.trim();

  const text = encodeURIComponent(
    `*${title}*\n\n${cleanContent}\n\n───────────────\nhttps://grace-daily.app`
  );
  window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
}

type DownloadPdfOptions = {
  bannerUrl?: string;
  illustrationUrl?: string;
  subtitle?: string;
};

function textFromContent(content: string) {
  const normalizedHtml = content
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<li>/gi, "- ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1");

  if (typeof document === "undefined") {
    return normalizedHtml;
  }

  const element = document.createElement("div");
  element.innerHTML = normalizedHtml;
  return (element.textContent || element.innerText || normalizedHtml)
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function safeFileName(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "grace-daily"
  );
}

function imageFetchCandidates(url: string) {
  if (typeof window === "undefined") return [url];

  const candidates: string[] = [];
  try {
    const parsed = new URL(url, window.location.origin);

    let decodedPath = decodeURIComponent(parsed.pathname).replace(/^\/+/, "");

    // If it is already a proxied URL, extract the actual key from query params
    if (parsed.pathname.includes("/api/media/public")) {
      const keyQuery = parsed.searchParams.get("key");
      if (keyQuery) {
        decodedPath = decodeURIComponent(keyQuery).replace(/^\/+/, "");
      }
    }

    const isR2Host = parsed.hostname.includes("r2.dev") || parsed.hostname.includes("cloudflare");
    const isKnownFolder = decodedPath.match(/^(encyclopedia-banners|encyclopedia-illustrations|daily-banners|daily-devotions|blog-posts|hero|illustrations|daily-image)\//);

    if (isR2Host || isKnownFolder) {
      candidates.push(`${window.location.origin}/api/media/public?key=${encodeURIComponent(decodedPath)}`);
    }

    // Always add the parsed URL as a fallback
    candidates.push(parsed.href);
  } catch {
    candidates.push(url);
  }

  return Array.from(new Set(candidates));
}

async function fetchImageBlob(url: string) {
  let lastError: unknown = null;

  for (const imageUrl of imageFetchCandidates(url)) {
    try {
      const response = await fetch(imageUrl, { mode: "cors", cache: "force-cache" });
      if (!response.ok) {
        lastError = new Error(`HTTP ${response.status}`);
        continue;
      }

      const contentType = response.headers.get("content-type") || "";
      if (contentType && !contentType.startsWith("image/")) {
        lastError = new Error(`Invalid image type: ${contentType}`);
        continue;
      }

      return await response.blob();
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Gagal memuat gambar PDF.");
}

async function readImage(url: string, label = "gambar") {
  const blob = await fetchImageBlob(url);

  return await new Promise<{ dataUrl: string; width: number; height: number }>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Gagal membaca ${label} PDF.`));
    reader.onload = () => {
      const dataUrl = String(reader.result);
      const image = new Image();
      image.onload = () => resolve({ dataUrl, width: image.width, height: image.height });
      image.onerror = () => reject(new Error(`Format ${label} PDF tidak valid.`));
      image.src = dataUrl;
    };
    reader.readAsDataURL(blob);
  });
}

function addBrandBanner(doc: jsPDF, title: string, subtitle?: string) {
  doc.setFillColor(20, 33, 61);
  doc.roundedRect(10, 12, 190, 44, 3, 3, "F");
  doc.setFillColor(42, 111, 111);
  doc.rect(10, 48, 190, 8, "F");
  doc.setTextColor(255, 209, 102);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Grace Daily", 18, 27);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.text(doc.splitTextToSize(title, 166).slice(0, 2), 18, 39);

  if (subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(233, 245, 219);
    doc.text(doc.splitTextToSize(subtitle, 166).slice(0, 1), 18, 51);
  }
}

/**
 * Add elegant diagonal "gracedaily.my.id" watermark to every page.
 * Adjusted to be less crowded and much lighter to avoid cluttering content.
 */
function addWatermark(doc: jsPDF) {
  const totalPages = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);

    // Gunakan font normal agar tulisan watermark lebih tipis
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);

    // Abu-abu sangat muda/samar (230, 225, 218) agar tidak mengganggu keterbacaan artikel
    doc.setTextColor(230, 225, 218);

    // Kerapatan grid dikurangi (jarak horizontal dan vertikal diperbesar)
    const urlStepX = 90;
    const urlStepY = 65;
    const urlOffsetX = 45;
    const urlOffsetY = 32;

    for (let startY = urlOffsetY - 40; startY < pageHeight + 40; startY += urlStepY) {
      for (let startX = urlOffsetX - 40; startX < pageWidth + 40; startX += urlStepX) {
        doc.text("GraceDaily", startX, startY, {
          angle: 45,
          align: "center",
        });
      }
    }

    // Kembalikan warna teks default untuk konten dokumen berikutnya
    doc.setTextColor(51, 65, 85);
  }
}

function addFooter(doc: jsPDF) {
  const totalPages = doc.getNumberOfPages();

  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(223, 216, 202);
    doc.line(16, 282, 194, 282);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(82, 96, 109);
    doc.text("Grace Daily - https://gracedaily.my.id", 16, 289);
    doc.text(`${page}/${totalPages}`, 190, 289, { align: "right" });
  }
}

export async function downloadPdf(title: string, content: string, options: DownloadPdfOptions = {}) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 16;
  const maxWidth = 178;
  let y = 18;

  // Check premium status to skip watermark
  let skipWatermark = false;
  if (typeof window !== "undefined" && auth?.currentUser && db) {
    try {
      const userRef = fsDoc(db, "users", auth.currentUser.uid);
      const userDoc = await getDoc(userRef);
      if (userDoc.exists()) {
        const data = userDoc.data();
        const role = data?.role;
        const premiumExpiresAt = data?.premiumExpiresAt;
        
        if (role === "admin" || role === "premium") {
          if (role === "admin") {
            skipWatermark = true;
          } else if (premiumExpiresAt) {
            const expiryDate = (premiumExpiresAt as any).toDate ? (premiumExpiresAt as any).toDate() : new Date(premiumExpiresAt as any);
            if (expiryDate > new Date()) {
              skipWatermark = true;
            }
          }
        }
      }
    } catch (err) {
      console.warn("[downloadPdf] Gagal memeriksa status premium user:", err);
    }
  }

  if (options.bannerUrl) {
    try {
      const banner = await readImage(options.bannerUrl, "banner");
      const imageWidth = 190;
      const imageHeight = Math.min(90, imageWidth * (banner.height / banner.width));
      doc.addImage(banner.dataUrl, 10, y, imageWidth, imageHeight);
      y += imageHeight + 12;
    } catch (error) {
      console.warn("Banner PDF tidak bisa dimuat, memakai banner Grace Daily:", error);
      addBrandBanner(doc, title, options.subtitle);
      y = 68;
    }
  } else {
    addBrandBanner(doc, title, options.subtitle);
    y = 68;
  }

  doc.setTextColor(20, 33, 61);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  const titleLines = doc.splitTextToSize(title, maxWidth);
  doc.text(titleLines, marginX, y);
  y += titleLines.length * 8 + 4;

  if (options.subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.setTextColor(82, 96, 109);
    const subtitleLines = doc.splitTextToSize(options.subtitle, maxWidth);
    doc.text(subtitleLines, marginX, y);
    y += subtitleLines.length * 6 + 6;
  }

  doc.setDrawColor(223, 216, 202);
  doc.line(marginX, y, 194, y);
  y += 8;

  if (options.illustrationUrl) {
    try {
      const illustration = await readImage(options.illustrationUrl, "ilustrasi");
      const imageWidth = 178;
      const imageHeight = Math.min(86, imageWidth * (illustration.height / illustration.width));

      if (y + imageHeight + 10 > pageHeight - 22) {
        doc.addPage();
        y = 18;
      }

      doc.addImage(illustration.dataUrl, marginX, y, imageWidth, imageHeight);
      y += imageHeight + 10;
    } catch (error) {
      console.warn("Ilustrasi PDF tidak bisa dimuat:", error);
    }
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(51, 65, 85);

  const paragraphs = textFromContent(content).split(/\n{2,}/).filter(Boolean);

  paragraphs.forEach((paragraph) => {
    const lines = doc.splitTextToSize(paragraph, maxWidth);
    const blockHeight = lines.length * 6 + 4;

    if (y + blockHeight > pageHeight - 22) {
      doc.addPage();
      y = 18;
    }

    doc.text(lines, marginX, y);
    y += blockHeight;
  });

  if (!skipWatermark) {
    addWatermark(doc);
  }
  addFooter(doc);
  doc.save(`${safeFileName(title)}.pdf`);
}

export function toRelativeUrl(url: string | undefined | null): string | undefined {
  if (!url) return undefined;
  try {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      const parsed = new URL(url);
      if (parsed.hostname.endsWith("gracedaily.my.id") || parsed.hostname === "localhost") {
        return parsed.pathname + parsed.search;
      }
    }
  } catch (e) {
    // Ignore
  }
  return url;
}