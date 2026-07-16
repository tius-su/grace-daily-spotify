import fs from "fs";

const url = "https://pub-9ba2247ba0854484a764b2a32e6b6ef1.r2.dev/daily-banners/golden-2026-06-04-05.png";

async function run() {
  console.log("Fetching banner from R2...");
  try {
    const res = await fetch(url);
    console.log("Status:", res.status);
    console.log("Content-Type:", res.headers.get("content-type"));
    console.log("Content-Length:", res.headers.get("content-length"));
    if (res.ok) {
      const arrayBuffer = await res.arrayBuffer();
      fs.writeFileSync("scripts/test-banner.png", Buffer.from(arrayBuffer));
      console.log("Saved banner to scripts/test-banner.png");
    }
  } catch (err) {
    console.error(err);
  }
}

run();
