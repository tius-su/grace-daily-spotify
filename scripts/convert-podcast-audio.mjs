import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";

const execFileAsync = promisify(execFile);

/**
 * CLI script to convert audio files to:
 * - Format: MP3
 * - Channel: Mono (1)
 * - Bitrate: 48 kbps (or 32 kbps for TTS)
 * - Sample rate: 22.05 kHz (22050) or 24 kHz (24000)
 */

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.log("Usage: node scripts/convert-podcast-audio.mjs <input-file> <output-file> [bitrate: 32|48] [samplerate: 22050|24000]");
    process.exit(1);
  }

  const [inputPath, outputPath] = args;
  const bitrate = parseInt(args[2] || "48", 10);
  const sampleRate = parseInt(args[3] || "22050", 10);

  if (!fs.existsSync(inputPath)) {
    console.error(`❌ Input file does not exist: ${inputPath}`);
    process.exit(1);
  }

  console.log(`🎵 Converting ${inputPath} to Podcast MP3...`);
  console.log(`   Format: MP3`);
  console.log(`   Channel: Mono (1 channel)`);
  console.log(`   Bitrate: ${bitrate} kbps`);
  console.log(`   Sample Rate: ${sampleRate / 1000} kHz (${sampleRate} Hz)`);

  const ffmpegArgs = [
    "-y",
    "-i", inputPath,
    "-vn",
    "-c:a", "libmp3lame",
    "-ac", "1",
    "-b:a", `${bitrate}k`,
    "-ar", `${sampleRate}`,
    outputPath
  ];

  try {
    const { stdout, stderr } = await execFileAsync("ffmpeg", ffmpegArgs);
    console.log(`✅ Conversion completed successfully! Output: ${outputPath}`);
  } catch (err) {
    console.error("❌ FFmpeg conversion failed:", err.message);
    process.exit(1);
  }
}

main();
