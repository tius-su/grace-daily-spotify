import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(process.cwd(), ".env.local") });

import { generateDailyDevotion } from "../src/lib/server/daily-devotion";

async function run() {
  console.log("Generating daily devotion...");
  try {
    const res = await generateDailyDevotion(new Date());
    console.log("Generation Success:", res);
  } catch (error) {
    console.error("Generation Failed with error:", error);
  }
}

run();
