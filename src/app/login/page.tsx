import Link from "next/link";
import { LoginPanel } from "@/app/components/LoginPanel";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Masuk Ke Akun",
  description: "Masuk atau daftar ke akun Grace Daily untuk mengakses renungan, jurnal rohani, dan komunitas doa.",
  openGraph: {
    title: "Masuk Ke Akun | Grace Daily",
    description: "Masuk atau daftar ke akun Grace Daily untuk mengakses renungan, jurnal rohani, dan komunitas doa.",
  },
};

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-[#f7f4ee] px-5 py-6 text-[#1f2933] sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col justify-between gap-4 border-b border-[#dfd8ca] pb-6 md:flex-row md:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#2a6f6f]">
              Akun Grace Daily
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-[#14213d]">
              Masuk, daftar, dan kelola paket dengan aman.
            </h1>
          </div>
          <Link
            href="/"
            className="rounded-md bg-[#14213d] px-4 py-2 text-center font-semibold text-white"
          >
            Kembali ke beranda
          </Link>
        </header>
        <div className="py-8">
          <LoginPanel />
        </div>
      </div>
    </main>
  );
}
