"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
  type UserCredential,
} from "firebase/auth";
import { collection, doc, getDoc, getDocs, limit, query, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db, hasFirebaseConfig } from "@/lib/firebase";
import { plans as defaultPlans, type Plan } from "@/lib/data";

declare global {
  interface Window {
    snap: any;
  }
}

type Mode = "login" | "register";

function adminEmailList() {
  return (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function isPlanUnavailable(plan: Plan & { remainingSlots?: number }) {
  return typeof plan.remainingSlots === "number" && plan.remainingSlots <= 0;
}

function buildSubscriptionWindow(plan: Plan) {
  const activatedAt = new Date();
  const expiresAt = new Date(activatedAt);
  expiresAt.setDate(expiresAt.getDate() + Number(plan.durationDays || 0));
  return { activatedAt, expiresAt };
}

export function LoginPanel() {
  const [mode, setMode] = useState<Mode>("login");
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedPlan, setSelectedPlan] = useState("Premium");
  const [status, setStatus] = useState("Masuk untuk berlangganan atau membuka admin.");
  const [dbPlans, setDbPlans] = useState<Plan[]>(defaultPlans);
  const [isAdmin, setIsAdmin] = useState(false);
  const router = useRouter();

  async function syncUserProfile(credential: UserCredential, planName = selectedPlan) {
    if (!db) {
      throw new Error("Firestore belum siap.");
    }

    const isKnownAdmin = adminEmailList().includes(credential.user.email?.toLowerCase() ?? "");
    const existingUser = await getDoc(doc(db, "users", credential.user.uid)).catch(() => null);
    const existingRole = existingUser?.data()?.role;

    await setDoc(
      doc(db, "users", credential.user.uid),
      {
        uid: credential.user.uid,
        email: credential.user.email,
        displayName: credential.user.displayName ?? existingUser?.data()?.displayName ?? null,
        photoURL: credential.user.photoURL ?? existingUser?.data()?.photoURL ?? null,
        selectedPlan: existingUser?.data()?.selectedPlan ?? planName,
        role: isKnownAdmin ? "admin" : existingRole ?? "user",
        updatedAt: serverTimestamp(),
        ...(existingUser?.exists() ? {} : { createdAt: serverTimestamp() }),
      },
      { merge: true },
    );

    return { isKnownAdmin, existingRole };
  }

  async function routeAfterLogin(userCredential: UserCredential, isKnownAdmin: boolean, existingRole?: string) {
    setStatus("Login berhasil. Memeriksa akses admin...");
    const token = await userCredential.user.getIdToken(true);
    const response = await fetch("/api/me", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    }).catch(() => null);
    const data = response ? await response.json().catch(() => ({})) : {};
    const nextIsAdmin = Boolean(response?.ok && data.isAdmin) || isKnownAdmin || existingRole === "admin";
    setIsAdmin(nextIsAdmin);
    router.push(nextIsAdmin ? "/admin" : "/");
  }

  useEffect(() => {
    if (!db) return;
    
    getDocs(query(collection(db, "plans"), limit(20))).then((snapshot) => {
      if (!snapshot.empty) {
        const fetchedPlans = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            name: data.name,
            price: `Rp${Number(data.price).toLocaleString("id-ID")}`,
            durationDays: data.durationDays,
            aiRequests: data.aiRequests,
            features: data.features ?? [],
            allowedModes: data.allowedModes ?? [],
            remainingSlots: data.remainingSlots,
          } as Plan;
        });
        setDbPlans(fetchedPlans);
      }
    }).catch(err => console.error("Gagal load plans:", err));
  }, []);

  useEffect(() => {
    if (!auth) {
      return;
    }

    return onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setIsAdmin(false);
      if (currentUser) {
        try {
          const token = await currentUser.getIdToken();
          const response = await fetch("/api/me", {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
          });
          const data = await response.json().catch(() => ({}));
          setIsAdmin(Boolean(response.ok && data.isAdmin));
          if (response.ok && data.isAdmin) {
            router.push("/admin");
          }
        } catch (error) {
          console.error("Gagal verifikasi admin saat login:", error);
        }
      }
    });
  }, [router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!auth || !db) {
      setStatus("Firebase config belum lengkap di .env.local.");
      return;
    }

    try {
      const credential =
        mode === "login"
          ? await signInWithEmailAndPassword(auth, email, password)
          : await createUserWithEmailAndPassword(auth, email, password);

      const { isKnownAdmin, existingRole } = await syncUserProfile(credential);

      if (mode === "login") {
        await routeAfterLogin(credential, isKnownAdmin, existingRole);
      } else {
        setStatus(`Akun dibuat. Paket ${selectedPlan} siap diproses.`);
        const planToBuy = dbPlans.find((p) => p.name === selectedPlan);
        if (planToBuy && planToBuy.price !== "Rp0") {
          handleBuy(planToBuy, credential.user);
        } else {
          router.push("/");
        }
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Login gagal.");
    }
  }

  async function continueWithGoogle() {
    if (!auth || !db) {
      setStatus("Firebase config belum lengkap di .env.local.");
      return;
    }

    try {
      setStatus("Membuka login Google...");
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const credential = await signInWithPopup(auth, provider);
      const { isKnownAdmin, existingRole } = await syncUserProfile(credential);

      if (mode === "register") {
        const planToBuy = dbPlans.find((p) => p.name === selectedPlan);
        if (planToBuy && planToBuy.price !== "Rp0") {
          setStatus(`Akun Google tersambung. Paket ${selectedPlan} siap diproses.`);
          await handleBuy(planToBuy, credential.user);
          return;
        }
      }

      await routeAfterLogin(credential, isKnownAdmin, existingRole);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Login Google gagal.");
    }
  }

  async function logout() {
    if (!auth) {
      return;
    }

    await signOut(auth);
    setStatus("Kamu sudah logout.");
  }

  async function handleBuy(plan: Plan, overrideUser?: User) {
    const currentUser = overrideUser || user;
    if (!currentUser) {
      setStatus("Silakan login atau daftar terlebih dahulu untuk membeli paket.");
      return;
    }
    if (plan.price === "Rp0") {
      setStatus("Paket Free sudah otomatis aktif.");
      return;
    }
    if (isPlanUnavailable(plan as Plan & { remainingSlots?: number })) {
      alert(`Paket ${plan.name} sedang habis. Silakan pilih paket lain atau hubungi admin.`);
      setStatus(`Paket ${plan.name} sedang habis. Semua data akun tetap tersimpan di Profil.`);
      return;
    }

    setStatus(`Memproses pembayaran untuk ${plan.name}...`);
    try {
      const grossAmount = parseInt(plan.price.replace(/\D/g, ""));
      const response = await fetch("/api/midtrans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: `ORDER-${currentUser.uid}-${Date.now()}`,
          grossAmount,
          customerName: currentUser.email?.split("@")[0],
          customerEmail: currentUser.email,
          planName: plan.name,
          durationDays: plan.durationDays,
          aiRequests: plan.aiRequests,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal menghubungi Midtrans");

      if (data.mode === "demo") {
        setStatus("Midtrans belum dikonfigurasi. Token demo diterima, tetapi pembayaran live belum aktif.");
        return;
      }

      const clientIsProduction = process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION === "true";
      if (typeof data.isProduction === "boolean" && data.isProduction !== clientIsProduction) {
        setStatus("Konfigurasi Midtrans tidak selaras: client key dan server key memakai environment berbeda.");
        return;
      }

      if (!data.token) {
        setStatus("Midtrans tidak mengembalikan token transaksi. Periksa Server Key dan Client Key.");
        return;
      }

      if (window.snap) {
        window.snap.pay(data.token, {
          onSuccess: async function (result: any) {
            setStatus("Pembayaran berhasil! Mengaktifkan paket...");
            if (db) {
              const { activatedAt, expiresAt } = buildSubscriptionWindow(plan);
              await setDoc(doc(db, "users", currentUser.uid), {
                role: plan.name.toLowerCase() === "komunitas" ? "admin" : "premium",
                selectedPlan: plan.name,
                premiumActivatedAt: activatedAt,
                premiumExpiresAt: expiresAt,
                aiRequestsQuota: plan.aiRequests,
                aiRequestsRemaining: plan.aiRequests,
                premiumLastOrder: result?.order_id ?? null,
                updatedAt: serverTimestamp(),
              }, { merge: true });
            }
            setStatus(`Paket ${plan.name} berhasil diaktifkan. Terima kasih!`);
            router.refresh();
          },
          onPending: function (result: any) {
            setStatus("Menunggu pembayaran Anda...");
          },
          onError: function (result: any) {
            setStatus("Pembayaran gagal atau dibatalkan.");
          },
          onClose: function () {
            setStatus("Popup pembayaran ditutup.");
          }
        });
      } else {
        setStatus("Sistem Midtrans belum siap. Tunggu beberapa detik lalu klik Beli Paket lagi.");
      }
    } catch (err: any) {
      setStatus(err.message);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
      <section className="rounded-lg border border-[#dfd8ca] bg-white p-5">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#2a6f6f]">
          Login Grace Daily
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-[#14213d]">
          Masuk untuk berlangganan, jurnal, komunitas doa, dan admin.
        </h1>
        <p className="mt-4 leading-8 text-[#52606d]">{status}</p>

        {!hasFirebaseConfig() ? (
          <div className="mt-6 rounded-md border border-[#dfd8ca] bg-[#fff7ed] p-4 text-[#7c2d12]">
            Firebase config belum lengkap. Isi `NEXT_PUBLIC_FIREBASE_*` di
            `.env.local`.
          </div>
        ) : null}

        {user ? (
          <div className="mt-6 grid gap-3 rounded-lg border border-[#dfd8ca] bg-[#f7f4ee] p-4">
            <p className="font-semibold text-[#14213d]">
              Login sebagai {user.email}
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              {isAdmin && (
                <Link
                  href="/admin"
                  className="rounded-md bg-[#14213d] px-4 py-3 text-center font-semibold text-white"
                >
                  Buka Admin
                </Link>
              )}
              <button
                type="button"
                onClick={logout}
                className="rounded-md border border-[#dfd8ca] px-4 py-3 font-semibold text-[#14213d]"
              >
                Logout
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 grid gap-4">
            <div className="flex gap-2">
              {(["login", "register"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setMode(item)}
                  className={`rounded-md px-4 py-2 font-semibold ${
                    mode === item
                      ? "bg-[#14213d] text-white"
                      : "border border-[#dfd8ca] bg-white text-[#14213d]"
                  }`}
                >
                  {item === "login" ? "Masuk" : "Daftar"}
                </button>
              ))}
            </div>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="rounded-md border border-[#dfd8ca] px-4 py-3"
              placeholder="email@contoh.com"
              required
            />
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="rounded-md border border-[#dfd8ca] px-4 py-3"
              placeholder="Password"
              minLength={6}
              required
            />
            <select
              value={selectedPlan}
              onChange={(event) => setSelectedPlan(event.target.value)}
              className="rounded-md border border-[#dfd8ca] px-4 py-3"
            >
              {dbPlans.map((plan) => (
                <option key={plan.name}>{plan.name}</option>
              ))}
            </select>
            <button className="rounded-md bg-[#2a6f6f] px-4 py-3 font-semibold text-white">
              {mode === "login" ? "Masuk" : "Daftar dan pilih paket"}
            </button>
            <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#52606d]">
              <span className="h-px flex-1 bg-[#dfd8ca]" />
              atau
              <span className="h-px flex-1 bg-[#dfd8ca]" />
            </div>
            <button
              type="button"
              onClick={continueWithGoogle}
              className="rounded-md border border-[#dfd8ca] bg-white px-4 py-3 font-semibold text-[#14213d] shadow-sm transition hover:bg-[#f7f4ee]"
            >
              {mode === "login" ? "Masuk dengan Google" : "Daftar dengan Google"}
            </button>
          </form>
        )}
      </section>

      <section className="grid gap-4">
        {dbPlans.map((plan) => (
          <article
            key={plan.name}
            className="rounded-lg border border-[#dfd8ca] bg-white p-5"
          >
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
              <div>
                <h2 className="text-2xl font-semibold text-[#14213d]">
                  {plan.name}
                </h2>
                <p className="mt-2 text-[#52606d]">
                  {plan.durationDays} hari, {plan.aiRequests} interaksi
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-[#2a6f6f]">
                  {plan.price}
                </p>
                {isPlanUnavailable(plan as Plan & { remainingSlots?: number }) && (
                  <p className="mt-2 rounded-md bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
                    Paket habis
                  </p>
                )}
                {user && plan.price !== "Rp0" && (
                  <button
                    onClick={() => handleBuy(plan)}
                    disabled={isPlanUnavailable(plan as Plan & { remainingSlots?: number })}
                    className="mt-3 rounded-md bg-[#2a6f6f] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1f5252]"
                  >
                    Beli Paket
                  </button>
                )}
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {plan.features.map((feature) => (
                <span
                  key={feature}
                  className="rounded-md bg-[#e9f5db] px-3 py-1 text-sm text-[#284b3a]"
                >
                  {feature}
                </span>
              ))}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
