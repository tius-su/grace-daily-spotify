import { askDeepSeek, type AiMode } from "@/lib/ai";

const validModes = new Set<AiMode>([
  "pastor",
  "devotional",
  "devotional_pdf",
  "prayer",
  "counseling",
  "bible-study",
  "song_recommendation",
  "sermon_guide",
  "bible-explanation",
  "bible-commentary",
]);

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      mode?: AiMode;
      prompt?: string;
    };

    const mode = body.mode ?? "pastor";
    const prompt = body.prompt?.trim();

    if (!validModes.has(mode)) {
      return Response.json({ error: "Mode AI tidak valid." }, { status: 400 });
    }

    if (!prompt) {
      return Response.json(
        { error: "Prompt wajib diisi." },
        { status: 400 },
      );
    }

    const result = await askDeepSeek(mode, prompt);
    return Response.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "AI gateway gagal diproses.";
    return Response.json({ error: message }, { status: 500 });
  }
}
