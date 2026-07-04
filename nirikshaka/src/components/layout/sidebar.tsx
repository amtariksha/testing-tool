"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FolderOpen,
  Activity,
  Bug,
  Monitor,
  ArrowUpDown,
  Code2,
  Key,
  Users,
  CreditCard,
  Settings,
  ChevronLeft,
  Zap,
  Shield,
  Menu,
  X,
  LogOut,
  Footprints,
  ScanSearch,
  FlaskConical,
} from "lucide-react";
import { useState, useEffect } from "react";

const navItems = [
  {
    section: "Overview",
    items: [
      { label: "Overview", icon: LayoutDashboard, href: "/dashboard" },
      { label: "Projects", icon: FolderOpen, href: "/dashboard/projects" },
    ],
  },
  {
    section: "Intelligence",
    items: [
      { label: "App Model", icon: ScanSearch, href: "/dashboard/app-model" },
      { label: "Test Runs", icon: FlaskConical, href: "/dashboard/test-runs" },
    ],
  },
  {
    section: "Integration",
    items: [
      { label: "SDKs", icon: Code2, href: "/dashboard/sdks" },
    ],
  },
  {
    section: "Account",
    items: [
      { label: "Team", icon: Users, href: "/dashboard/team" },
      { label: "Settings", icon: Settings, href: "/dashboard/settings" },
    ],
  },
];

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
  user?: UserInfo | null;
}

interface UserInfo {
  name: string;
  email: string;
}

function SidebarContent({ collapsed = false, user }: { collapsed: boolean; user?: UserInfo | null }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const projectId = searchParams?.get("projectId");
  const [localUser, setLocalUser] = useState<UserInfo | null>(null);



  useEffect(() => {
    if (!user) {
      import("@/app/auth/actions").then(({ getUser }) => {
        getUser().then((u: any) => {
          if (u) {
            setLocalUser({
              name: u.user_metadata?.full_name || u.email?.split("@")[0] || "User",
              email: u.email || "",
            });
          }
        });
      });
    }
  }, [user]);

  const handleSignOut = async () => {
    const { signOut } = await import("@/app/auth/actions");
    await signOut();
  };

  const activeUser = user || localUser;
  const displayName = activeUser?.name || "User";
  const displayEmail = activeUser?.email || "";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-border">
        <div className="relative flex-shrink-0">
          <img src="/logo.png" alt="Nirikshaka Logo" className="h-8 w-8 rounded-lg object-contain" />
        </div>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="overflow-hidden"
          >
            <span className="font-bold text-foreground text-base tracking-tight">
              Nirikshaka
            </span>
          </motion.div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-6">
        {navItems.map((section) => (
          <div key={section.section}>
            {!collapsed && (
              <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                {section.section}
              </p>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={projectId ? `${item.href}?projectId=${projectId}` : item.href}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative",
                        isActive
                          ? "bg-brand/10 text-brand"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                      )}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="sidebar-active"
                          className="absolute inset-0 bg-brand/10 rounded-xl"
                          transition={{ type: "spring", stiffness: 400, damping: 30 }}
                        />
                      )}
                      <item.icon
                        className={cn(
                          "h-4.5 w-4.5 flex-shrink-0 relative z-10",
                          isActive ? "text-brand" : "group-hover:text-foreground"
                        )}
                        size={18}
                      />
                      {!collapsed && (
                        <span className="relative z-10">{item.label}</span>
                      )}
                      {isActive && !collapsed && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-brand rounded-r-full" />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Bottom — User + Logout */}
      <div className="p-3 border-t border-border space-y-1">
        <Link
          href={projectId ? `/dashboard/settings?projectId=${projectId}` : "/dashboard/settings"}
          className={cn(
            "flex items-center gap-3 px-2 py-2 rounded-xl transition-all duration-200 cursor-pointer group hover:bg-muted/60",
            collapsed && "justify-center"
          )}
        >
          <div className="h-7 w-7 rounded-lg bg-brand/10 border border-brand/20 flex items-center justify-center flex-shrink-0 text-xs font-bold text-brand group-hover:bg-brand/20 group-hover:border-brand/40 transition-colors">
            {initials}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-foreground truncate group-hover:text-brand transition-colors">{displayName}</p>
              <p className="text-[10px] text-muted-foreground truncate">{displayEmail}</p>
            </div>
          )}
        </Link>
        <button
          onClick={handleSignOut}
          className={cn(
            "flex items-center gap-3 px-2 py-2 rounded-xl text-sm text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all w-full",
            collapsed && "justify-center"
          )}
        >
          <LogOut className="h-4 w-4 flex-shrink-0" size={16} />
          {!collapsed && <span className="text-xs">Sign out</span>}
        </button>
      </div>
    </div>
  );
}

export function Sidebar({ collapsed = false, onToggle, user }: SidebarProps) {
  return (
    <motion.aside
      animate={{ width: collapsed ? 68 : 240 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="relative h-full bg-card border-r border-border flex-shrink-0 overflow-hidden"
    >
      <SidebarContent collapsed={collapsed} user={user} />
      {/* Collapse toggle */}
      <button
        onClick={onToggle}
        className="absolute top-5 -right-3 z-50 h-6 w-6 rounded-full bg-card border border-border flex items-center justify-center shadow-sm hover:border-brand/50 hover:text-brand transition-all"
      >
        <ChevronLeft
          className={cn(
            "h-3.5 w-3.5 text-muted-foreground transition-transform",
            collapsed && "rotate-180"
          )}
        />
      </button>
    </motion.aside>
  );
}

// Mobile Sidebar
export function MobileSidebar({ user }: { user?: UserInfo | null }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="p-2 rounded-lg border border-border hover:border-brand/50 transition-colors lg:hidden"
      >
        <Menu className="h-4 w-4" />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
              onClick={() => setOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", stiffness: 400, damping: 40 }}
              className="fixed left-0 top-0 h-full w-64 bg-card border-r border-border z-50 lg:hidden"
            >
              <div className="flex items-center justify-end p-3 border-b border-border">
                <button
                  onClick={() => setOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <SidebarContent collapsed={false} user={user} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
