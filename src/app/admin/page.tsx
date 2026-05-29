import Link from "next/link";
import { AdminConsole } from "@/app/components/AdminConsole";

export default function AdminPage() {
  return (
    <main className="min-h-screen bg-[#f7f4ee] px-5 py-6 text-[#1f2933] sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col justify-between gap-4 border-b border-[#dfd8ca] pb-6 md:flex-row md:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#2a6f6f]">
              Grace Daily Admin
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-[#14213d]">
              Dashboard operasional, blog, paket, dan admin.
            </h1>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/"
              className="rounded-md bg-[#14213d] px-4 py-2 text-center font-semibold text-white"
            >
              Kembali
            </Link>
          </div>
        </header>

        <div className="py-8">
          <AdminConsole />
        </div>
      </div>
    </main>
  );
}
