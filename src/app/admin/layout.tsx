"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!auth) {
      router.replace("/");
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
      } else {
        const token = await user.getIdToken();
        const response = await fetch("/api/me", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        }).catch(() => null);
        const data = response ? await response.json().catch(() => ({})) : {};
        const isAdmin = Boolean(response?.ok && data.isAdmin);

        if (isAdmin) {
          setIsAuthorized(true);
        } else {
          router.replace("/");
        }
      }
    });

    return () => unsubscribe();
  }, [router]);

  if (!isAuthorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f4ee]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#2a6f6f] border-t-transparent"></div>
      </div>
    );
  }

  return <>{children}</>;
}
