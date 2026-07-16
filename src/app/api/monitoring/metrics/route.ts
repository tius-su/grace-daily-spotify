import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { getAdminDb } from '@/lib/server/firebase-admin';

/**
 * Simple metrics endpoint for real‑time observability.
 * Returns JSON with counters that are stored in a Firestore document
 * `metrics/app` (you can adapt the storage as you wish).
 */
export async function GET() {
  try {
    const db = getAdminDb();
    if (!db) {
      // Firestore not available – return defaults or error
      const defaultMetrics = {
        cronSuccessCount: 0,
        cronFailureCount: 0,
        telegramSuccess: 0,
        telegramFailure: 0,
        r2UploadBytes: 0,
        r2DownloadBytes: 0,
        lastUpdated: new Date().toISOString(),
      };
      return NextResponse.json(defaultMetrics);
    }
    const doc = await db.collection('metrics').doc('app').get();
    const data = doc.exists ? doc.data() : {};
    // Provide defaults if fields missing
    const defaultMetrics = {
      cronSuccessCount: 0,
      cronFailureCount: 0,
      telegramSuccess: 0,
      telegramFailure: 0,
      r2UploadBytes: 0,
      r2DownloadBytes: 0,
      lastUpdated: new Date().toISOString(),
    };
    const response = { ...defaultMetrics, ...data };
    return NextResponse.json(response);
  } catch (e) {
    Sentry.captureException(e);
    return NextResponse.json({ error: 'metrics fetch failed', details: e }, { status: 500 });
  }
}
