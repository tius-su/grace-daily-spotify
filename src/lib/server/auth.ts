import { getAdminAuth, getAdminDb } from "./firebase-admin";

function adminEmailList() {
  return (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export async function verifyAdmin(request: Request): Promise<{ uid: string; email?: string } | null> {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;

  const adminAuth = getAdminAuth();
  if (!adminAuth) return null;

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const email = decoded.email?.toLowerCase() ?? "";
    const isEmailAdmin = adminEmailList().includes(email);

    if (isEmailAdmin) {
      return { uid: decoded.uid, email: decoded.email };
    }

    const adminDb = getAdminDb();
    if (adminDb) {
      const [userDoc, adminDoc] = await Promise.all([
        adminDb.collection("users").doc(decoded.uid).get(),
        adminDb.collection("admin_users").doc(decoded.uid).get(),
      ]);

      const userData = userDoc.data();
      const isAdmin = adminDoc.exists || userData?.role === "admin";

      if (isAdmin) {
        return { uid: decoded.uid, email: decoded.email };
      }
    }
    return null;
  } catch (error) {
    console.error("verifyAdmin failed:", error);
    return null;
  }
}
