import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";

const execFileAsync = promisify(execFile);

export interface AudioConversionOptions {
  isTtsOnly?: boolean; // If true, uses 32 kbps bitrate; otherwise 48 kbps
  bitrateKbps?: 32 | 48; // Explicit bitrate selection
  sampleRateHz?: 22050 | 24000; // Sample rate: 22.05 kHz or 24 kHz
}

export const DEFAULT_AUDIO_CONFIG: Required<AudioConversionOptions> = {
  isTtsOnly: true,
  bitrateKbps: 48,
  sampleRateHz: 22050,
};

/**
 * Returns FFmpeg CLI flags for audio encoding according to specification:
 * Format: MP3 (libmp3lame)
 * Channel: Mono (-ac 1)
 * Bitrate: 48 kbps or 32 kbps
 * Sample Rate: 22.05 kHz (22050 Hz) or 24 kHz (24000 Hz)
 */
export function buildFfmpegAudioArgs(
  inputPath: string,
  outputPath: string,
  options: AudioConversionOptions = {}
): string[] {
  const isTts = options.isTtsOnly ?? true;
  const bitrate = options.bitrateKbps ?? (isTts ? 32 : 48);
  const sampleRate = options.sampleRateHz ?? (isTts ? 24000 : 22050);

  return [
    "-y", // overwrite output file if it exists
    "-i",
    inputPath,
    "-vn", // disable video stream if any
    "-c:a",
    "libmp3lame",
    "-ac",
    "1", // Mono channel
    "-b:a",
    `${bitrate}k`, // 32k or 48k
    "-ar",
    `${sampleRate}`, // 22050 or 24000
    outputPath,
  ];
}

/**
 * Converts an audio file to podcast MP3 format using local ffmpeg binary.
 */
export async function convertAudioToPodcastMp3(
  inputPath: string,
  outputPath: string,
  options: AudioConversionOptions = {}
): Promise<{ success: boolean; outputPath: string; durationSec?: number }> {
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input audio file not found: ${inputPath}`);
  }

  const args = buildFfmpegAudioArgs(inputPath, outputPath, options);

  try {
    await execFileAsync("ffmpeg", args);
    return {
      success: true,
      outputPath,
    };
  } catch (err: any) {
    console.error("[AudioConverter] Error running ffmpeg:", err?.message || err);
    throw new Error(`FFmpeg audio conversion failed: ${err?.message || "Unknown error"}`);
  }
}
