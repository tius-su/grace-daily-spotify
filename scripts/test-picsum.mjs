import fs from "fs";

const devotionId = "golden-2026-06-04-05";
const picsumUrl = `https://picsum.photos/seed/${devotionId}/1024/1024`;

async function run() {
  console.log(`Fetching fallback image from Picsum: ${picsumUrl}`);
  try {
    const res = await fetch(picsumUrl);
    console.log("Status:", res.status);
    console.log("Headers:", Object.fromEntries(res.headers.entries()));
    if (res.ok) {
      const arrayBuffer = await res.arrayBuffer();
      fs.writeFileSync("scripts/test-picsum.jpg", Buffer.from(arrayBuffer));
      console.log("Success! Fallback image saved to scripts/test-picsum.jpg");
    } else {
      console.error("Failed to fetch from Picsum");
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

run();
