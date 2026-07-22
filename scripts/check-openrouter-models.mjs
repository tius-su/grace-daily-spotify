import fs from "fs";
import path from "path";

const envPath = path.join(process.cwd(), ".env.local");
let orKey = "";
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  const match = envContent.match(/^OPENROUTER_API_KEY_BACKUP2=(.*)$/m);
  if (match) {
    orKey = match[1].trim();
  }
}

async function run() {
  if (!orKey) {
    console.error("OpenRouter key not found");
    return;
  }
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      headers: {
        Authorization: `Bearer ${orKey}`,
      }
    });
    const json = await res.json();
    console.log("Found", json.data?.length, "models");
    const imageModels = json.data?.filter(m => m.id.toLowerCase().includes("image") || m.id.toLowerCase().includes("diffusion") || m.id.toLowerCase().includes("flux"));
    console.log("Image/Diffusion/Flux models:");
    console.log(imageModels?.map(m => m.id));
  } catch (err) {
    console.error(err);
  }
}

run();
