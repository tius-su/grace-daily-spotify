"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState, useRef } from "react";
import { useLanguage } from "@/lib/i18n";
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
  const [selectedPlan, setSelectedPlan] = useState("Sahabat Grace Daily");
  const [status, setStatus] = useState("Masuk untuk berlangganan atau membuka admin.");

  // Donation States
  const [donationAmount, setDonationAmount] = useState<number>(20000);
  const [donorName, setDonorName] = useState("");
  const [donationConfig, setDonationConfig] = useState({
    minAmount: 20000,
    multiplier: 20000,
    durationDaysPerMultiplier: 30,
    aiRequestsPerMultiplier: 50,
    minAmountUsd: 2,
    multiplierUsd: 1.5,
    quickAmountsUsd: "5, 10, 25, 50"
  });

  useEffect(() => {
    async function loadDonationConfig() {
      if (!db) return;
      try {
        const { getDoc, doc } = await import("firebase/firestore");
        const configSnap = await getDoc(doc(db, "settings", "donation"));
        if (configSnap.exists()) {
          const configData = configSnap.data();
          const minAmt = Number(configData.minAmount) || 20000;
          setDonationConfig({
            minAmount: minAmt,
            multiplier: Number(configData.multiplier) || 20000,
            durationDaysPerMultiplier: Number(configData.durationDaysPerMultiplier) || 30,
            aiRequestsPerMultiplier: Number(configData.aiRequestsPerMultiplier) || 50,
            minAmountUsd: Number(configData.minAmountUsd) || 2,
            multiplierUsd: Number(configData.multiplierUsd) || 1.5,
            quickAmountsUsd: configData.quickAmountsUsd ?? "5, 10, 25, 50",
          });
          // Update default donationAmount if it was exactly 20000
          setDonationAmount((prev) => (prev === 20000 ? minAmt : prev));
        }
      } catch (err) {
        console.warn("Failed to load donation settings:", err);
      }
    }
    loadDonationConfig();
  }, []);
  const [donorEmail, setDonorEmail] = useState("");
  const [donorPhone, setDonorPhone] = useState("");
  const [donorCity, setDonorCity] = useState("");
  const [donationAmountUsd, setDonationAmountUsd] = useState<number>(2);

  const donorNameRef = useRef(donorName);
  const donorEmailRef = useRef(donorEmail);
  const donorPhoneRef = useRef(donorPhone);
  const donorCityRef = useRef(donorCity);

  useEffect(() => {
    donorNameRef.current = donorName;
  }, [donorName]);

  useEffect(() => {
    donorEmailRef.current = donorEmail;
  }, [donorEmail]);

  useEffect(() => {
    donorPhoneRef.current = donorPhone;
  }, [donorPhone]);

  useEffect(() => {
    donorCityRef.current = donorCity;
  }, [donorCity]);

  async function handleDonate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user && !donorEmail.trim()) {
      alert(language === "zh" ? "请填写您的电子邮箱以接收访问链接。" : language === "en" ? "Please fill your email to receive access link." : "Silakan masukkan email Anda untuk menerima link akses benefit.");
      return;
    }
    if (donationAmount < donationConfig.minAmount) {
      alert(`Nominal donasi minimal adalah Rp${donationConfig.minAmount.toLocaleString("id-ID")}.`);
      return;
    }

    setStatus(`Memproses transaksi donasi sebesar Rp${donationAmount.toLocaleString("id-ID")}...`);
    try {
      const token = user ? await user.getIdToken() : null;
      const cleanEmail = (donorEmail || user?.email || "").trim().toLowerCase();
      const cleanName = (donorName || user?.displayName || user?.email?.split("@")[0] || "Mitra Grace Daily").trim();
      const uniqueGuestId = user ? user.uid : `GUEST-${cleanEmail.replace(/[^a-z0-9]/g, "_")}`;

      const response = await fetch("/api/midtrans", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          orderId: `DON-${uniqueGuestId}-${Date.now()}`,
          grossAmount: donationAmount,
          customerName: cleanName,
          customerEmail: cleanEmail,
          customerPhone: donorPhone || undefined,
          customerCity: donorCity || undefined,
          planName: "donasi-open",
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal menghubungi Midtrans");

      if (data.mode === "demo") {
        setStatus("Midtrans belum dikonfigurasi. Token demo diterima.");
        return;
      }

      if (window.snap) {
        window.snap.pay(data.token, {
          onSuccess: async function (result: any) {
            setStatus("Donasi berhasil! Mengaktifkan akses premium...");
            if (db && user) {
              const activatedAt = new Date();
              const durationDays = Math.floor((donationAmount / donationConfig.multiplier) * donationConfig.durationDaysPerMultiplier);
              const aiRequests = Math.floor((donationAmount / donationConfig.multiplier) * donationConfig.aiRequestsPerMultiplier);
              const expiresAt = new Date(activatedAt);
              expiresAt.setDate(expiresAt.getDate() + durationDays);

              await setDoc(doc(db, "users", user.uid), {
                role: "premium",
                selectedPlan: "Open Donation",
                premiumActivatedAt: activatedAt,
                premiumExpiresAt: expiresAt,
                aiRequestsQuota: aiRequests,
                aiRequestsRemaining: aiRequests,
                premiumLastOrder: result?.order_id ?? null,
                updatedAt: serverTimestamp(),
              }, { merge: true });
            } else if (db && !user) {
              // Simpan guest ID ke localStorage agar langsung premium secara instan di device lokal
              localStorage.setItem("guestPremiumId", uniqueGuestId);
            }
            setStatus(`Donasi berhasil. Terima kasih atas dukungan Anda!`);
            router.refresh();
          },
          onPending: function () {
            setStatus("Menunggu pembayaran donasi Anda...");
          },
          onError: function () {
            setStatus("Pembayaran donasi gagal.");
          },
          onClose: function () {
            setStatus("Popup pembayaran ditutup.");
          }
        });
      } else {
        setStatus("Sistem Midtrans belum siap. Tunggu beberapa detik lalu coba lagi.");
      }
    } catch (err: any) {
      setStatus(err.message);
    }
  }

  const { language, t } = useLanguage();
  const [isPaypal, setIsPaypal] = useState(false);
  const [paypalLoaded, setPaypalLoaded] = useState(false);
  const [paypalError, setPaypalError] = useState("");
  const [paypalSuccess, setPaypalSuccess] = useState(false);

  const verifyGuestBenefit = async (guestId: string, token: string) => {
    if (!db) return;
    try {
      const userRef = doc(db, "users", guestId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const userData = userSnap.data();
        if (userData.benefitToken === token) {
          localStorage.setItem("guestPremiumId", guestId);
          setStatus(language === "zh" ? "恭喜！您的捐赠高级权限已成功激活。" : language === "en" ? "Congratulations! Your donation premium access has been successfully activated." : "Selamat! Akses premium donasi Kakak berhasil diaktifkan secara otomatis.");
          
          setTimeout(() => {
            router.push("/ai");
          }, 2500);
          return;
        }
      }
      setStatus(language === "zh" ? "验证失败：无效或已过期的访问链接。" : language === "en" ? "Verification failed: invalid or expired access link." : "Verifikasi gagal: tautan akses tidak valid atau sudah kedaluwarsa.");
    } catch (err) {
      console.error("Gagal verifikasi benefit token:", err);
      setStatus("Gagal memproses verifikasi tautan donasi.");
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const planParam = urlParams.get("plan");
      if (planParam) {
        setSelectedPlan(planParam);
      }
      const paymentParam = urlParams.get("payment");
      const isUsd = paymentParam === "paypal" || urlParams.get("currency") === "USD";
      if (isUsd) {
        setIsPaypal(true);
      }
      const amountParam = urlParams.get("amount");
      if (amountParam) {
        const amt = Number(amountParam);
        if (isUsd) {
          setDonationAmountUsd(amt);
        } else {
          setDonationAmount(amt);
        }
      }
      const guestIdParam = urlParams.get("guestId");
      const tokenParam = urlParams.get("token");
      if (guestIdParam && tokenParam) {
        setStatus(language === "zh" ? "正在验证您的捐赠访问链接..." : language === "en" ? "Verifying your donation access link..." : "Memverifikasi tautan benefit donasi Kakak...");
        verifyGuestBenefit(guestIdParam, tokenParam);
      }
    }
  }, []);

  // PayPal SDK Loader
  useEffect(() => {
    if (!isPaypal) return;
    
    if ((window as any).paypal) {
      setPaypalLoaded(true);
      return;
    }

    const existingScript = document.getElementById("paypal-sdk-script") as HTMLScriptElement;
    if (existingScript) {
      if ((window as any).paypal) {
        setPaypalLoaded(true);
        return;
      }
      const handleLoad = () => setPaypalLoaded(true);
      existingScript.addEventListener("load", handleLoad);
      return () => {
        existingScript.removeEventListener("load", handleLoad);
      };
    }

    const clientId = process.env.NEXT_PUBLIC_PAYPAL_LIVE_CLIENT_ID || "AV-qbXdZ7YTsWJEBugrHBNIFNLG14bvAqYOFc3dDDmmZ8bwG-5fSIE9GLVu5K3ja1CXP5wZvHFaEpnt5";
    const script = document.createElement("script");
    script.id = "paypal-sdk-script";
    script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD`;
    script.async = true;
    script.onload = () => {
      setPaypalLoaded(true);
    };
    script.onerror = (err) => {
      console.error("Gagal memuat PayPal SDK:", err);
      setPaypalError("Gagal memuat sistem pembayaran PayPal.");
    };
    document.body.appendChild(script);
  }, [isPaypal]);

  // PayPal Buttons Render Effect
  useEffect(() => {
    if (!paypalLoaded || !isPaypal) return;

    // Wait one tick for React to remove the "hidden" class from the container
    const timer = setTimeout(() => {
      const container = document.getElementById("paypal-button-container");
      if (!container) return;

      // Clear previous button content if any
      container.innerHTML = "";

      try {
        (window as any).paypal.Buttons({
          style: {
            layout: 'vertical',
            color:  'gold',
            shape:  'rect',
            label:  'paypal'
          },
          createOrder: (data: any, actions: any) => {
            // Read dynamic amount value directly from input to avoid stale closure
            const amt = parseFloat((document.getElementById("donasi-nominal-usd") as HTMLInputElement)?.value || "2");
            return actions.order.create({
              purchase_units: [{
                description: "Grace Daily Kemitraan Pelayanan (Mitra Sukarela)",
                amount: {
                  currency_code: 'USD',
                  value: amt.toFixed(2)
                }
              }]
            });
          },
          onApprove: async (data: any, actions: any) => {
            setStatus(language === "zh" ? "付款已批准。正在处理验证..." : language === "en" ? "Payment approved. Processing verification..." : "Pembayaran disetujui. Memproses verifikasi...");
            try {
              const details = await actions.order.capture();
              const orderId = details.id;
              const amt = parseFloat((document.getElementById("donasi-nominal-usd") as HTMLInputElement)?.value || "2");
              
              const cleanEmail = (donorEmailRef.current || user?.email || "").trim().toLowerCase();
              if (!user && !cleanEmail) {
                alert(language === "zh" ? "请先在上方输入您的电子邮件，然后再完成 PayPal 付款。" : language === "en" ? "Please enter your email above before completing PayPal payment." : "Silakan masukkan email Anda terlebih dahulu di bagian atas sebelum melanjutkan pembayaran PayPal.");
                setStatus(language === "zh" ? "验证暂停：捐赠者电子邮件为空。" : language === "en" ? "Verification pending: Donor email is empty." : "Verifikasi tertunda: Email donatur kosong.");
                return;
              }

              const cleanName = (donorNameRef.current || user?.displayName || user?.email?.split("@")[0] || "Mitra Grace Daily").trim();
              const uniqueGuestId = user ? user.uid : `GUEST-${cleanEmail.replace(/[^a-z0-9]/g, "_")}`;

              // Call capture API
              const token = user ? await user.getIdToken() : null;
              const response = await fetch("/api/paypal/capture", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  ...(token ? { Authorization: `Bearer ${token}` } : {})
                },
                body: JSON.stringify({
                  orderId,
                  amount: amt,
                  customerName: cleanName,
                  customerEmail: cleanEmail,
                  customerPhone: donorPhoneRef.current || undefined,
                  customerCity: donorCityRef.current || undefined,
                  planName: "donasi-open"
                })
              });

              const resData = await response.json();
              if (!response.ok) throw new Error(resData.error || (language === "zh" ? "PayPal 付款验证失败。" : language === "en" ? "Failed to verify PayPal payment." : "Gagal verifikasi pembayaran PayPal."));

              if (!user) {
                localStorage.setItem("guestPremiumId", uniqueGuestId);
              }

              setPaypalSuccess(true);
              setStatus(language === "zh" ? "PayPal 捐赠已成功验证！正在激活高级会员..." : language === "en" ? "PayPal donation verified! Activating premium access..." : "Donasi PayPal berhasil diverifikasi! Mengaktifkan akses premium...");
              setTimeout(() => {
                router.push(user ? "/profil" : "/ai");
                router.refresh();
              }, 1500);

            } catch (err: any) {
              console.error(err);
              setPaypalError(err.message || (language === "zh" ? "处理捐赠失败。" : language === "en" ? "Failed to process donation." : "Gagal memproses donasi."));
              setStatus(`Error: ${err.message}`);
            }
          },
          onError: (err: any) => {
            console.error("PayPal Error:", err);
            setPaypalError(language === "zh" ? "PayPal 付款出现错误。" : language === "en" ? "An error occurred with PayPal payment." : "Terjadi kesalahan pada pembayaran PayPal.");
          }
        }).render("#paypal-button-container");
      } catch (e) {
        console.error("Gagal merender tombol PayPal:", e);
        setPaypalError(language === "zh" ? "无法加载 PayPal 按钮。请刷新页面重试。" : language === "en" ? "Could not load PayPal button. Please refresh and try again." : "Gagal memuat tombol PayPal. Silakan refresh halaman dan coba lagi.");
      }
    }, 50); // Small delay to let React flush DOM changes

    return () => clearTimeout(timer);
  }, [paypalLoaded, user, isPaypal, language]);


  const [dbPlans, setDbPlans] = useState<Plan[]>(defaultPlans);
  const [isAdmin, setIsAdmin] = useState(false);
  const router = useRouter();

  async function syncUserProfile(credential: UserCredential, planName = "Sahabat Grace Daily") {
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
            price: typeof data.price === 'number' ? `Rp${data.price.toLocaleString("id-ID")}` : (data.price ?? ""),
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
      const token = await currentUser.getIdToken();
      const grossAmount = parseInt(plan.price.replace(/\D/g, ""));
      const response = await fetch("/api/midtrans", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
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
          {t("login.title")}
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-[#14213d]">
          {t("login.subtitle")}
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
              {t("login.logged_in_as")} {user.email}
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              {isAdmin && (
                <Link
                  href="/admin"
                  className="rounded-md bg-[#14213d] px-4 py-3 text-center font-semibold text-white"
                >
                  {t("login.open_admin")}
                </Link>
              )}
              <button
                type="button"
                onClick={logout}
                className="rounded-md border border-[#dfd8ca] px-4 py-3 font-semibold text-[#14213d]"
              >
                {t("login.logout")}
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
                  className={`rounded-md px-4 py-2 font-semibold ${mode === item
                      ? "bg-[#14213d] text-white"
                      : "border border-[#dfd8ca] bg-white text-[#14213d]"
                    }`}
                >
                  {item === "login" ? t("login.sign_in") : t("login.register")}
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

            <button className="rounded-md bg-[#2a6f6f] px-4 py-3 font-semibold text-white">
              {mode === "login" ? t("login.submit_btn_login") : t("login.submit_btn_register")}
            </button>
            <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#52606d]">
              <span className="h-px flex-1 bg-[#dfd8ca]" />
              {t("login.or")}
              <span className="h-px flex-1 bg-[#dfd8ca]" />
            </div>
            <button
              type="button"
              onClick={continueWithGoogle}
              className="rounded-md border border-[#dfd8ca] bg-white px-4 py-3 font-semibold text-[#14213d] shadow-sm transition hover:bg-[#f7f4ee]"
            >
              {mode === "login" ? t("login.google_signin") : t("login.google_register")}
            </button>
          </form>
        )}
      </section>

      <section className="rounded-lg border border-[#dfd8ca] bg-white p-5 flex flex-col gap-4">
        {/* Donation Header */}
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#2a6f6f]">
            {language === "zh" ? "支持 Grace Daily" : language === "en" ? "Support Grace Daily" : "Dukung Grace Daily"}
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-[#14213d]">
            {language === "zh" ? "奉献支持" : language === "en" ? "Make a Donation" : "Berikan Donasi"}
          </h2>
          <p className="mt-2 text-sm text-[#52606d] leading-relaxed">
            {language === "zh"
              ? "您的每一份奉献都帮助我们持续提供每日灵修内容和属灵工具。"
              : language === "en"
              ? "Your donation helps us continue providing daily devotionals and spiritual tools for free."
              : "Donasi Anda membantu kami terus menyediakan renungan harian dan alat rohani secara gratis."}
          </p>
        </div>

        {/* Payment Gateway Toggle */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setIsPaypal(false)}
            className={`flex-1 py-2.5 text-sm font-semibold rounded-md border transition cursor-pointer ${
              !isPaypal
                ? "bg-[#2a6f6f] border-[#2a6f6f] text-white"
                : "bg-white border-[#dfd8ca] text-[#2a6f6f] hover:bg-[#2a6f6f]/5"
            }`}
          >
            🇮🇩 Midtrans (IDR)
          </button>
          <button
            type="button"
            onClick={() => setIsPaypal(true)}
            className={`flex-1 py-2.5 text-sm font-semibold rounded-md border transition cursor-pointer ${
              isPaypal
                ? "bg-[#2a6f6f] border-[#2a6f6f] text-white"
                : "bg-white border-[#dfd8ca] text-[#2a6f6f] hover:bg-[#2a6f6f]/5"
            }`}
          >
            🌎 PayPal (USD)
          </button>
        </div>

        {isPaypal ? (
              /* ── PayPal USD Form ── */
              <div className="grid gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-[#14213d] mb-1.5">
                    {language === "zh"
                      ? `捐赠金额 (最少 $${(donationConfig.minAmountUsd || 2).toFixed(2)} USD)`
                      : language === "en"
                      ? `Donation Amount (Min $${(donationConfig.minAmountUsd || 2).toFixed(2)} USD)`
                      : `Nominal Donasi (Min $${(donationConfig.minAmountUsd || 2).toFixed(2)} USD)`}
                  </label>
                  <div className="relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-500 sm:text-sm">$</span>
                    </div>
                    <input
                      type="number"
                      id="donasi-nominal-usd"
                      min={donationConfig.minAmountUsd || 2}
                      step="1"
                      value={donationAmountUsd}
                      onChange={(e) => setDonationAmountUsd(Number(e.target.value))}
                      className="block w-full pl-7 pr-3 py-2.5 text-[#14213d] rounded-md border border-[#dfd8ca] focus:ring-1 focus:ring-[#2a6f6f] focus:border-[#2a6f6f]"
                      required
                    />
                  </div>
                </div>

                {/* Quick Select USD */}
                <div className="flex gap-2">
                  {(donationConfig.quickAmountsUsd ?? "5, 10, 25, 50")
                    .split(",")
                    .map((x) => parseInt(x.trim()))
                    .filter((x) => !isNaN(x))
                    .map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => {
                          setDonationAmountUsd(amt);
                        }}
                        className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded border transition cursor-pointer ${
                          donationAmountUsd === amt
                            ? "bg-[#2a6f6f] border-[#2a6f6f] text-white"
                            : "bg-white border-[#dfd8ca] text-[#2a6f6f] hover:bg-[#2a6f6f]/5"
                        }`}
                      >
                        ${amt}
                      </button>
                    ))}
                </div>

                <div className="border-t border-[#dfd8ca]/60 my-1" />

                {/* Contact Details */}
                <div className="grid gap-2">
                  <p className="text-[11px] font-bold text-[#52606d] uppercase tracking-wider">
                    {language === "zh" ? "联系信息 (选填)" : language === "en" ? "Contact Details (Optional)" : "Detail Kontak (Opsional)"}
                  </p>
                  <input
                    type="text"
                    placeholder={language === "zh" ? "姓名" : language === "en" ? "Full Name" : "Nama Lengkap"}
                    value={donorName}
                    onChange={(e) => setDonorName(e.target.value)}
                    className="rounded-md border border-[#dfd8ca] px-3 py-2 text-sm text-[#14213d]"
                  />
                  <input
                    type="email"
                    placeholder={!user 
                      ? (language === "zh" ? "电子邮箱 * (用于接收访问链接)" : language === "en" ? "E-mail * (Access link recipient)" : "E-mail * (Penerima Link Akses)")
                      : (language === "zh" ? "电子邮箱" : language === "en" ? "E-mail" : "E-mail Penerima Akses")
                    }
                    value={donorEmail}
                    onChange={(e) => setDonorEmail(e.target.value)}
                    className="rounded-md border border-[#dfd8ca] px-3 py-2 text-sm text-[#14213d]"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="tel"
                      placeholder={language === "zh" ? "电话" : language === "en" ? "Phone" : "No. HP"}
                      value={donorPhone}
                      onChange={(e) => setDonorPhone(e.target.value)}
                      className="rounded-md border border-[#dfd8ca] px-3 py-2 text-sm text-[#14213d]"
                    />
                    <input
                      type="text"
                      placeholder={language === "zh" ? "城市" : language === "en" ? "City" : "Kota"}
                      value={donorCity}
                      onChange={(e) => setDonorCity(e.target.value)}
                      className="rounded-md border border-[#dfd8ca] px-3 py-2 text-sm text-[#14213d]"
                    />
                  </div>
                </div>

                {/* PayPal Button */}
                {paypalError ? (
                  <div className="mt-2 rounded-md bg-red-50 border border-red-200 p-4 text-center">
                    <p className="text-sm font-semibold text-red-600 mb-2">⚠️ {paypalError}</p>
                    <button
                      type="button"
                      onClick={() => {
                        setPaypalError("");
                        const old = document.getElementById("paypal-sdk-script");
                        if (old) old.remove();
                        setPaypalLoaded(false);
                        // Re-trigger load
                        setTimeout(() => setIsPaypal(false), 50);
                        setTimeout(() => setIsPaypal(true), 100);
                      }}
                      className="text-xs font-semibold text-red-600 underline hover:text-red-800"
                    >
                      {language === "zh" ? "重试" : language === "en" ? "Retry" : "Coba Lagi"}
                    </button>
                  </div>
                ) : !paypalLoaded ? (
                  <div className="mt-2 flex flex-col items-center justify-center gap-3 rounded-lg border border-[#dfd8ca] bg-[#f7f4ee] py-8 min-h-[120px]">
                    {/* Spinner */}
                    <svg
                      className="animate-spin h-7 w-7 text-[#2a6f6f]"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12" cy="12" r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    <p className="text-sm font-semibold text-[#52606d]">
                      {language === "zh" ? "正在加载 PayPal..." : language === "en" ? "Loading PayPal..." : "Memuat PayPal..."}
                    </p>
                    <p className="text-xs text-gray-400">
                      {language === "zh" ? "请稍候" : language === "en" ? "Please wait a moment" : "Mohon tunggu sebentar"}
                    </p>
                  </div>
                ) : null}

                <div
                  id="paypal-button-container"
                  className={`mt-2 z-0 min-h-[50px] transition-all duration-300 ${!paypalLoaded ? "hidden" : "block"}`}
                />
              </div>
            ) : (
              /* ── Midtrans IDR Form ── */
              <form onSubmit={handleDonate} className="grid gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-[#14213d] mb-1.5">
                    {language === "zh"
                      ? `捐赠金额 (最少 Rp${donationConfig.minAmount.toLocaleString("id-ID")})`
                      : language === "en"
                      ? `Donation Amount (Min Rp${donationConfig.minAmount.toLocaleString("id-ID")})`
                      : `Nominal Donasi (Min Rp${donationConfig.minAmount.toLocaleString("id-ID")})`}
                  </label>
                  <div className="relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-500 sm:text-sm">Rp</span>
                    </div>
                    <input
                      type="number"
                      min={donationConfig.minAmount}
                      value={donationAmount}
                      onChange={(e) => setDonationAmount(Number(e.target.value))}
                      className="block w-full pl-9 pr-3 py-2.5 text-[#14213d] rounded-md border border-[#dfd8ca] focus:ring-1 focus:ring-[#2a6f6f] focus:border-[#2a6f6f]"
                      required
                    />
                  </div>
                </div>

                {/* Quick Select IDR */}
                <div className="flex gap-2">
                  {[
                    donationConfig.minAmount,
                    donationConfig.minAmount + 30000,
                    donationConfig.minAmount + 80000,
                    donationConfig.minAmount + 230000,
                  ].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setDonationAmount(amt)}
                      className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded border transition cursor-pointer ${
                        donationAmount === amt
                          ? "bg-[#2a6f6f] border-[#2a6f6f] text-white"
                          : "bg-white border-[#dfd8ca] text-[#2a6f6f] hover:bg-[#2a6f6f]/5"
                      }`}
                    >
                      {amt >= 1000 ? `${Math.round(amt / 1000)}k` : amt}
                    </button>
                  ))}
                </div>

                <div className="border-t border-[#dfd8ca]/60 my-1" />

                {/* Contact Details */}
                <div className="grid gap-2">
                  <p className="text-[11px] font-bold text-[#52606d] uppercase tracking-wider">
                    {language === "zh" ? "联系信息 (选填)" : language === "en" ? "Contact Details (Optional)" : "Detail Kontak (Opsional)"}
                  </p>
                  <input
                    type="text"
                    placeholder={language === "zh" ? "姓名" : language === "en" ? "Full Name" : "Nama Lengkap"}
                    value={donorName}
                    onChange={(e) => setDonorName(e.target.value)}
                    className="rounded-md border border-[#dfd8ca] px-3 py-2 text-sm text-[#14213d]"
                  />
                  <input
                    type="email"
                    placeholder={!user 
                      ? (language === "zh" ? "电子邮箱 * (用于接收访问链接)" : language === "en" ? "E-mail * (Access link recipient)" : "E-mail * (Penerima Link Akses)")
                      : (language === "zh" ? "电子邮箱" : language === "en" ? "E-mail" : "E-mail Penerima Akses")
                    }
                    value={donorEmail}
                    onChange={(e) => setDonorEmail(e.target.value)}
                    className="rounded-md border border-[#dfd8ca] px-3 py-2 text-sm text-[#14213d]"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="tel"
                      placeholder={language === "zh" ? "电话" : language === "en" ? "Phone" : "No. Handphone"}
                      value={donorPhone}
                      onChange={(e) => setDonorPhone(e.target.value)}
                      className="rounded-md border border-[#dfd8ca] px-3 py-2 text-sm text-[#14213d]"
                    />
                    <input
                      type="text"
                      placeholder={language === "zh" ? "城市" : language === "en" ? "City" : "Kota"}
                      value={donorCity}
                      onChange={(e) => setDonorCity(e.target.value)}
                      className="rounded-md border border-[#dfd8ca] px-3 py-2 text-sm text-[#14213d]"
                    />
                  </div>
                </div>

                {donationAmount >= donationConfig.minAmount && (
                  <div className="text-[11px] text-[#2a6f6f] bg-[#e9f5db] px-2.5 py-1.5 rounded-md font-semibold">
                    {language === "zh"
                      ? `您将获得：${Math.floor((donationAmount / donationConfig.multiplier) * donationConfig.durationDaysPerMultiplier)} 天高级权限 & ${Math.floor((donationAmount / donationConfig.multiplier) * donationConfig.aiRequestsPerMultiplier)} 次互动`
                      : language === "en"
                      ? `You'll receive: ${Math.floor((donationAmount / donationConfig.multiplier) * donationConfig.durationDaysPerMultiplier)} days premium & ${Math.floor((donationAmount / donationConfig.multiplier) * donationConfig.aiRequestsPerMultiplier)} AI interactions`
                      : `Akan mendapatkan: ${Math.floor((donationAmount / donationConfig.multiplier) * donationConfig.durationDaysPerMultiplier)} hari premium & ${Math.floor((donationAmount / donationConfig.multiplier) * donationConfig.aiRequestsPerMultiplier)} interaksi`}
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-3 rounded-md bg-[#2a6f6f] text-white font-semibold shadow-sm transition hover:bg-[#1f5252] cursor-pointer"
                >
                  {language === "zh" ? "立即奉献" : language === "en" ? "Donate Now" : "Dukung Sekarang"}
                </button>
              </form>
            )}
      </section>
    </div>
  );
}
