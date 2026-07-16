import { readFileSync } from "node:fs";
import path from "node:path";

// 1. Load env variables from .env.local
const envPath = path.join(process.cwd(), ".env.local");
let apiToken = "";
let dbId = "";
let accountId = "";
let r2PublicUrl = "";

try {
  const envContent = readFileSync(envPath, "utf8");
  const lines = envContent.split("\n");
  for (const line of lines) {
    const parts = line.split("=");
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join("=").trim();
      if (key === "CLOUDFLARE_API_TOKEN") apiToken = val;
      if (key === "CLOUDFLARE_D1_DATABASE_ID") dbId = val;
      if (key === "R2_ACCOUNT_ID" || key === "CLOUDFLARE_ACCOUNT_ID_BACKUP") accountId = val;
      if (key === "NEXT_PUBLIC_R2_PUBLIC_URL") r2PublicUrl = val;
    }
  }
} catch (err) {
  console.error("Gagal membaca .env.local:", err.message);
  process.exit(1);
}

// Fallbacks
accountId = accountId || "dd3d0162fefacc8b01a83ca376d06947";
dbId = dbId || "02913987-6b3d-45c9-890a-4f0a43f43b6a";
r2PublicUrl = r2PublicUrl || "https://pub-9ba2247ba0854484a764b2a32e6b6ef1.r2.dev";

if (!apiToken) {
  console.error("Error: CLOUDFLARE_API_TOKEN tidak ditemukan di .env.local");
  process.exit(1);
}

console.log("=== Memulai Sinkronisasi Awal Cloudflare D1 ===");
console.log(`Database ID: ${dbId}`);
console.log(`Account ID : ${accountId}`);
console.log(`R2 URL     : ${r2PublicUrl}`);

async function queryD1(sql, params = []) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${dbId}/query`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sql, params }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`HTTP ${res.status}: ${txt}`);
  }
  const payload = await res.json();
  if (!payload.success) {
    throw new Error(JSON.stringify(payload.errors));
  }
  return payload.result[0].results;
}

async function syncArticles() {
  console.log("\n[1/2] Mengunduh data artikel dari R2...");
  const res = await fetch(`${r2PublicUrl}/backup/blog_posts.json`);
  if (!res.ok) {
    console.warn("Gagal mengunduh blog_posts.json dari R2 public. Lewatkan.");
    return;
  }
  const docs = await res.json();
  console.log(`Berhasil mengunduh ${docs.length} artikel. Menyinkronkan ke D1...`);

  const chunkSize = 50;
  let successCount = 0;

  for (let i = 0; i < docs.length; i += chunkSize) {
    const chunk = docs.slice(i, i + chunkSize);
    let sql = `INSERT INTO articles (id, title, category, r2_path, created_at, tags) VALUES `;
    const params = [];

    const placeholders = chunk.map((d, index) => {
      params.push(
        d.id,
        d.title || "",
        d.category || "",
        `articles/${d.id}.json`,
        d.createdAt || new Date().toISOString(),
        d.tags ? (typeof d.tags === 'string' ? d.tags : JSON.stringify(d.tags)) : ""
      );
      return `(?, ?, ?, ?, ?, ?)`;
    }).join(", ");

    sql += placeholders;
    sql += ` ON CONFLICT(id) DO UPDATE SET
             title=excluded.title,
             category=excluded.category,
             r2_path=excluded.r2_path,
             created_at=excluded.created_at,
             tags=excluded.tags`;

    await queryD1(sql, params);
    successCount += chunk.length;
  }
  console.log(`✅ Berhasil menyinkronkan ${successCount} artikel ke D1.`);
}

async function syncEncyclopedia() {
  console.log("\n[2/2] Mengunduh data kategori ensiklopedia dari R2...");
  const categories = [
    "tokoh", "tempat", "istilah", "perumpamaan", "mukjizat", "kitab", "kronologi",
    "silsilah", "teologi", "teologi-2", "topikal_alkitab", "peristiwa", "peristiwa-2"
  ];
  
  let totalSynced = 0;
  for (const cat of categories) {
    console.log(`Mengunduh ${cat}.json...`);
    const res = await fetch(`${r2PublicUrl}/backup/${cat}.json`);
    if (!res.ok) {
      console.warn(`Gagal mengunduh ${cat}.json dari R2. Lewatkan.`);
      continue;
    }
    const docs = await res.json();
    if (!Array.isArray(docs) || docs.length === 0) continue;
    
    console.log(`Menyinkronkan ${docs.length} data kategori ${cat} ke D1...`);
    const chunkSize = 50;
    
    for (let i = 0; i < docs.length; i += chunkSize) {
      const chunk = docs.slice(i, i + chunkSize);
      let sql = `INSERT INTO encyclopedia (id, slug, keyword, title, kategori, r2_path, updated_at) VALUES `;
      const params = [];

      const placeholders = chunk.map((d, index) => {
        const catName = (d.kategori || cat).toLowerCase();
        const slug = d.slug || (d.id.startsWith(`${catName}-`) ? d.id.substring(catName.length + 1) : d.id);
        params.push(
          d.id,
          slug,
          d.keyword || "",
          d.title || "",
          d.kategori || catName,
          `encyclopedia/${catName}/${slug}.json`,
          d.updatedAt || new Date().toISOString()
        );
        return `(?, ?, ?, ?, ?, ?, ?)`;
      }).join(", ");

      sql += placeholders;
      sql += ` ON CONFLICT(id) DO UPDATE SET
               slug=excluded.slug,
               keyword=excluded.keyword,
               title=excluded.title,
               kategori=excluded.kategori,
               r2_path=excluded.r2_path,
               updated_at=excluded.updated_at`;

      await queryD1(sql, params);
      totalSynced += chunk.length;
    }
  }
  console.log(`✅ Berhasil menyinkronkan ${totalSynced} entri ensiklopedia ke D1.`);
}

async function main() {
  try {
    await syncArticles();
    await syncEncyclopedia();
    console.log("\n=== Sinkronisasi Awal Cloudflare D1 Berhasil! ===");
  } catch (err) {
    console.error("\n❌ Sinkronisasi gagal:", err.message);
    process.exit(1);
  }
}

main();
