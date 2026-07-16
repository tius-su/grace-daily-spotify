import fs from "fs";
import path from "path";

const files = [".env.local", ".env.vercel.local", ".env"];
for (const file of files) {
  const filepath = path.resolve(process.cwd(), file);
  if (fs.existsSync(filepath)) {
    const content = fs.readFileSync(filepath, "utf-8");
    const lines = content.split("\n");
    console.log(`=== Keys in ${file} ===`);
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const parts = trimmed.split("=");
        console.log(parts[0]);
      }
    }
  }
}
