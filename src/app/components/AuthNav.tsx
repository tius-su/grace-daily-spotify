"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import Link from "next/link";
import { auth } from "@/lib/firebase";

export function AuthNav() {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const token = await currentUser.getIdToken();
          const response = await fetch("/api/me", {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
          });
          
          let isUserAdmin = false;
          if (response.ok) {
            const data = await response.json();
            isUserAdmin = Boolean(data.isAdmin);
          }

          // Fallback check client-side firestore if /api/me didn't confirm admin
          // This is useful if server-side hits a quota limit
          if (!isUserAdmin) {
            const { getDoc, doc } = await import("firebase/firestore");
            const { db } = await import("@/lib/firebase");
            if (db) {
              try {
                const userDoc = await getDoc(doc(db, "users", currentUser.uid));
                if (userDoc.exists() && userDoc.data().role === "admin") {
                  isUserAdmin = true;
                }
              } catch (e) {
                console.error("Client side firestore admin check failed:", e);
              }
            }
          }

          setIsAdmin(isUserAdmin);
        } catch (error) {
          console.error("Gagal verifikasi admin:", error);
          
          // Fallback if fetch completely fails
          try {
            const { getDoc, doc } = await import("firebase/firestore");
            const { db } = await import("@/lib/firebase");
            if (db) {
              const userDoc = await getDoc(doc(db, "users", currentUser.uid));
              setIsAdmin(userDoc.exists() && userDoc.data().role === "admin");
            } else {
              setIsAdmin(false);
            }
          } catch (e) {
            setIsAdmin(false);
          }
        }
      } else {
        setIsAdmin(false);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    if (!auth) return;
    await signOut(auth);
  };

  if (loading) {
    return <div className="h-9 w-16 animate-pulse rounded-md bg-white/20"></div>;
  }

  if (user) {
    return (
      <div className="flex items-center gap-3">
        {isAdmin && (
          <Link
            href="/admin"
            className="text-sm font-semibold text-white/90 transition hover:text-white"
          >
            Buka Admin
          </Link>
        )}
        <Link
          href="/profil"
          aria-label="Buka profil"
          title={user.email ?? "Profil"}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/30 bg-white/10 text-sm font-bold text-white transition hover:bg-white/20"
        >
          {(user.displayName?.[0] ?? user.email?.[0] ?? "P").toUpperCase()}
        </Link>
        <button
          onClick={handleLogout}
          className="rounded-md border border-white/30 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
        >
          Logout
        </button>
      </div>
    );
  }

  return (
    <Link
      href="/login"
      className="rounded-md bg-[#f4a261] px-4 py-2 text-sm font-semibold text-[#1f2933] shadow-sm transition hover:bg-[#ffd166]"
    >
      Login
    </Link>
  );
}
