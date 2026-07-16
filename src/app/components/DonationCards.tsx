"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db } from "@/lib/firebase";
import { useLanguage } from '@/lib/i18n';

export default function DonationCards({ plans = [] }: { plans?: any[] }) {
  const [customAmount, setCustomAmount] = useState<string>('');
  const router = useRouter();
  const { language } = useLanguage();
  const [currency, setCurrency] = useState<'IDR' | 'USD'>('IDR');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const [dbPlans, setDbPlans] = useState<any[]>(plans);
  const [donationConfig, setDonationConfig] = useState({
    minAmount: 20000,
    multiplier: 20000,
    durationDaysPerMultiplier: 30,
    aiRequestsPerMultiplier: 50,
    minAmountUsd: 2,
    multiplierUsd: 1.5,
  });

  const t = {
    id: {
      freePlanName: "Sahabat Grace Daily",
      freePlanPrice: "Rp0",
      freePlanDuration: "selamanya",
      freeFeatures: [
        "Akses Alkitab & Renungan Online",
        "5 Kuota Tanya Pendeta AI / hari",
        "Fitur Dasar"
      ],
      freeButton: "Mulai Gratis",
      bebasPlanName: "Mitra Sukarela",
      bebasPlanPrice: "Bebas",
      bebasPlanPriceUsd: "Bebas",
      bebasPlanDuration: "proporsional",
      bebasFeatures: [
        "Semua fitur Sahabat",
        "Akses Konseling Rohani AI mendalam",
        "Musik Rohani & Jurnal Spiritual",
        "Ekspor PDF",
        "Otomatis mensubsidi kuota untuk jemaat yang membutuhkan"
      ],
      inputLabel: "Masukkan Nominal Donasi (Rp)",
      inputLabelUsd: "Masukkan Nominal Donasi (USD)",
      placeholder: "Contoh: 50000",
      placeholderUsd: "Contoh: 10",
      helperText: (multiplier: number, days: number, reqs: number) => 
        `Setiap kelipatan Rp${multiplier.toLocaleString("id-ID")} otomatis memberikan ${days} hari akses premium dan ${reqs} interaksi AI.`,
      helperTextUsd: (multiplier: number, days: number, reqs: number) => 
        `Setiap kelipatan $${multiplier.toFixed(2)} USD otomatis memberikan ${days} hari akses premium dan ${reqs} interaksi AI.`,
      buttonDonate: "Donasi Sekarang",
      minAmtError: (min: number) => `Minimal donasi adalah Rp${min.toLocaleString("id-ID")}`,
      minAmtErrorUsd: (min: number) => `Minimal donasi adalah $${min.toFixed(2)} USD`,
      supportTitle: "Dukungan Pelayanan Bebas",
      internationalTitle: "Dukungan Internasional",
    },
    en: {
      freePlanName: "Grace Daily Friend",
      freePlanPrice: "$0",
      freePlanDuration: "forever",
      freeFeatures: [
        "Online Bible & Devotional Access",
        "5 Daily Ask Priest AI Quotas",
        "Basic Features"
      ],
      freeButton: "Start for Free",
      bebasPlanName: "Voluntary Partner",
      bebasPlanPrice: "Flexible",
      bebasPlanPriceUsd: "Flexible",
      bebasPlanDuration: "proportional",
      bebasFeatures: [
        "All Friend features included",
        "Deep AI Spiritual Counseling Access",
        "Spiritual Music & Spiritual Journal",
        "Export to PDF",
        "Automatically subsidize quota for people in need"
      ],
      inputLabel: "Enter Donation Amount (IDR)",
      inputLabelUsd: "Enter Donation Amount (USD)",
      placeholder: "Example: 50000",
      placeholderUsd: "Example: 10",
      helperText: (multiplier: number, days: number, reqs: number) => 
        `Every Rp${multiplier.toLocaleString("id-ID")} automatically grants ${days} premium days and ${reqs} AI interactions.`,
      helperTextUsd: (multiplier: number, days: number, reqs: number) => 
        `Every $${multiplier.toFixed(2)} USD automatically grants ${days} premium days and ${reqs} AI interactions.`,
      buttonDonate: "Donate Now",
      minAmtError: (min: number) => `Minimum donation is Rp${min.toLocaleString("id-ID")}`,
      minAmtErrorUsd: (min: number) => `Minimum donation is $${min.toFixed(2)} USD`,
      supportTitle: "Flexible Ministry Support",
      internationalTitle: "International Support",
    },
    zh: {
      freePlanName: "Grace Daily 之友",
      freePlanPrice: "0美元",
      freePlanDuration: "永久",
      freeFeatures: [
        "在线访问圣经与灵修",
        "每日5次“问牧师”AI额度",
        "基础功能"
      ],
      freeButton: "免费开始",
      bebasPlanName: "志愿伙伴",
      bebasPlanPrice: "随心",
      bebasPlanPriceUsd: "随心",
      bebasPlanDuration: "按比例",
      bebasFeatures: [
        "包含所有之友功能",
        "深度AI属灵辅导访问",
        "属灵音乐与属灵日记",
        "导出PDF文件",
        "自动为有需要的人群补贴额度"
      ],
      inputLabel: "输入捐赠金额 (印尼盾)",
      inputLabelUsd: "输入捐赠金额 (美元)",
      placeholder: "例如: 50000",
      placeholderUsd: "例如: 10",
      helperText: (multiplier: number, days: number, reqs: number) => 
        `每捐赠 Rp${multiplier.toLocaleString("id-ID")}，即可自动获得 ${days} 天会员期限和 ${reqs} 次 AI 互动额度。`,
      helperTextUsd: (multiplier: number, days: number, reqs: number) => 
        `每捐赠 $${multiplier.toFixed(2)} 美元，即可自动获得 ${days} 天会员期限和 ${reqs} 次 AI 互动额度。`,
      buttonDonate: "立即捐赠",
      minAmtError: (min: number) => `最低捐赠金额为 Rp${min.toLocaleString("id-ID")}`,
      minAmtErrorUsd: (min: number) => `最低捐赠金额为 $${min.toFixed(2)} 美元`,
      supportTitle: "随心事工支持",
      internationalTitle: "国际支持",
    }
  };

  const lang: 'id' | 'en' | 'zh' = (language === 'zh' || language === 'en') ? language : 'id';
  const text = t[lang];

  // Auto set currency based on language on load
  useEffect(() => {
    if (language === 'en' || language === 'zh') {
      setCurrency('USD');
    } else {
      setCurrency('IDR');
    }
  }, [language]);

  useEffect(() => {
    if (plans && plans.length > 0) {
      setDbPlans(plans);
    }
  }, [plans]);

  useEffect(() => {
    async function loadData() {
      if (!db) return;
      try {
        if (!plans || plans.length === 0) {
          const { getDocs, collection, query, where } = await import("firebase/firestore");
          const snap = await getDocs(query(collection(db, "plans"), where("active", "==", true)));
          const loadedPlans = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          if (loadedPlans.length > 0) {
            setDbPlans(loadedPlans);
          }
        }

        const { getDoc, doc } = await import("firebase/firestore");
        const configSnap = await getDoc(doc(db, "settings", "donation"));
        if (configSnap.exists()) {
          const configData = configSnap.data();
          setDonationConfig({
            minAmount: Number(configData.minAmount) || 20000,
            multiplier: Number(configData.multiplier) || 20000,
            durationDaysPerMultiplier: Number(configData.durationDaysPerMultiplier) || 30,
            aiRequestsPerMultiplier: Number(configData.aiRequestsPerMultiplier) || 50,
            minAmountUsd: Number(configData.minAmountUsd) || 2,
            multiplierUsd: Number(configData.multiplierUsd) || 1.5,
          });
        }
      } catch (err) {
        console.warn("Failed to load plans or donation config from Firestore:", err);
      }
    }
    loadData();
  }, [plans]);

  const handleDonation = (amount?: number, planName?: string) => {
    const finalAmount = amount || customAmount;
    
    // If USD → open PayPal directly
    if (currency === 'USD') {
      const amtNum = Number(finalAmount);
      const minUsd = donationConfig.minAmountUsd || 2;
      if (amtNum && amtNum < minUsd) {
        alert(text.minAmtErrorUsd(minUsd));
        return;
      }
      // Build PayPal donate URL
      const paypalBase = "https://www.paypal.com/donate";
      const paypalParams = new URLSearchParams({
        business: "gracedailybible@gmail.com",
        currency_code: "USD",
        item_name: "Grace Daily Ministry Support",
      });
      if (amtNum && amtNum >= minUsd) {
        paypalParams.append("amount", amtNum.toFixed(2));
      }
      window.open(`${paypalBase}?${paypalParams.toString()}`, "_blank", "noopener,noreferrer");
      return;
    }

    // IDR → go through Midtrans via login
    const amtNum = Number(finalAmount);
    if (amtNum && amtNum < donationConfig.minAmount) {
      alert(text.minAmtError(donationConfig.minAmount));
      return;
    }

    let url = '/login';
    const params = new URLSearchParams();
    if (finalAmount) params.append('amount', finalAmount.toString());
    if (planName) params.append('plan', planName);
    if (params.toString()) {
      url += '?' + params.toString();
    }
    router.push(url);
  };

  const activePlans = dbPlans.length > 0 ? dbPlans : plans;
  const freePlan = activePlans.find(p => p.name === "Sahabat Grace Daily") || {
    name: "Sahabat Grace Daily", price: "0", durationDays: 36500, features: []
  };
  
  const bebasPlan = activePlans.find(p => p.name === "Mitra Sukarela") || {
    name: "Mitra Sukarela", price: "Bebas", durationDays: 30, features: []
  };

  const freePlanPriceFormatted = currency === 'USD' ? text.freePlanPrice : (
    typeof freePlan.price === 'number'
      ? `Rp${freePlan.price.toLocaleString("id-ID")}`
      : String(freePlan.price ?? "Rp0")
  );

  const bebasPlanPriceFormatted = currency === 'USD' ? text.bebasPlanPriceUsd : (
    typeof bebasPlan.price === 'number'
      ? `Rp${bebasPlan.price.toLocaleString("id-ID")}`
      : String(bebasPlan.price ?? "Bebas")
  );

  const activeFreeFeatures = text.freeFeatures.length > 0 ? text.freeFeatures : (freePlan.features || []);
  const activeBebasFeatures = text.bebasFeatures.length > 0 ? text.bebasFeatures : (bebasPlan.features || []);

  if (!mounted) {
    return (
      <div className="w-full text-center py-20 text-gray-400 font-sans">
        Loading...
      </div>
    );
  }

  return (
    <div className="w-full text-white font-sans">
      <div className="max-w-5xl mx-auto">
        
        {/* Currency Tab Selector */}
        <div className="flex justify-center mb-10">
          <div className="inline-flex rounded-lg p-1 bg-[#111e38] border border-gray-700">
            <button
              onClick={() => {
                setCurrency('IDR');
                setCustomAmount('');
              }}
              className={`px-4 py-2 rounded-md text-sm font-semibold transition ${
                currency === 'IDR'
                  ? 'bg-[#2a6f6f] text-white shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              🇮🇩 Rupiah (Lokal)
            </button>
            <button
              onClick={() => {
                setCurrency('USD');
                setCustomAmount('');
              }}
              className={`px-4 py-2 rounded-md text-sm font-semibold transition ${
                currency === 'USD'
                  ? 'bg-[#2a6f6f] text-white shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              🌎 USD (PayPal / Credit Card)
            </button>
          </div>
        </div>

        {/* Layout: Grid 2 kolom yang responsif */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
          
          {/* Card 1 (Paket Sahabat / Free) */}
          <div className="bg-[#111e38] rounded-2xl p-8 border border-gray-700 flex flex-col hover:border-gray-500 transition-colors h-full">
            <div className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-100 mb-2">{text.freePlanName}</h2>
              <div className="text-4xl font-bold text-white mb-1">{freePlanPriceFormatted}</div>
              <div className="text-sm text-gray-400">/ {freePlan.durationDays === 36500 ? text.freePlanDuration : `${freePlan.durationDays} hari`}</div>
            </div>
            
            <ul className="space-y-4 mb-8 flex-grow text-gray-300">
              {activeFreeFeatures.map((feature: string, idx: number) => (
                <li key={idx} className="flex items-start">
                  <svg className="w-5 h-5 text-green-400 mr-3 mt-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            
            <button 
              onClick={() => handleDonation(0, freePlan.name)}
              className="mt-auto w-full py-3 px-4 rounded-lg border border-gray-400 text-gray-200 hover:bg-gray-800 transition-colors font-medium">
              {text.freeButton}
            </button>
          </div>

          {/* Card 2 (Mitra Sukarela - Gold) */}
          <div className="bg-[#111e38] rounded-2xl p-8 border-2 border-[#f4c430] flex flex-col relative transform md:-translate-y-4 shadow-[0_0_20px_rgba(244,196,48,0.15)] mt-4 md:mt-0 h-full">
            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-[#f4c430] text-[#0d1b2a] px-4 py-1 rounded-full text-sm font-bold tracking-wider whitespace-nowrap">
              {currency === 'USD' ? text.internationalTitle : text.supportTitle}
            </div>
            
            <div className="mb-6 mt-2">
              <h2 className="text-2xl font-semibold text-gray-100 mb-2">{text.bebasPlanName}</h2>
              <div className="text-4xl font-bold text-[#f4c430] mb-1">
                {currency === 'USD' ? "$ " : ""}{bebasPlanPriceFormatted}
              </div>
              <div className="text-sm text-gray-400">/ {text.bebasPlanDuration}</div>
            </div>

            <div className="mb-6">
              <label htmlFor="donasi-nominal" className="block text-sm font-medium text-gray-400 mb-2">
                {currency === 'USD' ? text.inputLabelUsd : text.inputLabel}
              </label>
              <div className="relative">
                {currency === 'USD' && (
                  <span className="absolute left-3.5 top-2.5 text-[#f4c430] text-sm font-bold">$</span>
                )}
                <input 
                  type="number" 
                  id="donasi-nominal"
                  min={currency === 'USD' ? (donationConfig.minAmountUsd || 2) : donationConfig.minAmount}
                  step={currency === 'USD' ? 1 : 10000}
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  placeholder={currency === 'USD' ? text.placeholderUsd : text.placeholder}
                  className={`w-full bg-[#0d1b2a] border border-[#f4c430]/50 rounded-lg py-2 text-white focus:outline-none focus:border-[#f4c430] focus:ring-1 focus:ring-[#f4c430] ${
                    currency === 'USD' ? 'pl-8 pr-4' : 'px-4'
                  }`}
                />
              </div>
              <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                {currency === 'USD' 
                  ? text.helperTextUsd(donationConfig.multiplierUsd || 1.5, donationConfig.durationDaysPerMultiplier, donationConfig.aiRequestsPerMultiplier)
                  : text.helperText(donationConfig.multiplier, donationConfig.durationDaysPerMultiplier, donationConfig.aiRequestsPerMultiplier)
                }
              </p>
            </div>
            
            <ul className="space-y-4 mb-6 flex-grow text-gray-300 text-sm md:text-base">
              {activeBebasFeatures.map((feature: string, idx: number) => (
                <li key={idx} className="flex items-start">
                  <svg className="w-5 h-5 text-[#f4c430] mr-3 mt-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  <span className={idx === 0 ? "font-bold" : ""}>{feature}</span>
                </li>
              ))}
            </ul>
            
            <button 
              onClick={() => handleDonation(undefined, bebasPlan.name)}
              className={`mt-auto w-full py-3 px-4 rounded-lg font-bold transition-all flex items-center justify-center gap-1.5 active:scale-[0.98] ${
                currency === 'USD'
                  ? 'bg-[#ffc439] hover:bg-[#f2ba36] text-[#003087] shadow-[0_2px_8px_rgba(255,196,57,0.2)]'
                  : 'bg-[#f4c430] hover:bg-yellow-500 text-[#0d1b2a]'
              }`}
            >
              {currency === 'USD' ? (
                <>
                  <span className="italic font-extrabold text-[#003087]">Pay</span>
                  <span className="italic font-extrabold text-[#0079C1] mr-1">Pal</span>
                  <span>{text.buttonDonate}</span>
                </>
              ) : (
                text.buttonDonate
              )}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
