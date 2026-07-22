import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/server/firebase-admin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const adminAuth = getAdminAuth();
    const db = getAdminDb();
    if (!adminAuth || !db) throw new Error("Firebase admin not initialized");

    const decoded = await adminAuth.verifyIdToken(token);

    // Check if user exists in admin_users collection
    const adminDoc = await db.collection("admin_users").doc(decoded.uid).get();

    if (!adminDoc.exists) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check presence of keys (we don't test them to avoid rate limits/charges on load, 
    // just check if they are configured)
    const keys = [
      { name: "GROQ_API_KEY", configured: !!process.env.GROQ_API_KEY },
      { name: "GROQ_API_KEY_BACKUP", configured: !!process.env.GROQ_API_KEY_BACKUP },
      { name: "OPENROUTER_API_KEY", configured: !!process.env.OPENROUTER_API_KEY },
      { name: "OPENROUTER_API_KEY_BACKUP", configured: !!process.env.OPENROUTER_API_KEY_BACKUP },
      { name: "OPENROUTER_API_KEY_BACKUP2 (used as OpenRouter primary if sk-or)", configured: !!process.env.OPENROUTER_API_KEY_BACKUP2 },

      { name: "NVIDIA_API_KEY", configured: !!process.env.NVIDIA_API_KEY },
      { name: "OPENROUTER_API_KEY_BACKUP", configured: !!process.env.OPENROUTER_API_KEY_BACKUP },
      { name: "GEMINI_API_KEY", configured: !!process.env.GEMINI_API_KEY },
    ];

    return NextResponse.json({ keys });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
