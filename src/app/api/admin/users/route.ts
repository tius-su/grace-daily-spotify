import { verifyAdmin } from "@/lib/server/auth";
import { getAdminDb } from "@/lib/server/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET: Fetch paginated and filtered list of users
export async function GET(request: Request) {
  try {
    // 1. Verify that current requester is admin
    const adminUser = await verifyAdmin(request);
    if (!adminUser) {
      return Response.json({ error: "Unauthorized. Admin access required." }, { status: 401 });
    }

    const adminDb = getAdminDb();
    if (!adminDb) {
      return Response.json({ error: "Database connection not available." }, { status: 503 });
    }

    // 2. Parse search parameters
    const url = new URL(request.url);
    const search = url.searchParams.get("search") || "";
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const limit = Math.max(1, parseInt(url.searchParams.get("limit") || "10", 10));
    const offset = (page - 1) * limit;

    let baseQuery = adminDb.collection("users");
    
    // Efficient prefix search on email field if search query is provided
    if (search.trim()) {
      const cleanSearch = search.trim().toLowerCase();
      baseQuery = baseQuery
        .where("email", ">=", cleanSearch)
        .where("email", "<=", cleanSearch + "\uf8ff") as any;
    }

    // 3. Get total count of matched users resource-efficiently using Firestore count()
    const countSnap = await baseQuery.count().get();
    const totalUsers = countSnap.data().count;
    const totalPages = Math.ceil(totalUsers / limit);

    // 4. Fetch the specific page's user documents
    const usersSnap = await baseQuery
      .orderBy("email")
      .offset(offset)
      .limit(limit)
      .get();

    const users = usersSnap.docs.map((doc) => {
      const data = doc.data();
      // Format premiumExpiresAt if it is a Firestore Timestamp
      let premiumExpiresAt = data.premiumExpiresAt;
      if (premiumExpiresAt && typeof premiumExpiresAt.toDate === "function") {
        premiumExpiresAt = premiumExpiresAt.toDate().toISOString();
      } else if (premiumExpiresAt instanceof Date) {
        premiumExpiresAt = premiumExpiresAt.toISOString();
      }

      return {
        uid: doc.id,
        email: data.email || "",
        displayName: data.displayName || "",
        role: data.role || "user",
        selectedPlan: data.selectedPlan || "",
        premiumExpiresAt,
        createdAt: data.createdAt,
      };
    });

    return Response.json({
      users,
      currentPage: page,
      totalPages,
      totalUsers,
      limit,
    });
  } catch (error: any) {
    console.error("[GET /api/admin/users] Error:", error);
    return Response.json({ error: error?.message || "Internal Server Error" }, { status: 500 });
  }
}

// POST: Update user's role and premium active period
export async function POST(request: Request) {
  try {
    // 1. Verify that current requester is admin
    const adminUser = await verifyAdmin(request);
    if (!adminUser) {
      return Response.json({ error: "Unauthorized. Admin access required." }, { status: 401 });
    }

    const adminDb = getAdminDb();
    if (!adminDb) {
      return Response.json({ error: "Database connection not available." }, { status: 503 });
    }

    // 2. Parse request body
    const body = await request.json().catch(() => ({}));
    const { uid, role, durationDays } = body; // durationDays can be number or "unlimited"

    if (!uid || !role) {
      return Response.json({ error: "Parameters uid and role are required." }, { status: 400 });
    }

    const allowedRoles = ["user", "premium", "admin"];
    if (!allowedRoles.includes(role)) {
      return Response.json({ error: `Invalid role. Must be one of: ${allowedRoles.join(", ")}` }, { status: 400 });
    }

    // Fetch targeted user doc
    const userRef = adminDb.collection("users").doc(uid);
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      return Response.json({ error: "Target user not found." }, { status: 404 });
    }
    const userData = userDoc.data() || {};
    const userEmail = userData.email || "";

    const now = new Date();
    let expiresAt: Date | null = null;
    let selectedPlan = "";

    // 3. Process status assignment
    if (role === "admin") {
      // Auto unlimited for admin
      expiresAt = new Date("2099-12-31T23:59:59Z"); // Far future representation of unlimited
      selectedPlan = "Unlimited Admin";

      // Register inside admin_users collection
      await adminDb.collection("admin_users").doc(uid).set({
        uid,
        email: userEmail,
        role: "admin",
        promotedBy: adminUser.uid,
        updatedAt: now,
      });
    } else if (role === "premium") {
      selectedPlan = durationDays === "unlimited" ? "Premium Unlimited" : `Premium ${durationDays} Hari`;
      
      if (durationDays === "unlimited") {
        expiresAt = new Date("2099-12-31T23:59:59Z");
      } else {
        const days = parseInt(durationDays, 10);
        if (isNaN(days) || days <= 0) {
          return Response.json({ error: "Invalid durationDays for Premium role." }, { status: 400 });
        }
        expiresAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
      }

      // If they were admin, delete from admin_users for safety
      await adminDb.collection("admin_users").doc(uid).delete().catch(() => null);
    } else {
      // Regular user
      selectedPlan = "";
      expiresAt = null;

      // Delete from admin_users for safety
      await adminDb.collection("admin_users").doc(uid).delete().catch(() => null);
    }

    // 4. Update the user document in users collection
    await userRef.set(
      {
        role,
        selectedPlan,
        premiumActivatedAt: role !== "user" ? now : null,
        premiumExpiresAt: expiresAt,
        updatedAt: now,
      },
      { merge: true }
    );

    // Save activity log
    await userRef.collection("activities").add({
      type: "role_update",
      title: `Status diperbarui oleh Admin`,
      description: `Role diubah menjadi ${role.toUpperCase()}${
        expiresAt ? ` sampai ${expiresAt.toLocaleDateString("id-ID")}` : ""
      }.`,
      createdAt: now,
    });

    console.log(`[Admin Update User] User ${uid} updated to role: ${role}, plan: ${selectedPlan}`);

    return Response.json({
      success: true,
      message: `User role updated successfully to ${role}.`,
    });
  } catch (error: any) {
    console.error("[POST /api/admin/users] Error updating user role:", error);
    return Response.json({ error: error?.message || "Internal Server Error" }, { status: 500 });
  }
}
