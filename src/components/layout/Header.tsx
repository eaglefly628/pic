"use client";

import { useState } from "react";
import Link from "next/link";

const navLinks = [
  { href: "/", label: "首页" },
  { href: "/consultation", label: "咨询服务" },
  { href: "/cases", label: "真实案例" },
  { href: "/services", label: "服务项目" },
];

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-champagne-dark/20">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <span className="text-2xl font-bold bg-gradient-to-r from-rose-deep to-champagne-dark bg-clip-text text-transparent">
            糖糖和小希
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-brand-text-light hover:text-rose-deep transition-colors text-sm font-medium"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/login"
            className="px-4 py-2 bg-gradient-to-r from-rose-soft to-champagne rounded-full text-brand-text text-sm font-medium hover:shadow-md transition-shadow"
          >
            登录
          </Link>
        </nav>

        {/* Mobile Hamburger */}
        <button
          className="md:hidden flex flex-col gap-1.5 p-2"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="菜单"
        >
          <span
            className={`block w-6 h-0.5 bg-brand-text transition-transform ${menuOpen ? "rotate-45 translate-y-2" : ""}`}
          />
          <span
            className={`block w-6 h-0.5 bg-brand-text transition-opacity ${menuOpen ? "opacity-0" : ""}`}
          />
          <span
            className={`block w-6 h-0.5 bg-brand-text transition-transform ${menuOpen ? "-rotate-45 -translate-y-2" : ""}`}
          />
        </button>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <nav className="md:hidden bg-white border-t border-champagne-dark/20 px-4 py-4 space-y-3">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="block text-brand-text-light hover:text-rose-deep transition-colors text-base py-2"
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/login"
            className="block text-center px-4 py-2 bg-gradient-to-r from-rose-soft to-champagne rounded-full text-brand-text text-sm font-medium"
            onClick={() => setMenuOpen(false)}
          >
            登录
          </Link>
        </nav>
      )}
    </header>
  );
}
