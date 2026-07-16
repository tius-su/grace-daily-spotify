import fs from "fs";
import path from "path";

// Simple env parsing
const envPath = path.join(process.cwd(), ".env.local");
let hfToken = "";
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  const match = envContent.match(/^HUGGINGFACE_ACCESS_TOKEN=(.*)$/m);
  if (match) {
    hfToken = match[1].trim();
  }
}

const model = "black-forest-labs/FLUX.1-schnell"; 
const prompt = "A serene, painterly scene of a glowing figure gently wiping tears from a joyful soul, surrounded by soft golden light and blooming flowers, symbolizing eternal peace and the absence of sorrow.";

async function run() {
  if (!hfToken) {
    console.error("HUGGINGFACE_ACCESS_TOKEN is not defined in .env.local");
    return;
  }
  
  console.log(`Using HF Token: ${hfToken.substring(0, 10)}...`);
  console.log(`Fetching from Hugging Face for model ${model}...`);
  
  try {
    const response = await fetch(
      `https://api-inference.huggingface.co/models/${model}`,
      {
        headers: { 
          Authorization: `Bearer ${hfToken}`,
          "Content-Type": "application/json" 
        },
        method: "POST",
        body: JSON.stringify({ inputs: prompt }),
      }
    );
    
    console.log("Status:", response.status);
    console.log("Content-Type:", response.headers.get("content-type"));
    
    if (response.ok) {
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      fs.writeFileSync("scripts/test-out.jpg", buffer);
      console.log("Success! Image saved to scripts/test-out.jpg");
    } else {
      const text = await response.text();
      console.log("Error body:", text);
    }
  } catch (err) {
    console.error("Fetch Error:", err);
  }
}

run();

run();
