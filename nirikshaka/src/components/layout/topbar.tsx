"use client";

import { ThemeToggle } from "@/components/theme-toggle";
import { MobileSidebar } from "@/components/layout/sidebar";
import { WorkerHealthBadge } from "@/components/worker-health-badge";
import { Search } from "lucide-react";
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

        {/* Theme toggle */}
        <ThemeToggle />
      </div>
    </header>
  );
}
