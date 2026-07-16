import { existsSync, readFileSync, writeFileSync } from "fs";
import path from "path";

function loadDotEnv(filePath) {
  if (!existsSync(filePath)) return;
  const text = readFileSync(filePath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    process.env[key] = rawValue.replace(/^["']|["']$/g, "");
  }
}

async function test() {
  loadDotEnv(path.join(process.cwd(), ".env.local"));

  const prompt = "A serene Christian educational illustration of an ancient Near East mountain scene, realistic painting style.";
  const width = 1024;
  const height = 768;
  const model = "flux";
  
  const token = process.env.POLLINATIONS_API_KEY || process.env.POLLINATIONS_TOKEN;
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${width}&height=${height}&model=${model}&nologo=true&private=true`;
  
  console.log("Testing Pollinations AI URL:", url);
  console.log("Token configured:", token ? "Yes" : "No");

  const headers = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, {
      method: "GET",
      headers,
    });

    const contentType = response.headers.get("content-type") || "";
    console.log("Response status:", response.status);
    console.log("Response content-type:", contentType);

    if (!response.ok || !contentType.startsWith("image/")) {
      const errorText = await response.text().catch(() => "");
      console.error("Failed to generate image. Details:", errorText);
      process.exit(1);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    console.log(`Success! Image buffer length: ${buffer.length} bytes.`);
    
    // Save to test file
    writeFileSync("scripts/test-pollinations-out.jpg", buffer);
    console.log("Image saved to scripts/test-pollinations-out.jpg");
  } catch (err) {
    console.error("Error occurred:", err);
    process.exit(1);
  }
}

test();
