import fs from 'fs';
import path from 'path';

// Load .env.local into process.env before importing anything that uses it
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const parts = trimmed.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
        process.env[key] = value;
      }
    }
  }
}

async function main() {
  console.log("Starting restore process from R2 backup to D1...");
  
  // Dynamically import the backup service after process.env is populated
  const { downloadFromR2, populateD1Articles, populateD1Encyclopedia } = await import('../src/lib/server/backup-r2-service');

  // 1. Restore Articles
  try {
    console.log("Downloading articles backup (blog_posts.json) from R2...");
    const blogPostsStr = await downloadFromR2("blog_posts.json");
    const articles = JSON.parse(blogPostsStr);
    console.log(`Downloaded ${articles.length} articles.`);
    const artSuccess = await populateD1Articles(articles);
    console.log("Articles restore to D1 success:", artSuccess);
  } catch (err: any) {
    console.error("Error restoring articles:", err.message || err);
  }

  // 2. Restore Encyclopedia
  console.log("Downloading encyclopedia backups from R2...");
  const categories = [
    "tokoh", "tempat", "istilah", "perumpamaan", "mukjizat", "kitab", "kronologi",
    "silsilah", "teologi", "teologi-2", "topikal_alkitab", "peristiwa", "peristiwa-2"
  ];
  
  let allEncyclopedia: any[] = [];
  for (const cat of categories) {
    try {
      console.log(`Downloading ${cat}.json...`);
      const catStr = await downloadFromR2(`${cat}.json`);
      const docs = JSON.parse(catStr);
      console.log(`Downloaded ${docs.length} entries for ${cat}.`);
      allEncyclopedia.push(...docs);
    } catch (err: any) {
      console.warn(`Failed to download or parse ${cat}.json:`, err.message || err);
    }
  }

  if (allEncyclopedia.length > 0) {
    console.log(`Total encyclopedia entries fetched: ${allEncyclopedia.length}. Restoring to D1...`);
    const encSuccess = await populateD1Encyclopedia(allEncyclopedia);
    console.log("Encyclopedia restore to D1 success:", encSuccess);
  } else {
    console.log("No encyclopedia entries found to restore.");
  }
}

main();
