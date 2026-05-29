"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { AuthNav } from "@/app/components/AuthNav";

export function Header() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  if (pathname?.startsWith("/admin") || pathname?.startsWith("/login")) {
    return null;
  }

  return (
    <div className="w-full sticky top-0 z-50 bg-[#14213d] border-b border-white/10 shadow-md">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/logo.jpg"
            alt="Grace Daily"
            width={44}
            height={44}
            className="h-11 w-11 rounded-lg object-cover"
            priority
          />
          <span className="text-lg font-semibold tracking-wide text-white">
            Grace Daily
          </span>
        </Link>
        
        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-6 text-sm text-white/80">
          <a href="#fitur" className="hover:text-white transition">Fitur</a>
          <Link href="/alkitab" className="hover:text-white transition">Alkitab</Link>
          <Link href="/rencana-baca" className="hover:text-white transition">Rencana Baca</Link>
          <Link href="/ai" className="hover:text-white transition">Renungan</Link>
          <Link href="/tanya-pendeta" className="hover:text-white transition">Tanya Pendeta</Link>
          <Link href="/grup-renungan" className="hover:text-white transition">Komunitas</Link>
          <Link href="/ai?mode=sermon_guide" className="hover:text-white transition">Khotbah/Komsel</Link>
          <Link href="/ai?mode=song_recommendation" className="hover:text-white transition">Lagu Rohani</Link>
          <Link href="/blog" className="hover:text-white transition">Blog</Link>
          <a href="#paket" className="hover:text-white transition">Premium</a>
        </nav>

        <div className="flex items-center gap-4">
          <div className="hidden md:block">
            <AuthNav />
          </div>

          {/* Mobile Hamburger Button */}
          <button 
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden p-2 text-white/80 hover:text-white focus:outline-none"
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

        {/* Mobile Menu Dropdown */}
        {isOpen && (
          <div className="absolute top-full left-0 right-0 bg-[#14213d] border-t border-white/10 p-6 flex flex-col gap-5 shadow-2xl md:hidden animate-in slide-in-from-top-2">
            <a href="#fitur" onClick={() => setIsOpen(false)} className="text-white/80 hover:text-white text-base font-semibold">Fitur</a>
            <Link href="/alkitab" onClick={() => setIsOpen(false)} className="text-white/80 hover:text-white text-base font-semibold">Alkitab</Link>
            <Link href="/rencana-baca" onClick={() => setIsOpen(false)} className="text-white/80 hover:text-white text-base font-semibold">Rencana Baca</Link>
            <Link href="/ai" onClick={() => setIsOpen(false)} className="text-white/80 hover:text-white text-base font-semibold">Renungan</Link>
            <Link href="/tanya-pendeta" onClick={() => setIsOpen(false)} className="text-white/80 hover:text-white text-base font-semibold">Tanya Pendeta</Link>
            <Link href="/grup-renungan" onClick={() => setIsOpen(false)} className="text-white/80 hover:text-white text-base font-semibold">Komunitas</Link>
            <Link href="/ai?mode=sermon_guide" onClick={() => setIsOpen(false)} className="text-white/80 hover:text-white text-base font-semibold">Khotbah/Komsel</Link>
            <Link href="/ai?mode=song_recommendation" onClick={() => setIsOpen(false)} className="text-white/80 hover:text-white text-base font-semibold">Lagu Rohani</Link>
            <Link href="/blog" onClick={() => setIsOpen(false)} className="text-white/80 hover:text-white text-base font-semibold">Blog</Link>
            <a href="#paket" onClick={() => setIsOpen(false)} className="text-white/80 hover:text-white text-base font-semibold">Premium</a>
            <div className="pt-5 border-t border-white/10">
              <AuthNav />
            </div>
          </div>
        )}
      </header>
    </div>
  );
}
