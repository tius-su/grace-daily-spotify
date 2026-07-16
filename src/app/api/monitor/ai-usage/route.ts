import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/server/firebase-admin";
import { getAIUsageStats } from "@/lib/server/generate-encyclopedia";
import { Firestore } from "firebase-admin/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Get AI Provider Usage Statistics
 * Returns detailed stats about AI provider usage for monitoring
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    // Optional: Save stats to Firestore for persistence
    const db = getAdminDb();
    const stats = getAIUsageStats();
    
    if (db) {
      try {
        const statsRef = db.collection("monitoring").doc("ai_usage_stats");
        await statsRef.set({
          ...stats,
          lastUpdated: new Date(),
        }, { merge: true });
      } catch (error) {
        console.warn("[AI Monitor] Failed to save stats to Firestore:", error);
      }
    }
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...stats,
    });
  } catch (error: any) {
    console.error("[AI Monitor] Failed to get stats:", error);
    return NextResponse.json(
      { error: error.message || "Failed to retrieve AI usage statistics" },
      { status: 500 }
    );
  }
}

/**
 * Reset AI Usage Statistics
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    // For now, just return current stats
    // To reset, you'd need to restart the server (since logs are in memory)
    const stats = getAIUsageStats();
    
    return NextResponse.json({
      success: true,
      message: "Stats retrieved (use server restart to reset)",
      ...stats,
    });
  } catch (error: any) {
    console.error("[AI Monitor] Failed to reset stats:", error);
    return NextResponse.json(
      { error: error.message || "Failed to reset AI usage statistics" },
      { status: 500 }
    );
  }
}
