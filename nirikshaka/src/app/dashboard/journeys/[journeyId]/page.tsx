"use client";

import React, { useEffect, useState, Suspense } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Clock,
  Monitor,
  Smartphone,
  Globe,
  User,
  Mail,
  Phone,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Eye,
  MousePointer,
  Navigation,
  Wifi,
  Play,
  Pause,
  X,
  Lightbulb,
  MessageSquare,
  Loader2,
  Camera,
  ShoppingCart,
  CreditCard,
  LogIn,
  LogOut,
  UserPlus,
  Home,
  Trash2,
  Settings2,
  PhoneCall,
  Calendar,
  XCircle,
  MapPin,
  Wallet,
  Percent,
  UserCheck,
  CheckCircle2,
  Grid,
  ChevronRight,
  ClipboardList,
  Activity,
  ShieldCheck,
} from "lucide-react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { getJourneyDetail, analyzeJourney } from "../actions";
import { cn } from "@/lib/utils";
import { ScreenshotThumbnail } from "@/components/ui/screenshot-viewer";

function formatDuration(seconds: number | null): string {
  if (!seconds) return "—";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatFullDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const eventIcons: Record<string, any> = {
  screen_view: Eye,
  button_tap: MousePointer,
  navigation_push: Navigation,
  navigation_pop: ArrowLeft,
  app_lifecycle: Play,
  api_call: Wifi,
  screenshot: Camera,
  custom: MessageSquare,
};

const eventColors: Record<string, string> = {
  screen_view: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  button_tap: "text-brand bg-brand/10 border-brand/20",
  navigation_push: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
  navigation_pop: "text-slate-400 bg-slate-500/10 border-slate-500/20",
  app_lifecycle: "text-green-400 bg-green-500/10 border-green-500/20",
  api_call: "text-purple-400 bg-purple-500/10 border-purple-500/20",
  screenshot: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  custom: "text-pink-400 bg-pink-500/10 border-pink-500/20",
};

const customEventConfig: Record<string, { label: string; icon: any; colorClass: string }> = {
  // Auth & Profile
  el_login: {
    label: "Logged In",
    icon: LogIn,
    colorClass: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  },
  el_signup: {
    label: "Signed Up",
    icon: UserPlus,
    colorClass: "text-sky-400 bg-sky-500/10 border-sky-500/20",
  },
  el_logout: {
    label: "Logged Out",
    icon: LogOut,
    colorClass: "text-slate-400 bg-slate-500/10 border-slate-500/20",
  },
  el_delete_account: {
    label: "Account Deleted",
    icon: Trash2,
    colorClass: "text-red-400 bg-red-500/10 border-red-500/20",
  },
  el_edit_profile: {
    label: "Profile Edited",
    icon: Settings2,
    colorClass: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
  },
  el_notification_preferences: {
    label: "Notification Prefs Updated",
    icon: Settings2,
    colorClass: "text-slate-400 bg-slate-500/10 border-slate-500/20",
  },
  el_call_now: {
    label: "Call Support Clicked",
    icon: PhoneCall,
    colorClass: "text-teal-400 bg-teal-500/10 border-teal-500/20",
  },

  // Address
  el_add_address: {
    label: "Added New Address",
    icon: MapPin,
    colorClass: "text-violet-400 bg-violet-500/10 border-violet-500/20",
  },
  el_address_set_default: {
    label: "Set Address as Default",
    icon: MapPin,
    colorClass: "text-purple-400 bg-purple-500/10 border-purple-500/20",
  },
  el_manage_address: {
    label: "Opened Manage Addresses",
    icon: MapPin,
    colorClass: "text-fuchsia-400 bg-fuchsia-500/10 border-fuchsia-500/20",
  },

  // Navigation & Category Browsing
  el_home: {
    label: "Home Screen Visited",
    icon: Home,
    colorClass: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  },
  el_main_category: {
    label: "Selected Main Category",
    icon: Grid,
    colorClass: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  },
  el_sub_category_view: {
    label: "Selected Category Options",
    icon: Grid,
    colorClass: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
  },
  el_sub_category: {
    label: "Proceeded to Provider Selection",
    icon: ChevronRight,
    colorClass: "text-sky-400 bg-sky-500/10 border-sky-500/20",
  },
  el_service_provider_view: {
    label: "Viewed Service Provider Details",
    icon: Eye,
    colorClass: "text-pink-400 bg-pink-500/10 border-pink-500/20",
  },

  // Cart & checkout
  el_my_cart_view: {
    label: "Viewed Item in Cart",
    icon: ShoppingCart,
    colorClass: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  },
  el_my_cart: {
    label: "Clicked Pay Now",
    icon: CreditCard,
    colorClass: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  },
  el_payment_type: {
    label: "Selected Payment Method",
    icon: CreditCard,
    colorClass: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  },
  el_select_promo: {
    label: "Applied Promo Coupon",
    icon: Percent,
    colorClass: "text-green-400 bg-green-500/10 border-green-500/20",
  },
  el_select_vip: {
    label: "Selected VIP Plan in Cart",
    icon: ShieldCheck,
    colorClass: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
  },
  el_select_wallet: {
    label: "Applied Wallet Balance",
    icon: Wallet,
    colorClass: "text-teal-400 bg-teal-500/10 border-teal-500/20",
  },

  // Bookings & Payments
  charged: {
    label: "Booking Successful",
    icon: CheckCircle2,
    colorClass: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  },
  el_booking_unsuccessful: {
    label: "Booking Failed",
    icon: XCircle,
    colorClass: "text-red-400 bg-red-500/10 border-red-500/20",
  },
  el_payment_status: {
    label: "Checked Payment Status",
    icon: CreditCard,
    colorClass: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  },
  el_my_booking_tab: {
    label: "Viewed Booking Status Tab",
    icon: ClipboardList,
    colorClass: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
  },
  el_my_booking_details: {
    label: "Viewed Booking Details",
    icon: ClipboardList,
    colorClass: "text-pink-400 bg-pink-500/10 border-pink-500/20",
  },
  el_reschedule_booking: {
    label: "Rescheduled Booking",
    icon: Calendar,
    colorClass: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  },
  el_cancel_booking: {
    label: "Cancelled Booking",
    icon: XCircle,
    colorClass: "text-rose-400 bg-rose-500/10 border-rose-500/20",
  },
  el_partial_payment: {
    label: "Completed Partial Payment",
    icon: Wallet,
    colorClass: "text-teal-400 bg-teal-500/10 border-teal-500/20",
  },

  // VIP Subscription
  el_be_a_vip: {
    label: "Clicked 'Be a VIP' Banner",
    icon: Sparkles,
    colorClass: "text-violet-400 bg-violet-500/10 border-violet-500/20",
  },
  el_be_a_vip_view_details: {
    label: "Viewed VIP Plan Details",
    icon: Sparkles,
    colorClass: "text-fuchsia-400 bg-fuchsia-500/10 border-fuchsia-500/20",
  },
  el_be_a_vip_buy: {
    label: "Purchased VIP Subscription",
    icon: UserCheck,
    colorClass: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  },

  // App Lifecycle / Stats
  el_last_screen: {
    label: "App Session Details Captured",
    icon: Activity,
    colorClass: "text-slate-400 bg-slate-500/10 border-slate-500/20",
  },
};

function getEventDetails(event: any) {
  let label = event.name;
  let Icon = eventIcons[event.type] || MessageSquare;
  let colorClass = eventColors[event.type] || "text-muted-foreground bg-muted/10 border-border";

  if (event.type === "custom") {
    const config = customEventConfig[event.name];
    if (config) {
      label = config.label;
      Icon = config.icon;
      colorClass = config.colorClass;
    } else {
      label = event.name
        .replace(/^el_/, "")
        .replace(/_/g, " ")
        .split(" ")
        .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
    }
  }

  return { label, Icon, colorClass };
}

function EventDataRenderer({ data }: { data: any }) {
  if (!data || typeof data !== "object") return null;

  const entries = Object.entries(data).filter(([key]) => key !== "screenshotUrl" && key !== "screenshot");
  if (entries.length === 0) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 mt-2">
      {entries.map(([key, value]) => {
        const formattedKey = key
          .replace(/_/g, " ")
          .split(" ")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ");

        let valStr = "";
        if (value === null || value === undefined) {
          valStr = "—";
        } else if (typeof value === "object") {
          valStr = JSON.stringify(value);
        } else {
          valStr = String(value);
        }

        return (
          <div
            key={key}
            className="p-3 rounded-xl bg-muted/20 border border-border/50 hover:border-brand/30 hover:bg-muted/35 transition-all duration-200"
          >
            <p className="text-[10px] font-semibold text-muted-foreground/85 uppercase tracking-wider">
              {formattedKey}
            </p>
            <p className="text-xs font-medium text-foreground mt-1 break-words leading-relaxed">
              {valStr}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function JourneyDetailContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId") || "";
  const journeyId = params.journeyId as string;

  const [journey, setJourney] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
  const [timelineMode, setTimelineMode] = useState<"full" | "screen">("full");

  const screenPath = React.useMemo(() => {
    if (!journey || !journey.events) return [];
    return journey.events
      .filter((e: any) => e.type === "screen_view")
      .map((e: any) => e.name);
  }, [journey]);

  const screenGroups = React.useMemo(() => {
    if (!journey || !journey.events) return [];

    const groups: { screenName: string; events: any[] }[] = [];
    let currentGroup: { screenName: string; events: any[] } | null = null;

    for (const event of journey.events) {
      const screenName = event.screen || (event.type === "screen_view" ? event.name : null);
      
      if (screenName || !currentGroup) {
        currentGroup = {
          screenName: screenName || "Pre-session / Unknown",
          events: [],
        };
        groups.push(currentGroup);
      }
      currentGroup.events.push(event);
    }
    return groups;
  }, [journey]);

  useEffect(() => {
    if (journeyId) {
      getJourneyDetail(journeyId).then((data) => {
        setJourney(data);
        if (data?.summary) {
          setAnalysis({
            summary: data.summary,
            suggestions: data.suggestions,
          });
        }
        setLoading(false);
      });
    }
  }, [journeyId]);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    const result = await analyzeJourney(journeyId);
    if (!result.error) {
      setAnalysis(result);
    }
    setAnalyzing(false);
  };

  const toggleEvent = (id: string) => {
    const next = new Set(expandedEvents);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedEvents(next);
  };

  if (loading) {
    return (
      <div className="flex justify-center p-20">
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
      </div>
    );
  }

  if (!journey) {
    return (
      <div className="flex flex-col items-center justify-center p-20">
        <p className="text-muted-foreground">Journey not found</p>
        <button
          onClick={() => router.back()}
          className="mt-3 text-sm text-brand hover:underline"
        >
          Go back
        </button>
      </div>
    );
  }

  const PlatformIcon =
    journey.platform === "android" || journey.platform === "ios"
      ? Smartphone
      : journey.platform === "web"
        ? Globe
        : Monitor;

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between"
      >
        <div className="flex items-start gap-4">
          <button
            onClick={() => {
              if (projectId) {
                router.push(`/dashboard/projects/${projectId}?tab=journeys`);
              } else {
                router.push(`/dashboard/journeys`);
              }
            }}
            className="mt-1 p-2 rounded-xl border border-border hover:border-brand/30 hover:bg-brand/5 transition-all"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {journey.userName || "Anonymous User"}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Session on {formatFullDate(journey.startedAt)}
            </p>
          </div>
        </div>
        <button
          onClick={handleAnalyze}
          disabled={analyzing}
          className={cn(
            "flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all",
            analyzing
              ? "bg-brand/20 text-brand cursor-wait"
              : "brand-gradient text-black hover:shadow-lg hover:shadow-brand/20"
          )}
        >
          {analyzing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              {analysis ? "Re-analyze" : "Analyze Journey"}
            </>
          )}
        </button>
      </motion.div>

      {/* User Info + Session Metadata */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* User Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card-premium p-5"
        >
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <User className="h-4 w-4 text-brand" />
            User Info
          </h3>
          <div className="space-y-3">
            {journey.userName && (
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center">
                  <span className="text-sm font-bold text-brand">
                    {journey.userName
                      .split(" ")
                      .map((n: string) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2)}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {journey.userName}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Display Name
                  </p>
                </div>
              </div>
            )}
            {journey.userEmail && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-foreground">{journey.userEmail}</span>
              </div>
            )}
            {journey.userMobile && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="text-foreground">{journey.userMobile}</span>
              </div>
            )}
            {journey.appUserId && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">App ID:</span>
                <span className="font-mono text-foreground">
                  {journey.appUserId}
                </span>
              </div>
            )}
            {!journey.userName && !journey.userEmail && !journey.userMobile && (
              <p className="text-sm text-muted-foreground/60 italic">
                No user information available
              </p>
            )}
          </div>
        </motion.div>

        {/* Session Meta */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="card-premium p-5 lg:col-span-2"
        >
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <Monitor className="h-4 w-4 text-brand" />
            Session Details
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Platform</p>
              <div className="flex items-center gap-1.5">
                <PlatformIcon className="h-4 w-4 text-brand" />
                <span className="text-sm font-medium text-foreground capitalize">
                  {journey.platform}
                </span>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">App Version</p>
              <p className="text-sm font-medium text-foreground font-mono">
                {journey.appVersion}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">OS</p>
              <p className="text-sm font-medium text-foreground">
                {journey.os || "—"} {journey.osVersion || ""}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Duration</p>
              <div className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">
                  {formatDuration(journey.duration)}
                </span>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Total Events</p>
              <p className="text-sm font-medium text-foreground">
                {journey.events?.length || 0}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">
                Screens Visited
              </p>
              <p className="text-sm font-medium text-foreground">
                {journey.screenCount}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Status</p>
              {!journey.endedAt ? (
                <span className="flex items-center gap-1.5 text-sm font-medium text-green-400">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                  </span>
                  Active
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">Ended</span>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Project</p>
              <p className="text-sm font-medium text-foreground">
                {journey.project?.name || "—"}
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* AI Analysis Cards */}
      {analysis && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Summary */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="gradient-border p-5"
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-lg bg-brand/10">
                <Sparkles className="h-4 w-4 text-brand" />
              </div>
              <h3 className="font-semibold text-foreground">
                AI Summary
              </h3>
              <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                {analysis.source === "ai" ? "Gemini" : "Rule-based"}
              </span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {analysis.summary}
            </p>
          </motion.div>

          {/* Suggestions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="gradient-border p-5"
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-lg bg-green-500/10">
                <Lightbulb className="h-4 w-4 text-green-400" />
              </div>
              <h3 className="font-semibold text-foreground">
                UX Suggestions
              </h3>
            </div>
            <div className="space-y-3">
              {(analysis.suggestions || []).map(
                (suggestion: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-muted/30 border border-border"
                  >
                    <p className="text-sm font-medium text-foreground mb-1">
                      {idx + 1}. {suggestion.title}
                    </p>
                    {suggestion.issue && (
                      <p className="text-xs text-red-400/80 mb-1">
                        Issue: {suggestion.issue}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {suggestion.recommendation || suggestion.description}
                    </p>
                  </div>
                )
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Event Timeline */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="card-premium p-5"
      >
        {/* Toggle + Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Navigation className="h-4 w-4 text-brand" />
            Journey Timeline
            <span className="text-xs text-muted-foreground font-normal ml-2">
              {journey.events?.length || 0} events
            </span>
          </h3>

          <div className="flex items-center gap-1 p-1 bg-muted rounded-xl border border-border">
            <button
              onClick={() => setTimelineMode("full")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                timelineMode === "full"
                  ? "bg-brand text-black font-semibold shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Full Timeline
            </button>
            <button
              onClick={() => setTimelineMode("screen")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                timelineMode === "screen"
                  ? "bg-brand text-black font-semibold shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Screen-wise Flow
            </button>
          </div>
        </div>

        {/* Visual Screen Flow Path */}
        {screenPath.length > 0 && (
          <div className="mb-6 bg-muted/40 border border-border/60 rounded-xl p-4 overflow-x-auto whitespace-nowrap scrollbar-thin">
            <div className="flex items-center gap-2.5">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mr-2">Screen Flow:</span>
              {screenPath.map((screen: string, sIdx: number) => (
                <React.Fragment key={sIdx}>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand/5 border border-brand/10 text-xs font-medium text-brand">
                    <Monitor className="h-3.5 w-3.5" />
                    {screen}
                  </div>
                  {sIdx < screenPath.length - 1 && (
                    <span className="text-muted-foreground/40 font-bold text-sm">➔</span>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        )}

        <div className="relative">
          {timelineMode === "full" ? (
            <>
              {/* Timeline line */}
              <div className="absolute left-[19px] top-0 bottom-0 w-px bg-border" />

              <div className="space-y-1">
                {(journey.events || []).map(
                  (event: any, idx: number) => {
                    const { label, Icon: EventIcon, colorClass } = getEventDetails(event);
                    const isExpanded = expandedEvents.has(event.id);

                    return (
                      <motion.div
                        key={event.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.02 }}
                        className="relative flex gap-4 group"
                      >
                        {/* Icon */}
                        <div
                          className={cn(
                            "relative z-10 h-10 w-10 rounded-xl border flex items-center justify-center flex-shrink-0",
                            colorClass
                          )}
                        >
                          <EventIcon className="h-4 w-4" />
                        </div>

                        {/* Content */}
                        <div
                          className={cn(
                            "flex-1 pb-4 cursor-pointer",
                            event.data && "hover:bg-muted/10 -mx-2 px-2 rounded-xl transition-colors"
                          )}
                          onClick={() => event.data && toggleEvent(event.id)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-foreground">
                                {label}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                                {event.type === "custom" ? "custom event" : event.type.replace(/_/g, " ")}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {event.duration && (
                                <span className="text-[10px] text-muted-foreground">
                                  {event.duration}ms
                                </span>
                              )}
                              <span className="text-[10px] text-muted-foreground font-mono">
                                {formatTime(event.timestamp)}
                              </span>
                              {event.data && (
                                isExpanded ? (
                                  <ChevronUp className="h-3 w-3 text-muted-foreground" />
                                ) : (
                                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                                )
                              )}
                            </div>
                          </div>

                          {/* Expanded event data */}
                          {isExpanded && event.data && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              className="mt-2 p-3 rounded-lg bg-muted/30 border border-border space-y-3"
                            >
                              {event.data.screenshotUrl && (
                                <div className="mb-2">
                                  <ScreenshotThumbnail
                                    url={event.data.screenshotUrl}
                                    label="User Screenshot"
                                  />
                                </div>
                              )}
                              <EventDataRenderer data={event.data} />
                            </motion.div>
                          )}
                        </div>
                      </motion.div>
                    );
                  }
                )}
              </div>
            </>
          ) : (
            <div className="space-y-6">
              {screenGroups.map((group, gIdx) => (
                <motion.div
                  key={gIdx}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: gIdx * 0.05 }}
                  className="bg-card/50 border border-border rounded-xl p-5 shadow-sm space-y-4"
                >
                  <div className="flex items-center justify-between border-b border-border/40 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-brand/10 text-brand">
                        <Monitor className="h-4 w-4" />
                      </div>
                      <h4 className="font-semibold text-foreground text-base">
                        {group.screenName}
                      </h4>
                    </div>
                    <span className="text-xs text-muted-foreground font-medium bg-muted px-2.5 py-1 rounded-full border border-border">
                      {group.events.length} event(s)
                    </span>
                  </div>

                  <div className="space-y-2.5 pl-2">
                    {group.events.map((event, eIdx) => {
                      const { label, Icon: EventIcon, colorClass } = getEventDetails(event);
                      const isExpanded = expandedEvents.has(event.id);

                      return (
                        <div key={event.id} className="flex gap-3">
                          <div className={cn("h-7 w-7 rounded-lg border flex items-center justify-center flex-shrink-0 text-xs", colorClass)}>
                            <EventIcon className="h-3.5 w-3.5" />
                          </div>
                          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => event.data && toggleEvent(event.id)}>
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-medium text-foreground truncate">{label}</p>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">
                                  {event.type === "custom" ? "custom event" : event.type.replace(/_/g, " ")}
                                </span>
                                <span className="text-[10px] text-muted-foreground/60 font-mono">{formatTime(event.timestamp)}</span>
                                {event.data && (
                                  isExpanded ? (
                                    <ChevronUp className="h-3 w-3 text-muted-foreground" />
                                  ) : (
                                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                                  )
                                )}
                              </div>
                            </div>

                            {isExpanded && event.data && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                className="mt-2 p-3 rounded-lg bg-muted/30 border border-border space-y-3"
                              >
                                {event.data.screenshotUrl && (
                                  <div className="mb-2">
                                    <ScreenshotThumbnail
                                      url={event.data.screenshotUrl}
                                      label="User Screenshot"
                                    />
                                  </div>
                                )}
                                <EventDataRenderer data={event.data} />
                              </motion.div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* End marker */}
          {journey.endedAt && (
            <div className="relative flex gap-4 items-center mt-4 pt-4 border-t border-border/40">
              <div className="relative z-10 h-10 w-10 rounded-xl border border-red-500/20 bg-red-500/10 flex items-center justify-center flex-shrink-0">
                <X className="h-4 w-4 text-red-400" />
              </div>
              <div>
                <span className="text-sm font-medium text-red-400">
                  Session Ended
                </span>
                <span className="text-[10px] text-muted-foreground ml-2 font-mono">
                  {formatTime(journey.endedAt)}
                </span>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export default function JourneyDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center p-20">
          <Loader2 className="h-6 w-6 animate-spin text-brand" />
        </div>
      }
    >
      <JourneyDetailContent />
    </Suspense>
  );
}
