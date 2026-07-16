import { getAdminAuth, getAdminDb, withDbTimeout } from "@/lib/server/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function adminEmailList() {
  return (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export async function GET(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const adminAuth = getAdminAuth();
  const adminDb = getAdminDb();

  if (!token || !adminAuth) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Verify Token (Runs locally / auth service, not bound by Firestore quota)
    const decoded = await adminAuth.verifyIdToken(token);
    const email = decoded.email?.toLowerCase() ?? "";
    const isEmailAdmin = adminEmailList().includes(email);

    let profile: any = {};
    let isAdminDoc = false;
    let activities: any[] = [];
    let biblePlanNotes: any[] = [];
    let dbError = false;

    // 2. Fetch Firestore documents (nested try-catch so quota errors don't trigger 401)
    if (adminDb) {
      try {
        const userRef = adminDb.collection("users").doc(decoded.uid);
        const [userDoc, adminDoc, activitiesSnap, notesSnap] = await withDbTimeout(
          Promise.all([
            userRef.get(),
            adminDb.collection("admin_users").doc(decoded.uid).get(),
            userRef.collection("activities").orderBy("createdAt", "desc").limit(100).get(),
            userRef.collection("bible_plan_notes").orderBy("updatedAt", "desc").limit(100).get(),
          ]),
          2000
        );

        if (userDoc.exists) profile = userDoc.data();
        if (adminDoc.exists) isAdminDoc = true;
        if (activitiesSnap) {
          activities = activitiesSnap.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          }));
        }
        if (notesSnap) {
          biblePlanNotes = notesSnap.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          }));
        }
      } catch (dbErr) {
        console.error("Firestore queries failed in /api/me (likely quota exceeded):", dbErr);
        dbError = true;
      }
    } else {
      dbError = true;
    }

    const isAdmin = isAdminDoc || profile?.role === "admin" || isEmailAdmin;

    return Response.json({
      uid: decoded.uid,
      email: decoded.email,
      isAdmin,
      dbError,
      profile: {
        uid: decoded.uid,
        email: decoded.email,
        ...profile,
        role: profile?.role || (isAdmin ? "admin" : "user"),
      },
      activities,
      biblePlanNotes,
    });
  } catch (error) {
    console.error("Token verification failed in /api/me:", error);
    return Response.json({ error: "Token tidak valid." }, { status: 401 });
  }
}
