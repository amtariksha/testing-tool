"use client";

import { ThemeToggle } from "@/components/theme-toggle";
import { MobileSidebar } from "@/components/layout/sidebar";
import { WorkerHealthBadge } from "@/components/worker-health-badge";
import { Bell, Search, ChevronDown } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";

interface UserInfo {
  name: string;
  email: string;
}

interface TopbarProps {
  title?: string;
  subtitle?: string;
  user?: UserInfo | null;
}

export function Topbar({ title, subtitle, user }: TopbarProps) {
  const [searchFocused, setSearchFocused] = useState(false);

  const displayName = user?.name || "User";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <header className="sticky top-0 z-30 h-14 border-b border-border bg-background/80 backdrop-blur-xl flex items-center gap-4 px-4 lg:px-6">
      {/* Mobile menu */}
      <MobileSidebar user={user} />

      {/* Title (mobile) */}
      {title && (
        <div className="flex-1 lg:hidden">
          <h1 className="text-sm font-semibold truncate">{title}</h1>
        </div>
      )}

      {/* Search */}
      <div className="hidden lg:flex flex-1 max-w-sm">
        <div
          className={`relative w-full transition-all duration-200 ${
            searchFocused ? "max-w-md" : "max-w-sm"
          }`}
        >
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search logs, crashes, errors..."
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            className="w-full h-9 pl-9 pr-4 bg-muted/50 border border-border rounded-xl text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:border-brand/50 focus:bg-muted/80 transition-all"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground/60 font-mono hidden sm:block">
            ⌘K
          </kbd>
        </div>
      </div>

      <div className="flex items-center gap-2 ml-auto">
        {/* Agent worker liveness */}
        <WorkerHealthBadge />

        {/* Notifications */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="relative p-2 rounded-lg border border-border hover:border-brand/50 bg-card hover:bg-brand/5 transition-all"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4 text-muted-foreground" />
          <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 bg-brand rounded-full" />
        </motion.button>

        {/* Theme toggle */}
        <ThemeToggle />

        {/* User menu */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border hover:border-brand/50 bg-card hover:bg-brand/5 transition-all"
        >
          <div className="h-6 w-6 rounded-lg bg-brand text-black text-xs font-bold flex items-center justify-center flex-shrink-0">
            {initials}
          </div>
          <span className="text-sm font-medium hidden sm:block">{displayName.split(" ")[0]}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground hidden sm:block" />
        </motion.button>
      </div>
    </header>
  );
}
