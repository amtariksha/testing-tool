"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useState } from "react";
import { Zap, Menu, X } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "Docs", href: "/dashboard/sdks" },
];

export function LandingNav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed top-0 inset-x-0 z-50 pointer-events-none">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex items-center justify-between h-16 glass-dark rounded-2xl mt-3 px-5 border border-white/10 pointer-events-auto">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5">
            <img src="/logo.png" alt="Nirikshaka Logo" className="h-8 w-8 rounded-lg object-contain" />
            <span className="font-bold text-foreground">
              Nirikshaka
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="px-4 py-2 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              href="/login"
              className="hidden sm:block px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Login
            </Link>
            <Link
              href="/register"
              className="px-4 py-2 text-sm font-semibold rounded-xl brand-gradient text-black hover:opacity-90 transition-all brand-glow-sm"
            >
              Get Started
            </Link>
            <button onClick={() => setOpen(!open)} className="p-2 rounded-lg border border-border md:hidden">
              {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="md:hidden mt-2 glass-dark rounded-2xl border border-white/10 p-4 space-y-1"
          >
            {navLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                onClick={() => setOpen(false)}
                className="block px-4 py-2.5 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-white/5"
              >
                {link.label}
              </Link>
            ))}
            <Link href="/login" onClick={() => setOpen(false)} className="block px-4 py-2.5 rounded-xl text-sm text-muted-foreground">
              Login
            </Link>
          </motion.div>
        )}
      </div>
    </header>
  );
}
