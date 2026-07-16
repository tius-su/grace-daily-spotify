"use client";

import Link from "next/link";
import { LoginPanel } from "@/app/components/LoginPanel";
import { useLanguage } from "@/lib/i18n";

export default function LoginPage() {
  const { t } = useLanguage();

  return (
    <main className="min-h-screen bg-[#f7f4ee] px-5 py-6 text-[#1f2933] sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col justify-between gap-4 border-b border-[#dfd8ca] pb-6 md:flex-row md:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#2a6f6f]">
              {t("login.account_label")}
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-[#14213d]">
              {t("login.account_subtitle")}
            </h1>
          </div>
          <Link
            href="/"
            className="rounded-md bg-[#14213d] px-4 py-2 text-center font-semibold text-white transition hover:bg-[#1a2d52] self-start"
          >
            {t("login.back_home")}
          </Link>
        </header>
        <div className="py-8">
          <LoginPanel />
        </div>
      </div>
    </main>
  );
}
