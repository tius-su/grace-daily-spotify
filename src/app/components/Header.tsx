"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { AuthNav } from "@/app/components/AuthNav";

export function Header() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  if (
    pathname?.startsWith("/admin") ||
    pathname?.startsWith("/login") ||
    pathname?.startsWith("/telegram-miniapp")
  ) {
    return null;
  }

  const handleLogoClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (pathname === "/") {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <div className="w-full sticky top-0 z-50 bg-[#14213d] border-b border-white/10 shadow-md">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
        <Link href="/" onClick={handleLogoClick} className="flex items-center gap-3">
          <Image
            src="/Grace-Daily_logo-tp.svg"
            alt="Grace Daily"
            width={132}
            height={44}
            style={{ height: "44px", width: "auto" }}
            className="object-contain"
            priority
          />
          <span className="hidden sm:inline text-lg font-semibold tracking-wide text-white" style={{ fontFamily: '"Monterchi Serif", Georgia, serif' }}>
            Grace Daily
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1 text-sm text-white/80">
          <a href="#fitur" className="px-4 py-2 hover:text-white transition">Fitur</a>

          <Link href="/alkitab" className="px-4 py-2 hover:text-white transition">Alkitab</Link>
          <Link href="/rencana-baca" className="px-4 py-2 hover:text-white transition">Rencana Baca Alkitab</Link>

          <div className="relative group">
            <button className="px-4 py-2 hover:text-white transition flex items-center gap-1">
              Jurnal & Doa
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <div className="absolute top-full left-0 mt-0 w-48 bg-white rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
              <Link href="/journal" className="block px-4 py-3 text-[#14213d] hover:bg-[#f7f4ee]">Jurnal Spiritual</Link>
              <Link href="/prayer-wall" className="block px-4 py-3 text-[#14213d] hover:bg-[#f7f4ee]">Dinding Doa</Link>
              <Link href="/grup-renungan" className="block px-4 py-3 text-[#14213d] hover:bg-[#f7f4ee]">Komunitas</Link>
            </div>
          </div>

          <div className="relative group">
            <button className="px-4 py-2 hover:text-white transition flex items-center gap-1">
              Renungan AI
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <div className="absolute top-full left-0 mt-0 w-56 bg-white rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
              <Link href="/ai" className="block px-4 py-3 text-[#14213d] hover:bg-[#f7f4ee]">Renungan Harian</Link>
              <Link href="/tanya-pendeta" className="block px-4 py-3 text-[#14213d] hover:bg-[#f7f4ee]">Tanya Pendeta</Link>
              <Link href="/sermon-assistant" className="block px-4 py-3 text-[#14213d] hover:bg-[#f7f4ee]">Asisten Khotbah</Link>
              <Link href="/ai?mode=sermon_guide" className="block px-4 py-3 text-[#14213d] hover:bg-[#f7f4ee]">Khotbah/Komsel</Link>
            </div>
          </div>

          <Link href="/ai?mode=song_recommendation" className="px-4 py-2 hover:text-white transition">Lagu Rohani</Link>
          <Link href="/blog" className="px-4 py-2 hover:text-white transition">Blog</Link>
          <Link href="/ensiklopedia" className="px-4 py-2 hover:text-white transition">Ensiklopedia</Link>
        </nav>

        {/* Auth + Mobile */}
        <div className="flex items-center gap-4">
          <div className="hidden md:block">
            <AuthNav />
          </div>

          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden p-2 text-white/80 hover:text-white focus:outline-none"
            aria-label="Toggle menu"
          >
            {isOpen ? (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile Dropdown */}
        {isOpen && (
          <div className="absolute top-full left-0 right-0 bg-[#14213d] border-t border-white/10 p-6 flex flex-col gap-4 shadow-2xl md:hidden animate-in slide-in-from-top-2 max-h-[80vh] overflow-y-auto">
            <a href="#fitur" onClick={() => setIsOpen(false)} className="text-white/80 hover:text-white text-base font-semibold">Fitur</a>

            <Link href="/alkitab" onClick={() => setIsOpen(false)} className="text-white/80 hover:text-white text-base font-semibold">Alkitab</Link>
            <Link href="/rencana-baca" onClick={() => setIsOpen(false)} className="text-white/80 hover:text-white text-base font-semibold">Rencana Baca Alkitab</Link>

            <div className="border-t border-white/10 pt-4">
              <p className="text-white/60 text-xs uppercase tracking-wider mb-2">Jurnal & Doa</p>
              <Link href="/journal" onClick={() => setIsOpen(false)} className="block text-white/80 hover:text-white text-base font-semibold py-1">Jurnal Spiritual</Link>
              <Link href="/prayer-wall" onClick={() => setIsOpen(false)} className="block text-white/80 hover:text-white text-base font-semibold py-1">Dinding Doa</Link>
              <Link href="/grup-renungan" onClick={() => setIsOpen(false)} className="block text-white/80 hover:text-white text-base font-semibold py-1">Komunitas</Link>
            </div>

            <div className="border-t border-white/10 pt-4">
              <p className="text-white/60 text-xs uppercase tracking-wider mb-2">Renungan AI</p>
              <Link href="/ai" onClick={() => setIsOpen(false)} className="block text-white/80 hover:text-white text-base font-semibold py-1">Renungan Harian</Link>
              <Link href="/tanya-pendeta" onClick={() => setIsOpen(false)} className="block text-white/80 hover:text-white text-base font-semibold py-1">Tanya Pendeta</Link>
              <Link href="/sermon-assistant" onClick={() => setIsOpen(false)} className="block text-white/80 hover:text-white text-base font-semibold py-1">Asisten Khotbah</Link>
              <Link href="/ai?mode=sermon_guide" onClick={() => setIsOpen(false)} className="block text-white/80 hover:text-white text-base font-semibold py-1">Khotbah/Komsel</Link>
            </div>

            <div className="border-t border-white/10 pt-4">
              <Link href="/ai?mode=song_recommendation" onClick={() => setIsOpen(false)} className="block text-white/80 hover:text-white text-base font-semibold py-1">Lagu Rohani</Link>
              <Link href="/blog" onClick={() => setIsOpen(false)} className="block text-white/80 hover:text-white text-base font-semibold py-1">Blog</Link>
              <Link href="/ensiklopedia" onClick={() => setIsOpen(false)} className="block text-white/80 hover:text-white text-base font-semibold py-1">Ensiklopedia</Link>
            </div>

            <div className="pt-5 border-t border-white/10">
              <AuthNav />
            </div>
          </div>
        )}
      </header>
    </div>
  );
}

