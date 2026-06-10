"use client";

import { useParams, useSearchParams, useRouter } from "next/navigation";
import React, { useState, useEffect, Fragment, useCallback, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity, Bug, Monitor, ArrowUpDown, ArrowLeft,
  ChevronRight, ChevronLeft, ChevronDown, Search, CheckCircle2, Play,
  RefreshCw, Globe, Wifi, WifiOff, Calendar, Clock,
  Footprints, Mail, Phone, User, Smartphone, Users, Filter, ArrowRight,
  Camera, Loader2, Send, Megaphone, Check, Bell, BellRing, Target, ShieldAlert, Award, X
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { getRelativeTime, formatBytes, formatDuration } from "@/lib/utils";
import { useMemo } from "react";
import { MethodBadge, StatusCodeBadge, SeverityBadge, Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  getCrashLogs, getApiRequests, getUiErrors, getDashboardStats, getProject,
} from "../../actions";
import { getJourneys, getJourneyStats, getScreenshotEvents, getCampaignEventStats, sendCampaignNotification, getProjectEventNames } from "../../journeys/actions";
import { useRealtime } from "@/hooks/use-realtime";
import { ScreenshotThumbnail } from "@/components/ui/screenshot-viewer";
import { StatCard } from "@/components/ui/stat-card";

const tabs = [
  { id: "overview", label: "Overview", icon: Activity },
  { id: "api-monitoring", label: "API Monitoring", icon: ArrowUpDown },
  { id: "requests", label: "Requests", icon: Globe },
  { id: "crashes", label: "Crash Logs", icon: Bug },
  { id: "ui-errors", label: "UI Errors", icon: Monitor },
  { id: "journeys", label: "User Journeys", icon: Footprints },
  { id: "screenshots", label: "Screenshots", icon: Camera },
  { id: "campaigns", label: "Campaigns", icon: Send },
];

type DatePreset = "today" | "7d" | "30d" | "all" | "custom";

function getPresetRange(preset: DatePreset): { from: Date | null; to: Date | null } {
  const now = new Date();
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  switch (preset) {
    case "today":
      return { from: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0), to };
    case "7d":
      return { from: new Date(now.getTime() - 7 * 86400000), to };
    case "30d":
      return { from: new Date(now.getTime() - 30 * 86400000), to };
    case "all":
      return { from: null, to: null };
    case "custom":
      return { from: null, to: null };
  }
}

function filterByDateRange<T extends { timestamp: string | Date }>(items: T[], from: Date | null, to: Date | null): T[] {
  if (!from && !to) return items;
  return items.filter((item) => {
    const ts = new Date(item.timestamp).getTime();
    if (from && ts < from.getTime()) return false;
    if (to && ts > to.getTime()) return false;
    return true;
  });
}

/* ─── DATE RANGE FILTER ─── */
function DateRangeFilter({
  datePreset,
  customFrom,
  customTo,
  onPresetChange,
  onCustomFromChange,
  onCustomToChange,
}: {
  datePreset: DatePreset;
  customFrom: string;
  customTo: string;
  onPresetChange: (v: DatePreset) => void;
  onCustomFromChange: (v: string) => void;
  onCustomToChange: (v: string) => void;
}) {
  const presets: { id: DatePreset; label: string; icon?: any }[] = [
    { id: "today", label: "Today" },
    { id: "7d", label: "7 Days" },
    { id: "30d", label: "30 Days" },
    { id: "all", label: "All Time" },
    { id: "custom", label: "Custom" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: -5 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-premium p-3"
    >
      <div className="flex flex-wrap items-center gap-3">
        {/* Calendar icon */}
        <div className="flex items-center gap-2 text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span className="text-xs font-medium uppercase tracking-wider">Date Range</span>
        </div>

        {/* Divider */}
        <div className="h-6 w-px bg-border hidden sm:block" />

        {/* Preset buttons */}
        <div className="flex gap-1">
          {presets.map((p) => (
            <button
              key={p.id}
              onClick={() => onPresetChange(p.id)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                datePreset === p.id
                  ? "bg-brand text-black"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Custom date inputs */}
        <AnimatePresence>
          {datePreset === "custom" && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              className="flex items-center gap-2 overflow-hidden"
            >
              <div className="h-6 w-px bg-border" />
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">From</label>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => onCustomFromChange(e.target.value)}
                  className="bg-muted/50 border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-brand/50 transition-colors [color-scheme:dark]"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">To</label>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => onCustomToChange(e.target.value)}
                  className="bg-muted/50 border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-brand/50 transition-colors [color-scheme:dark]"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function ProjectDetailContent() {
  const { projectId } = useParams<{ projectId: string }>();
  const searchParams = useSearchParams();
  const initialTab = searchParams?.get("tab") || "overview";
  const [activeTab, setActiveTab] = useState(initialTab);
  const [project, setProject] = useState<any>(null);

  const filteredTabs = useMemo(() => {
    if (!project) return [tabs[0]]; // Only return Overview tab while loading to prevent tab flashing
    return tabs.filter((tab) => {
      if (tab.id === "api-monitoring" || tab.id === "requests") {
        return project.enableNetworkTracking;
      }
      if (tab.id === "crashes") {
        return project.enableCrashReporting;
      }
      if (tab.id === "ui-errors") {
        return project.enableUIErrorTracking;
      }
      if (tab.id === "journeys" || tab.id === "campaigns") {
        return project.enableJourneyTracking;
      }
      if (tab.id === "screenshots") {
        return project.enableScreenshotDetection;
      }
      return true;
    });
  }, [project]);

  // Tab-specific states and their loading indicators
  const [stats, setStats] = useState<any>(null);
  const [requests, setRequests] = useState<any[]>([]);
  const [crashes, setCrashes] = useState<any[]>([]);
  const [uiErrors, setUiErrors] = useState<any[]>([]);

  // Individual loading states
  const [statsLoading, setStatsLoading] = useState(true);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [crashesLoading, setCrashesLoading] = useState(false);
  const [uiErrorsLoading, setUiErrorsLoading] = useState(false);

  // Keep track of what we have already fetched to avoid duplicate queries
  const [hasFetchedRequests, setHasFetchedRequests] = useState(false);
  const [hasFetchedCrashes, setHasFetchedCrashes] = useState(false);
  const [hasFetchedUiErrors, setHasFetchedUiErrors] = useState(false);

  // Date range filter state
  const [datePreset, setDatePreset] = useState<DatePreset>("today");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const fetchStats = useCallback(() => {
    setStatsLoading(true);
    getDashboardStats(projectId).then((s) => {
      setStats(s);
      setStatsLoading(false);
    });
  }, [projectId]);

  const fetchRequests = useCallback((limit: number = 100) => {
    setRequestsLoading(true);
    getApiRequests(projectId, limit).then((r) => {
      setRequests(r as any);
      setRequestsLoading(false);
      setHasFetchedRequests(true);
    });
  }, [projectId]);

  const fetchCrashes = useCallback((limit: number = 50) => {
    setCrashesLoading(true);
    getCrashLogs(projectId, limit).then((c) => {
      setCrashes(c as any);
      setCrashesLoading(false);
      setHasFetchedCrashes(true);
    });
  }, [projectId]);

  const fetchUiErrors = useCallback((limit: number = 50) => {
    setUiErrorsLoading(true);
    getUiErrors(projectId, limit).then((u) => {
      setUiErrors(u as any);
      setUiErrorsLoading(false);
      setHasFetchedUiErrors(true);
    });
  }, [projectId]);

  const fetchAll = useCallback(() => {
    fetchStats();
    getProject(projectId).then((p) => setProject(p));
    // Re-fetch whatever tab requires
    if (activeTab === "overview") {
      fetchRequests(100);
      fetchCrashes(50);
      fetchUiErrors(50);
    } else if (activeTab === "api-monitoring" || activeTab === "requests") {
      fetchRequests(100);
    } else if (activeTab === "crashes") {
      fetchCrashes(50);
    } else if (activeTab === "ui-errors") {
      fetchUiErrors(50);
    }
  }, [projectId, activeTab, fetchStats, fetchRequests, fetchCrashes, fetchUiErrors]);

  // Load stats and reset on projectId changes
  useEffect(() => {
    if (!projectId) return;

    setProject(null);
    setStats(null);
    setRequests([]);
    setCrashes([]);
    setUiErrors([]);
    setHasFetchedRequests(false);
    setHasFetchedCrashes(false);
    setHasFetchedUiErrors(false);

    getProject(projectId).then((p) => {
      setProject(p);
    });

    fetchStats();
  }, [projectId, fetchStats]);

  // Handle active tab changes and lazy-load data as needed
  useEffect(() => {
    if (!projectId) return;

    if (activeTab === "overview") {
      if (!hasFetchedRequests && !requestsLoading) fetchRequests(100);
      if (!hasFetchedCrashes && !crashesLoading) fetchCrashes(50);
      if (!hasFetchedUiErrors && !uiErrorsLoading) fetchUiErrors(50);
    } else if (activeTab === "api-monitoring" || activeTab === "requests") {
      if (!hasFetchedRequests && !requestsLoading) fetchRequests(100);
    } else if (activeTab === "crashes") {
      if (!hasFetchedCrashes && !crashesLoading) fetchCrashes(50);
    } else if (activeTab === "ui-errors") {
      if (!hasFetchedUiErrors && !uiErrorsLoading) fetchUiErrors(50);
    }
  }, [activeTab, projectId, hasFetchedRequests, hasFetchedCrashes, hasFetchedUiErrors, fetchRequests, fetchCrashes, fetchUiErrors, requestsLoading, crashesLoading, uiErrorsLoading]);

  useEffect(() => {
    const tab = searchParams?.get("tab");
    if (tab && tab !== activeTab) {
      setActiveTab(tab);
    }
  }, [searchParams, activeTab]);

  // Redirect to overview if active tab is disabled by admin panel
  useEffect(() => {
    if (!project) return;
    const isTabAllowed = filteredTabs.some((t) => t.id === activeTab);
    if (!isTabAllowed) {
      setActiveTab("overview");
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.set("tab", "overview");
        window.history.pushState({}, "", url.toString());
      }
    }
  }, [project, activeTab, filteredTabs]);

  // ─── REAL-TIME SSE CONNECTION ─────────────────────────────
  const handleRealtimeEvent = useCallback((event: any) => {
    switch (event.type) {
      case "api_request":
        setRequests((prev) => [event.data, ...prev]);
        setStats((prev: any) =>
          prev ? { ...prev, totalRequests: (parseInt(prev.totalRequests) || 0) + 1 } : prev
        );
        toast.success("New API request received", { duration: 2000 });
        break;

      case "crash_log":
        setCrashes((prev) => [event.data, ...prev]);
        setStats((prev: any) =>
          prev ? { ...prev, crashCount: (parseInt(prev.crashCount) || 0) + 1 } : prev
        );
        toast.error("New crash logged", { duration: 3000 });
        break;

      case "ui_error":
        setUiErrors((prev) => [event.data, ...prev]);
        toast.warning("New UI error detected", { duration: 2000 });
        break;
    }
  }, []);

  const { status: connectionStatus } = useRealtime({
    projectId,
    onEvent: handleRealtimeEvent,
  });

  const statusConfig = {
    connected: { color: "bg-green-500", pulse: "animate-pulse", label: "Live", textColor: "text-green-400" },
    connecting: { color: "bg-yellow-500", pulse: "animate-pulse", label: "Connecting...", textColor: "text-yellow-400" },
    disconnected: { color: "bg-red-500", pulse: "", label: "Offline", textColor: "text-red-400" },
  };

  const connStatus = statusConfig[connectionStatus];

  // ─── DATE FILTERING ──────────────────────────────────────
  const dateRange = useMemo(() => {
    if (datePreset === "custom") {
      return {
        from: customFrom ? new Date(customFrom + "T00:00:00") : null,
        to: customTo ? new Date(customTo + "T23:59:59") : null,
      };
    }
    return getPresetRange(datePreset);
  }, [datePreset, customFrom, customTo]);

  const filteredRequests = useMemo(() => filterByDateRange(requests, dateRange.from, dateRange.to), [requests, dateRange]);
  const filteredCrashes = useMemo(() => filterByDateRange(crashes, dateRange.from, dateRange.to), [crashes, dateRange]);
  const filteredUiErrors = useMemo(() => filterByDateRange(uiErrors, dateRange.from, dateRange.to), [uiErrors, dateRange]);

  // Compute filtered stats
  const filteredStats = useMemo(() => {
    if (!stats) return { totalRequests: "...", crashCount: "...", errorRate: "...", avgLatency: "..." };
    if (datePreset === "all") return stats;
    const errorRequests = filteredRequests.filter((r: any) => r.status >= 400).length;
    const errorRate = filteredRequests.length > 0 ? ((errorRequests / filteredRequests.length) * 100).toFixed(1) : "0.0";
    const avgDuration = filteredRequests.length > 0
      ? Math.round(filteredRequests.reduce((sum: number, r: any) => sum + (r.duration || 0), 0) / filteredRequests.length)
      : 0;
    return {
      ...stats,
      totalRequests: filteredRequests.length.toLocaleString(),
      crashCount: filteredCrashes.length.toString(),
      errorRate: `${errorRate}%`,
      avgLatency: `${avgDuration}ms`,
    };
  }, [stats, datePreset, filteredRequests, filteredCrashes]);

  return (
    <div className="space-y-6">
      {/* Back + Title */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <Link href="/dashboard/projects" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-3 transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back to Projects
          </Link>
          <h1 className="text-2xl font-bold text-foreground">Project Monitoring</h1>
          <p className="text-xs text-muted-foreground font-mono mt-1">{projectId}</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Live Connection Status */}
          <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium",
            connectionStatus === "connected"
              ? "bg-green-500/10 border-green-500/20"
              : connectionStatus === "connecting"
              ? "bg-yellow-500/10 border-yellow-500/20"
              : "bg-red-500/10 border-red-500/20"
          )}>
            <span className="relative flex h-2 w-2">
              {connectionStatus === "connected" && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              )}
              <span className={cn("relative inline-flex rounded-full h-2 w-2", connStatus.color)} />
            </span>
            <span className={connStatus.textColor}>{connStatus.label}</span>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95, rotate: 180 }}
            onClick={fetchAll}
            className="p-2 rounded-lg border border-border hover:border-brand/50 transition-colors"
            title="Refresh all data"
          >
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </motion.button>
        </div>
      </motion.div>

      {/* Date Range Filter */}
      <DateRangeFilter
        datePreset={datePreset}
        customFrom={customFrom}
        customTo={customTo}
        onPresetChange={setDatePreset}
        onCustomFromChange={setCustomFrom}
        onCustomToChange={setCustomTo}
      />

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Requests", value: filteredStats.totalRequests, color: "text-brand" },
          { label: "Crash Count", value: filteredStats.crashCount, color: "text-red-400" },
          { label: "Error Rate", value: filteredStats.errorRate, color: "text-orange-400" },
          { label: "Avg Latency", value: filteredStats.avgLatency, color: "text-green-400" },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="card-premium p-4">
            <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{statsLoading ? "..." : s.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 p-1 bg-muted/50 rounded-xl border border-border overflow-x-auto">
        {filteredTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              if (typeof window !== "undefined") {
                const url = new URL(window.location.href);
                url.searchParams.set("tab", tab.id);
                window.history.pushState({}, "", url.toString());
              }
            }}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap",
              activeTab === tab.id ? "bg-brand text-black" : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
          {activeTab === "overview" && (
            <OverviewTab
              requests={filteredRequests}
              crashes={filteredCrashes}
              uiErrors={filteredUiErrors}
              requestsLoading={requestsLoading}
              crashesLoading={crashesLoading}
              uiErrorsLoading={uiErrorsLoading}
            />
          )}
          {activeTab === "api-monitoring" && <APIMonitoringTab requests={filteredRequests} loading={requestsLoading} />}
          {activeTab === "requests" && <RequestsTab requests={filteredRequests} loading={requestsLoading} />}
          {activeTab === "crashes" && <CrashesTab crashes={filteredCrashes} loading={crashesLoading} />}
          {activeTab === "ui-errors" && <UIErrorsTab errors={filteredUiErrors} loading={uiErrorsLoading} />}
          {activeTab === "journeys" && <JourneysTab projectId={projectId} dateRange={dateRange} />}
          {activeTab === "screenshots" && <ScreenshotsTab projectId={projectId} dateRange={dateRange} />}
          {activeTab === "campaigns" && <CampaignsTab projectId={projectId} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export default function ProjectDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center p-10">
          <p className="text-muted-foreground animate-pulse">
            Loading project details...
          </p>
        </div>
      }
    >
      <ProjectDetailContent />
    </Suspense>
  );
}

/* ─── OVERVIEW TAB ─── */
function OverviewTab({
  requests,
  crashes,
  uiErrors,
  requestsLoading,
  crashesLoading,
  uiErrorsLoading,
}: any) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Recent API Calls */}
      <div className="card-premium overflow-hidden">
        <div className="p-4 border-b border-border"><h3 className="font-semibold text-foreground">Recent API Calls</h3></div>
        <div className="divide-y divide-border max-h-72 overflow-y-auto">
          {requestsLoading && (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <Loader2 className="h-5 w-5 text-brand animate-spin" />
              <span className="text-xs text-muted-foreground">Loading calls...</span>
            </div>
          )}
          {!requestsLoading && requests.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No requests yet</p>}
          {!requestsLoading && requests.slice(0, 8).map((r: any) => (
            <div key={r.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-2"><MethodBadge method={r.method} /><code className="text-xs text-muted-foreground font-mono truncate max-w-[160px]">{r.path}</code></div>
              <div className="flex items-center gap-2"><StatusCodeBadge status={r.status} /><span className="text-xs text-muted-foreground">{r.duration}ms</span></div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Crashes */}
      <div className="card-premium overflow-hidden">
        <div className="p-4 border-b border-border"><h3 className="font-semibold text-foreground">Recent Crashes</h3></div>
        <div className="divide-y divide-border max-h-72 overflow-y-auto">
          {crashesLoading && (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <Loader2 className="h-5 w-5 text-brand animate-spin" />
              <span className="text-xs text-muted-foreground">Loading crashes...</span>
            </div>
          )}
          {!crashesLoading && crashes.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No crashes — running clean! 🎉</p>}
          {!crashesLoading && crashes.slice(0, 8).map((c: any) => (
            <div key={c.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-2 min-w-0"><SeverityBadge severity={c.severity?.toLowerCase() || "error"} /><span className="text-sm truncate">{c.title}</span></div>
              <span className="text-xs text-muted-foreground flex-shrink-0">{getRelativeTime(c.timestamp)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent UI Errors */}
      <div className="card-premium overflow-hidden lg:col-span-2">
        <div className="p-4 border-b border-border"><h3 className="font-semibold text-foreground">Recent UI Errors</h3></div>
        <div className="divide-y divide-border max-h-72 overflow-y-auto">
          {uiErrorsLoading && (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <Loader2 className="h-5 w-5 text-brand animate-spin" />
              <span className="text-xs text-muted-foreground">Loading UI errors...</span>
            </div>
          )}
          {!uiErrorsLoading && uiErrors.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No UI errors yet</p>}
          {!uiErrorsLoading && uiErrors.slice(0, 8).map((e: any) => (
            <div key={e.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-2 min-w-0"><Monitor className="h-4 w-4 text-red-400 flex-shrink-0" /><span className="text-sm font-medium truncate">{e.component}</span><span className="text-xs text-muted-foreground truncate hidden md:inline">{e.message}</span></div>
              <span className="text-xs text-muted-foreground flex-shrink-0">{getRelativeTime(e.timestamp)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── API MONITORING TAB (with filters) ─── */
function APIMonitoringTab({ requests, loading }: any) {
  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = requests.filter((req: any) => {
    const matchSearch =
      req.path.toLowerCase().includes(search.toLowerCase()) ||
      (req.ip || "").includes(search);
    const matchMethod = methodFilter === "ALL" || req.method === methodFilter;
    const matchStatus =
      statusFilter === "ALL" ||
      (statusFilter === "2xx" && req.status >= 200 && req.status < 300) ||
      (statusFilter === "4xx" && req.status >= 400 && req.status < 500) ||
      (statusFilter === "5xx" && req.status >= 500);
    return matchSearch && matchMethod && matchStatus;
  });

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search path, IP..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 h-9 bg-card border border-border rounded-xl text-sm focus:outline-none focus:border-brand/50 transition-colors"
          />
        </div>
        {/* Method filter */}
        <div className="flex gap-1.5 p-1 bg-muted/50 rounded-xl border border-border">
          {["ALL", "GET", "POST", "PUT", "DELETE", "PATCH"].map((m) => (
            <button
              key={m}
              onClick={() => setMethodFilter(m)}
              className={cn(
                "px-3 py-1 rounded-lg text-xs font-medium transition-all",
                methodFilter === m
                  ? "bg-brand text-black shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              {m}
            </button>
          ))}
        </div>
        {/* Status filter */}
        <div className="flex gap-1.5 p-1 bg-muted/50 rounded-xl border border-border">
          {["ALL", "2xx", "4xx", "5xx"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "px-3 py-1 rounded-lg text-xs font-medium transition-all",
                statusFilter === s
                  ? "bg-brand text-black shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Requests Table */}
      <div className="card-premium overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {["Method", "Path", "Status", "Duration", "Size", "IP", "Time", ""].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={8} className="py-10 text-center">
                    <div className="flex flex-col items-center gap-2 justify-center">
                      <Loader2 className="h-6 w-6 text-brand animate-spin" />
                      <span className="text-xs text-muted-foreground">Loading requests...</span>
                    </div>
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                    No requests found
                  </td>
                </tr>
              )}
              {!loading && filtered.map((req: any, i: number) => (
                <Fragment key={req.id}>
                  <motion.tr
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.02 }}
                    onClick={() => setExpandedId(expandedId === req.id ? null : req.id)}
                    className="border-b border-border hover:bg-muted/30 transition-colors cursor-pointer group"
                  >
                    <td className="px-4 py-3"><MethodBadge method={req.method} /></td>
                    <td className="px-4 py-3"><code className="text-sm text-muted-foreground font-mono">{req.path}</code></td>
                    <td className="px-4 py-3"><StatusCodeBadge status={req.status} /></td>
                    <td className="px-4 py-3">
                      <span className={cn("text-sm font-mono", req.duration > 1000 ? "text-red-400" : req.duration > 500 ? "text-yellow-400" : "text-green-400")}>
                        {req.duration}ms
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{formatBytes(req.responseSize)}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground font-mono">{req.ip}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{getRelativeTime(req.timestamp)}</td>
                    <td className="px-4 py-3">
                      <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", expandedId === req.id && "rotate-90")} />
                    </td>
                  </motion.tr>

                  {/* Expanded Details */}
                  <AnimatePresence>
                    {expandedId === req.id && (
                      <motion.tr
                        key={`${req.id}-expanded`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      >
                        <td colSpan={8} className="px-4 py-4 bg-muted/20 border-b border-border">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Request Headers</p>
                              <div className="space-y-1">
                                {Object.entries((req.headers || {}) as Record<string, string>).map(([k, v]) => (
                                  <div key={k} className="flex gap-2 text-xs">
                                    <span className="text-brand font-mono">{k}:</span>
                                    <span className="text-muted-foreground font-mono truncate">{String(v).substring(0, 40)}</span>
                                  </div>
                                ))}
                                {Object.keys(req.headers || {}).length === 0 && <span className="text-xs text-muted-foreground">No headers</span>}
                              </div>
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Request Body</p>
                              <pre className="text-xs text-muted-foreground font-mono bg-muted/50 rounded-lg p-3 overflow-auto max-h-24">
                                {req.requestBody || "No body"}
                              </pre>
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Response Body</p>
                              <pre className="text-xs text-muted-foreground font-mono bg-muted/50 rounded-lg p-3 overflow-auto max-h-24">
                                {req.responseBody || "No body"}
                              </pre>
                            </div>
                          </div>
                        </td>
                      </motion.tr>
                    )}
                  </AnimatePresence>
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
          <span>Showing {filtered.length} of {requests.length} requests</span>
        </div>
      </div>
    </div>
  );
}

/* ─── REQUESTS TAB (simple table) ─── */
function RequestsTab({ requests, loading }: any) {
  return (
    <div className="card-premium overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Method</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Path</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Duration</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Req Size</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Res Size</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">IP</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Time</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={8} className="py-10 text-center">
                  <div className="flex flex-col items-center gap-2 justify-center">
                    <Loader2 className="h-6 w-6 text-brand animate-spin" />
                    <span className="text-xs text-muted-foreground">Loading requests...</span>
                  </div>
                </td>
              </tr>
            )}
            {!loading && requests.length === 0 && (
              <tr>
                <td colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                  No requests found
                </td>
              </tr>
            )}
            {!loading && requests.map((req: any, i: number) => (
              <motion.tr
                key={req.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.01 }}
                className="border-b border-border hover:bg-muted/30 transition-colors"
              >
                <td className="px-4 py-3"><MethodBadge method={req.method} /></td>
                <td className="px-4 py-3">
                  <code className="text-xs text-muted-foreground font-mono">{req.path}</code>
                </td>
                <td className="px-4 py-3"><StatusCodeBadge status={req.status} /></td>
                <td className="px-4 py-3">
                  <span className={cn(
                    "text-sm font-mono",
                    req.duration > 1000 ? "text-red-400" : req.duration > 500 ? "text-yellow-400" : "text-green-400"
                  )}>
                    {req.duration}ms
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{formatBytes(req.requestSize)}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{formatBytes(req.responseSize)}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{req.ip}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{getRelativeTime(req.timestamp)}</td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
        <span>Showing {requests.length} requests</span>
      </div>
    </div>
  );
}

/* ─── CRASHES TAB (with filters) ─── */
function CrashesTab({ crashes, loading }: any) {
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState("ALL");
  const [showResolved, setShowResolved] = useState(false);

  const filtered = crashes.filter((c: any) => {
    const matchSearch =
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      (c.platform || "").toLowerCase().includes(search.toLowerCase());
    const matchSeverity =
      severityFilter === "ALL" ||
      (c.severity || "").toUpperCase() === severityFilter;
    const matchResolved = showResolved ? true : !c.resolved;
    return matchSearch && matchSeverity && matchResolved;
  });

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search crashes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 h-9 bg-card border border-border rounded-xl text-sm focus:outline-none focus:border-brand/50 transition-colors"
          />
        </div>
        {/* Severity filter */}
        <div className="flex gap-1.5 p-1 bg-muted/50 rounded-xl border border-border">
          {["ALL", "CRITICAL", "ERROR", "WARNING"].map((s) => (
            <button
              key={s}
              onClick={() => setSeverityFilter(s)}
              className={cn(
                "px-3 py-1 rounded-lg text-xs font-medium transition-all",
                severityFilter === s
                  ? "bg-brand text-black shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              {s}
            </button>
          ))}
        </div>
        {/* Show Resolved toggle */}
        <button
          onClick={() => setShowResolved(!showResolved)}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all",
            showResolved
              ? "bg-green-500/10 text-green-400 border-green-500/20"
              : "bg-muted/50 text-muted-foreground border-border"
          )}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          Show Resolved
        </button>
      </div>

      {/* Crash Cards */}
      <div className="space-y-3">
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 card-premium">
            <Loader2 className="h-8 w-8 text-brand animate-spin" />
            <p className="text-sm text-muted-foreground">Loading crashes...</p>
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <p className="card-premium p-8 text-center text-muted-foreground">No crashes recorded 🎉</p>
        )}
        {!loading && filtered.map((crash: any, i: number) => (
          <motion.div
            key={crash.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="card-premium overflow-hidden"
          >
            {/* Main row */}
            <div
              className="flex items-center gap-4 p-4 cursor-pointer hover:bg-muted/20 transition-colors"
              onClick={() => setExpandedId(expandedId === crash.id ? null : crash.id)}
            >
              <div className="p-2 rounded-xl bg-muted/50">
                <Bug className={cn(
                  "h-4 w-4",
                  (crash.severity || "").toLowerCase() === "critical" ? "text-red-400" :
                  (crash.severity || "").toLowerCase() === "error" ? "text-orange-400" : "text-yellow-400"
                )} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h3 className="font-semibold text-sm text-foreground truncate">{crash.title}</h3>
                  <SeverityBadge severity={(crash.severity || "error").toLowerCase()} />
                  {crash.resolved && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                      Resolved
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                  <span className="capitalize">{crash.platform}</span>
                  <span>•</span>
                  <span>v{crash.version}</span>
                  <span>•</span>
                  <span>{crash.device}</span>
                  <span>•</span>
                  <span>{getRelativeTime(crash.timestamp)}</span>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="font-bold text-brand text-lg">{crash.count}</p>
                <p className="text-[10px] text-muted-foreground">occurrences</p>
              </div>
              <ChevronRight className={cn(
                "h-4 w-4 text-muted-foreground transition-transform flex-shrink-0",
                expandedId === crash.id && "rotate-90"
              )} />
            </div>

            {/* Expanded */}
            <AnimatePresence>
              {expandedId === crash.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden border-t border-border"
                >
                  <div className="p-4 space-y-4">
                    {/* Device Info */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { label: "Device", value: crash.device },
                        { label: "OS", value: `${crash.os} ${crash.osVersion}` },
                        { label: "Platform", value: crash.platform },
                        { label: "App Version", value: `v${crash.version}` },
                      ].map(({ label, value }) => (
                        <div key={label} className="bg-muted/30 rounded-xl p-3">
                          <p className="text-xs text-muted-foreground mb-1">{label}</p>
                          <p className="text-sm font-medium">{value}</p>
                        </div>
                      ))}
                    </div>

                    {/* Stack Trace + Steps */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Stack Trace</p>
                        <pre className="text-xs font-mono bg-muted/30 rounded-xl p-4 overflow-x-auto text-muted-foreground border border-border max-h-64">
                          {crash.stackTrace}
                        </pre>
                      </div>

                      {(crash.stepsToReproduce || crash.screenshotUrl) && (
                        <div className="space-y-4">
                          {crash.stepsToReproduce && (
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Steps to Reproduce (Breadcrumbs)</p>
                              <div className="bg-muted/30 rounded-xl p-4 border border-border max-h-64 overflow-y-auto space-y-2">
                                {(crash.stepsToReproduce as any[]).map((step: any, idx: number) => (
                                  <div key={idx} className="flex gap-2 text-xs text-muted-foreground">
                                    <span className="text-brand w-4">{idx + 1}.</span>
                                    <span>{step.action}</span>
                                    {step.data && <span className="text-muted-foreground/60">({JSON.stringify(step.data)})</span>}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {crash.screenshotUrl && (
                            <ScreenshotThumbnail url={crash.screenshotUrl} label="Crash Screenshot" />
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => toast.success("Marked as resolved")}
                        className="px-3 py-1.5 text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20 rounded-lg hover:bg-green-500/20 transition-colors"
                      >
                        Mark Resolved
                      </button>
                      <button
                        onClick={() => toast.info("Session replay coming soon")}
                        className="px-3 py-1.5 text-xs font-medium bg-brand/10 text-brand border border-brand/20 rounded-lg hover:bg-brand/20 transition-colors"
                      >
                        View Session Replay
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ─── UI ERRORS TAB (with filters) ─── */
const typeConfig: Record<string, { label: string; color: "error" | "warning" | "success" | "default" }> = {
  COMPONENT_CRASH: { label: "Component Crash", color: "error" },
  BUTTON_FAILURE: { label: "Button Failure", color: "warning" },
  RUNTIME_ERROR: { label: "Runtime Error", color: "error" },
  RENDER_ERROR: { label: "Render Error", color: "warning" },
};

function UIErrorsTab({ errors, loading }: any) {
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [showResolved, setShowResolved] = useState(false);

  const filtered = errors.filter((e: any) => {
    const matchSearch =
      e.component.toLowerCase().includes(search.toLowerCase()) ||
      e.message.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === "ALL" || e.type === typeFilter;
    const matchResolved = showResolved ? true : !e.resolved;
    return matchSearch && matchType && matchResolved;
  });

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Errors", value: errors.length, color: "text-red-400" },
          { label: "Component Crashes", value: errors.filter((e: any) => e.type === "COMPONENT_CRASH").length, color: "text-orange-400" },
          { label: "Render Errors", value: errors.filter((e: any) => e.type === "RENDER_ERROR").length, color: "text-yellow-400" },
          { label: "Resolved", value: errors.filter((e: any) => e.resolved).length, color: "text-green-400" },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="card-premium p-4"
          >
            <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search components..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 h-9 bg-card border border-border rounded-xl text-sm focus:outline-none focus:border-brand/50 transition-colors"
          />
        </div>
        {/* Type filter */}
        <div className="flex gap-1.5 p-1 bg-muted/50 rounded-xl border border-border">
          {["ALL", "RENDER_ERROR", "RUNTIME_ERROR", "COMPONENT_CRASH", "BUTTON_FAILURE"].map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={cn(
                "px-3 py-1 rounded-lg text-xs font-medium transition-all whitespace-nowrap",
                typeFilter === t
                  ? "bg-brand text-black shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              {t === "ALL" ? "ALL" : (typeConfig[t]?.label || t)}
            </button>
          ))}
        </div>
        {/* Show Resolved toggle */}
        <button
          onClick={() => setShowResolved(!showResolved)}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all",
            showResolved
              ? "bg-green-500/10 text-green-400 border-green-500/20"
              : "bg-muted/50 text-muted-foreground border-border"
          )}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          Show Resolved
        </button>
      </div>

      {/* Error List */}
      <div className="space-y-3">
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 card-premium">
            <Loader2 className="h-8 w-8 text-brand animate-spin" />
            <p className="text-sm text-muted-foreground">Loading UI errors...</p>
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <p className="card-premium p-8 text-center text-muted-foreground">No UI errors recorded</p>
        )}
        {!loading && filtered.map((err: any, i: number) => (
          <motion.div
            key={err.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="card-premium overflow-hidden"
          >
            <div
              className="flex items-center gap-4 p-4 cursor-pointer hover:bg-muted/20 transition-colors"
              onClick={() => setExpandedId(expandedId === err.id ? null : err.id)}
            >
              <div className="p-2 rounded-xl bg-red-500/10">
                <Monitor className="h-4 w-4 text-red-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-semibold text-sm text-foreground">{err.component}</span>
                  <Badge variant={typeConfig[err.type]?.color || "error"}>
                    {typeConfig[err.type]?.label || err.type}
                  </Badge>
                  {err.resolved && <Badge variant="success">Resolved</Badge>}
                </div>
                <p className="text-xs text-muted-foreground font-mono truncate">{err.message}</p>
                <div className="flex gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                  <span>{err.browser}</span>
                  <span>•</span>
                  <span>{err.os}</span>
                  <span>•</span>
                  <span>{getRelativeTime(err.timestamp)}</span>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="font-bold text-brand">{err.count}x</p>
                <p className="text-[10px] text-muted-foreground">occurrences</p>
              </div>
              <ChevronRight className={cn(
                "h-4 w-4 text-muted-foreground transition-transform flex-shrink-0",
                expandedId === err.id && "rotate-90"
              )} />
            </div>

            <AnimatePresence>
              {expandedId === err.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden border-t border-border"
                >
                  <div className="p-4 space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {[
                        { label: "URL", value: err.url },
                        { label: "Browser", value: err.browser },
                        { label: "OS", value: err.os },
                      ].map(({ label, value }) => (
                        <div key={label} className="bg-muted/30 rounded-xl p-3">
                          <p className="text-xs text-muted-foreground mb-1">{label}</p>
                          <p className="text-sm font-medium truncate">{value}</p>
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {err.stepsToReproduce && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Steps to Reproduce</p>
                          <div className="bg-muted/30 rounded-xl p-4 border border-border max-h-48 overflow-y-auto space-y-2">
                            {(err.stepsToReproduce as any[]).map((step: any, idx: number) => (
                              <div key={idx} className="flex gap-2 text-xs text-muted-foreground">
                                <span className="text-brand w-4">{idx + 1}.</span>
                                <span>{step.action}</span>
                                {step.data && <span className="text-muted-foreground/60">({JSON.stringify(step.data)})</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {err.screenshotUrl && (
                        <ScreenshotThumbnail url={err.screenshotUrl} label="UI Error Screenshot" />
                      )}
                    </div>

                    {/* Session Replay placeholder */}
                    <div className="border border-dashed border-border rounded-xl p-6 flex flex-col items-center justify-center gap-3 bg-muted/10">
                      <div className="p-3 rounded-xl bg-muted/50">
                        <Play className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <p className="text-sm font-medium text-muted-foreground">Session Replay</p>
                      <p className="text-xs text-muted-foreground text-center max-w-xs">
                        Watch exactly what the user experienced before this error occurred
                      </p>
                      <button
                        onClick={() => toast.info("Session replay coming in next release")}
                        className="px-4 py-2 text-xs font-medium bg-brand/10 text-brand border border-brand/20 rounded-lg hover:bg-brand/20 transition-colors"
                      >
                        Watch Replay (Beta)
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ─── USER JOURNEYS TAB ─── */
function PlatformIcon({ platform }: { platform: string }) {
  const p = platform?.toLowerCase();
  if (p === "android") return <Smartphone className="h-3.5 w-3.5 text-green-400" />;
  if (p === "ios") return <Smartphone className="h-3.5 w-3.5 text-blue-400" />;
  if (p === "web") return <Globe className="h-3.5 w-3.5 text-purple-400" />;
  return <Monitor className="h-3.5 w-3.5 text-muted-foreground" />;
}

function formatJourneyDuration(seconds: number | null): string {
  if (!seconds) return "—";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

function JourneysTab({
  projectId,
  dateRange,
}: {
  projectId: string;
  dateRange: { from: Date | null; to: Date | null };
}) {
  const router = useRouter();

  const [journeys, setJourneys] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [groupByUser, setGroupByUser] = useState(true);
  const [expandedUsers, setExpandedUsers] = useState<string[]>([]);

  // Event filter states
  const [selectedEventName, setSelectedEventName] = useState<string>("");
  const [eventNames, setEventNames] = useState<Array<{ name: string; type: string; count: number }>>([]);
  const [eventDropdownOpen, setEventDropdownOpen] = useState(false);
  const [eventSearch, setEventSearch] = useState("");
  const [eventTypeTab, setEventTypeTab] = useState<string>("all");

  const startDate = useMemo(() => {
    if (!dateRange.from) return "";
    const y = dateRange.from.getFullYear();
    const m = String(dateRange.from.getMonth() + 1).padStart(2, "0");
    const d = String(dateRange.from.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, [dateRange.from]);

  const endDate = useMemo(() => {
    if (!dateRange.to) return "";
    const y = dateRange.to.getFullYear();
    const m = String(dateRange.to.getMonth() + 1).padStart(2, "0");
    const d = String(dateRange.to.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, [dateRange.to]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [journeyData, statsData] = await Promise.all([
      getJourneys(
        projectId,
        startDate || undefined,
        endDate || undefined,
        search || undefined,
        page,
        20,
        groupByUser,
        selectedEventName || undefined
      ),
      getJourneyStats(
        projectId,
        startDate || undefined,
        endDate || undefined,
        selectedEventName || undefined
      ),
    ]);

    setJourneys(journeyData.journeys);
    setTotalPages(journeyData.totalPages);
    setTotal(journeyData.total);
    setStats(statsData);
    setLoading(false);
  }, [projectId, startDate, endDate, search, page, groupByUser, selectedEventName]);

  // Load project's event names on project selection/load
  useEffect(() => {
    setSelectedEventName("");
    async function loadEventNames() {
      const names = await getProjectEventNames(projectId);
      setEventNames(names);
    }
    loadEventNames();
  }, [projectId]);

  useEffect(() => {
    setExpandedUsers([]);
  }, [search, startDate, endDate, page, groupByUser, selectedEventName]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSearch = () => {
    setPage(1);
    fetchData();
  };

  const handleSelectEvent = (name: string) => {
    setPage(1);
    setSelectedEventName(name);
  };

  const filteredEventNames = useMemo(() => {
    return eventNames.filter((e) => {
      const matchesSearch = e.name.toLowerCase().includes(eventSearch.toLowerCase());
      
      if (eventTypeTab === "all") return matchesSearch;
      if (eventTypeTab === "custom") return e.type === "custom" && matchesSearch;
      if (eventTypeTab === "screen") return e.type === "screen_view" && matchesSearch;
      if (eventTypeTab === "api") return e.type === "api_call" && matchesSearch;
      
      const isOtherType = !["custom", "screen_view", "api_call"].includes(e.type);
      return isOtherType && matchesSearch;
    });
  }, [eventNames, eventSearch, eventTypeTab]);

  const handleViewJourney = (journeyId: string) => {
    router.push(`/dashboard/journeys/${journeyId}?projectId=${projectId}`);
  };

  const statItems = [
    {
      title: "Total Sessions",
      value: stats?.totalSessions?.toLocaleString() || "0",
      change: "",
      positive: true,
      icon: Footprints,
    },
    {
      title: "Unique Users",
      value: stats?.uniqueUsers?.toLocaleString() || "0",
      change: "",
      positive: true,
      icon: Users,
    },
    {
      title: "Active Now",
      value: stats?.activeSessions?.toLocaleString() || "0",
      change: "",
      positive: true,
      icon: Activity,
    },
    {
      title: "Avg Duration",
      value: formatJourneyDuration(stats?.avgDuration || 0),
      change: "",
      positive: true,
      icon: Clock,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">
            User Journeys
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Track and analyze how users navigate through your app
          </p>
        </div>
        <button
          onClick={() => setFiltersOpen(!filtersOpen)}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all border",
            filtersOpen
              ? "bg-brand/10 border-brand/30 text-brand"
              : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-brand/30"
          )}
        >
          <Filter className="h-4 w-4" />
          Filters
        </button>
      </div>

      {/* Filters Panel */}
      <AnimatePresence>
        {filtersOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ 
              opacity: 1, 
              height: "auto",
              transitionEnd: { overflow: "visible" }
            }}
            exit={{ opacity: 0, height: 0, overflow: "hidden" }}
            className="overflow-hidden"
          >
            <div className="card-premium p-5">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Search */}
                <div className="md:col-span-2">
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                    Search by name, email, mobile, or device
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                      placeholder="Search users..."
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all"
                    />
                  </div>
                </div>

                {/* Event Name Filter */}
                <div className="md:col-span-2 relative">
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                    Filter by Event Name (Custom, Screen, API)
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setEventDropdownOpen(!eventDropdownOpen)}
                      className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-background border border-border text-sm text-foreground hover:border-brand/30 transition-all focus:outline-none focus:border-brand/50 text-left"
                    >
                      <div className="flex items-center gap-2 truncate">
                        {selectedEventName ? (
                          <>
                            <span className="font-medium text-brand truncate">{selectedEventName}</span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-brand/10 border border-brand/25 text-brand font-mono capitalize">
                              {eventNames.find(e => e.name === selectedEventName)?.type.replace('_', ' ') || 'event'}
                            </span>
                          </>
                        ) : (
                          <span className="text-muted-foreground">Select an event to filter...</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {selectedEventName && (
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectEvent("");
                            }}
                            className="p-0.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <X className="h-3.5 w-3.5" />
                          </span>
                        )}
                        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform duration-200", eventDropdownOpen && "rotate-180")} />
                      </div>
                    </button>

                    {/* Popover Dropdown content */}
                    {eventDropdownOpen && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setEventDropdownOpen(false)}
                        />
                        <div className="absolute left-0 right-0 mt-2 p-3 rounded-2xl bg-card border border-border shadow-2xl z-50 flex flex-col gap-3 min-w-[280px] max-h-[360px] shadow-brand/5 border-border/80 backdrop-blur-md">
                          {/* Search event option */}
                          <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <input
                              type="text"
                              value={eventSearch}
                              onChange={(e) => setEventSearch(e.target.value)}
                              placeholder="Search events..."
                              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-background border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-brand/50 transition-all"
                            />
                          </div>

                          {/* Event type tabs */}
                          <div className="flex gap-1 border-b border-border pb-2 overflow-x-auto scrollbar-none">
                            {[
                              { id: "all", label: "All" },
                              { id: "custom", label: "Custom" },
                              { id: "screen", label: "Screens" },
                              { id: "api", label: "APIs" },
                              { id: "other", label: "Other" }
                            ].map((tab) => (
                              <button
                                key={tab.id}
                                type="button"
                                onClick={() => setEventTypeTab(tab.id)}
                                className={cn(
                                  "px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all whitespace-nowrap",
                                  eventTypeTab === tab.id
                                    ? "bg-brand/10 border border-brand/30 text-brand"
                                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                                )}
                              >
                                {tab.label}
                              </button>
                            ))}
                          </div>

                          {/* List of events */}
                          <div className="overflow-y-auto max-h-[200px] divide-y divide-border/30 pr-1 flex-1">
                            {filteredEventNames.length === 0 ? (
                              <div className="py-6 text-center text-xs text-muted-foreground">
                                No events found
                              </div>
                            ) : (
                              filteredEventNames.map((e) => (
                                <button
                                  key={`${e.name}-${e.type}`}
                                  type="button"
                                  onClick={() => {
                                    handleSelectEvent(e.name);
                                    setEventDropdownOpen(false);
                                  }}
                                  className={cn(
                                    "w-full flex items-center justify-between py-2 px-2 hover:bg-muted/40 rounded-lg text-left transition-colors text-xs",
                                    selectedEventName === e.name && "bg-brand/5"
                                  )}
                                >
                                  <div className="flex flex-col gap-0.5 truncate max-w-[70%]">
                                    <span className={cn("font-medium truncate", selectedEventName === e.name ? "text-brand" : "text-foreground")}>
                                      {e.name}
                                    </span>
                                    <span className="text-[9px] text-muted-foreground font-mono truncate">
                                      {e.type}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-muted-foreground">
                                      {e.count}x
                                    </span>
                                    {selectedEventName === e.name && (
                                      <Check className="h-3 w-3 text-brand" />
                                    )}
                                  </div>
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 mt-4">
                <button
                  onClick={handleSearch}
                  className="px-5 py-2 rounded-xl bg-brand text-black font-semibold text-sm hover:bg-brand/90 transition-all"
                >
                  Apply Filter
                </button>
                <button
                  onClick={() => {
                    setSearch("");
                    setSelectedEventName("");
                    setPage(1);
                  }}
                  className="px-5 py-2 rounded-xl border border-border text-muted-foreground text-sm hover:text-foreground hover:border-brand/30 transition-all"
                >
                  Clear
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statItems.map((stat, i) => (
          <StatCard
            key={stat.title}
            title={stat.title}
            value={loading ? "..." : stat.value}
            change={stat.change}
            positive={stat.positive}
            icon={stat.icon}
            delay={i * 0.05}
          />
        ))}
      </div>

      {/* Top Screens */}
      {stats?.topScreens?.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="card-premium p-5"
        >
          <h3 className="font-semibold text-foreground mb-3">
            Most Visited Screens
          </h3>
          <div className="flex flex-wrap gap-2">
            {stats.topScreens.map((screen: any) => (
              <div
                key={screen.name}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-brand/5 border border-brand/10 text-xs"
              >
                <Monitor className="h-3 w-3 text-brand" />
                <span className="text-foreground font-medium">
                  {screen.name}
                </span>
                <span className="text-muted-foreground">
                  {screen.count}x
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Journey List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="card-premium overflow-hidden"
      >
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h3 className="font-semibold text-foreground">
              User Sessions
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {groupByUser ? `${total} unique users` : `${total} total sessions`}
              {startDate && ` from ${startDate}`}
              {endDate && ` to ${endDate}`}
            </p>
          </div>
          <div className="flex items-center gap-1.5 bg-muted/30 p-1 rounded-lg border border-border">
            <button
              onClick={() => { setPage(1); setGroupByUser(true); }}
              className={cn(
                "px-3 py-1.5 text-xs font-semibold rounded-md transition-all",
                groupByUser
                  ? "bg-brand text-black shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Group by User
            </button>
            <button
              onClick={() => { setPage(1); setGroupByUser(false); }}
              className={cn(
                "px-3 py-1.5 text-xs font-semibold rounded-md transition-all",
                !groupByUser
                  ? "bg-brand text-black shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              All Sessions
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">
                  User
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground px-3 py-3">
                  Contact
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground px-3 py-3">
                  Platform
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground px-3 py-3">
                  Events
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground px-3 py-3">
                  Duration
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground px-3 py-3">
                  Started
                </th>
                <th className="text-right text-xs font-medium text-muted-foreground px-5 py-3">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-5 py-4">
                      <div className="h-4 bg-muted rounded w-32" />
                    </td>
                    <td className="px-3 py-4">
                      <div className="h-4 bg-muted rounded w-40" />
                    </td>
                    <td className="px-3 py-4">
                      <div className="h-4 bg-muted rounded w-16" />
                    </td>
                    <td className="px-3 py-4">
                      <div className="h-4 bg-muted rounded w-12" />
                    </td>
                    <td className="px-3 py-4">
                      <div className="h-4 bg-muted rounded w-16" />
                    </td>
                    <td className="px-3 py-4">
                      <div className="h-4 bg-muted rounded w-20" />
                    </td>
                    <td className="px-5 py-4">
                      <div className="h-4 bg-muted rounded w-16 ml-auto" />
                    </td>
                  </tr>
                ))}

              {!loading && journeys.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-12 text-center"
                  >
                    <Footprints className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">
                      No user journeys recorded yet.
                    </p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      Integrate journey tracking in your Flutter SDK
                      to start capturing user sessions.
                    </p>
                  </td>
                </tr>
              )}

              {!loading &&
                journeys.map((journey: any, idx: number) => {
                  const isExpanded = expandedUsers.includes(journey.id);
                  return (
                    <Fragment key={journey.id}>
                      <motion.tr
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.03 }}
                        onClick={() => {
                          if (groupByUser) {
                            setExpandedUsers((prev) =>
                              prev.includes(journey.id)
                                ? prev.filter((id) => id !== journey.id)
                                : [...prev, journey.id]
                            );
                          } else {
                            handleViewJourney(journey.id);
                          }
                        }}
                        className="hover:bg-muted/30 transition-colors cursor-pointer group border-b border-border/40"
                      >
                        {/* User */}
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            {groupByUser && (
                              <div className="text-muted-foreground/60 group-hover:text-foreground transition-colors">
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </div>
                            )}
                            <div className="h-8 w-8 rounded-lg bg-brand/10 border border-brand/20 flex items-center justify-center flex-shrink-0">
                              {journey.userName ? (
                                <span className="text-xs font-bold text-brand">
                                  {journey.userName
                                    .split(" ")
                                    .map((n: string) => n[0])
                                    .join("")
                                    .toUpperCase()
                                    .slice(0, 2)}
                                </span>
                              ) : (
                                <User className="h-3.5 w-3.5 text-brand" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium text-foreground truncate max-w-[160px]">
                                  {journey.userName || "Anonymous"}
                                </p>
                                {groupByUser && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-brand/10 border border-brand/20 text-brand font-bold">
                                    {journey.sessionCount} {journey.sessionCount === 1 ? 'session' : 'sessions'}
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-muted-foreground font-mono truncate max-w-[160px]">
                                {journey.deviceId?.slice(0, 16)}...
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Contact */}
                        <td className="px-3 py-3.5">
                          <div className="space-y-0.5">
                            {journey.userEmail && (
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Mail className="h-3 w-3" />
                                <span className="truncate max-w-[140px]">
                                  {journey.userEmail}
                                </span>
                              </div>
                            )}
                            {journey.userMobile && (
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Phone className="h-3 w-3" />
                                <span>{journey.userMobile}</span>
                              </div>
                            )}
                            {!journey.userEmail && !journey.userMobile && (
                              <span className="text-xs text-muted-foreground/50">
                                No contact info
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Platform */}
                        <td className="px-3 py-3.5">
                          <div className="flex items-center gap-1.5">
                            <PlatformIcon platform={journey.platform} />
                            <span className="text-xs text-muted-foreground capitalize">
                              {journey.platform}
                            </span>
                          </div>
                        </td>

                        {/* Events */}
                        <td className="px-3 py-3.5">
                          <span className="text-sm font-medium text-foreground">
                            {journey.eventCount}
                          </span>
                        </td>

                        {/* Duration */}
                        <td className="px-3 py-3.5">
                          <span className="text-xs text-muted-foreground">
                            {groupByUser ? "—" : formatJourneyDuration(journey.duration)}
                          </span>
                        </td>

                        {/* Started */}
                        <td className="px-3 py-3.5">
                          <div>
                            <p className="text-xs text-muted-foreground">
                              {getRelativeTime(journey.startedAt)}
                            </p>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center gap-2 justify-end">
                            {!journey.endedAt ? (
                              <span className="flex items-center gap-1.5 text-xs font-medium text-green-400">
                                <span className="relative flex h-2 w-2">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                                </span>
                                Active
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                Ended
                              </span>
                            )}
                            {!groupByUser && (
                              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-brand transition-colors" />
                            )}
                          </div>
                        </td>
                      </motion.tr>

                      {/* Expanded sessions list */}
                      {groupByUser && isExpanded && (
                        <tr>
                          <td colSpan={7} className="px-8 py-3 bg-muted/20 border-b border-border">
                            <div className="py-2.5 px-4 rounded-xl bg-background/50 border border-border/60 space-y-2 shadow-inner">
                              <div className="text-xs font-semibold text-muted-foreground mb-1.5">
                                Sessions for {journey.userName || 'Anonymous'} ({journey.sessions.length})
                              </div>
                              <div className="divide-y divide-border/40">
                                {journey.sessions.map((session: any) => (
                                  <div
                                    key={session.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleViewJourney(session.id);
                                    }}
                                    className="flex items-center justify-between py-2 hover:bg-muted/40 px-2 rounded-lg transition-colors cursor-pointer group/session"
                                  >
                                    <div className="flex items-center gap-4">
                                      <div className="text-xs font-mono text-muted-foreground">
                                        ID: {session.sessionId.slice(0, 8)}...
                                      </div>
                                      <div className="text-xs text-foreground">
                                        Started {getRelativeTime(session.startedAt)}
                                      </div>
                                      {session.duration && (
                                        <div className="text-xs text-muted-foreground">
                                          Duration: {formatJourneyDuration(session.duration)}
                                        </div>
                                      )}
                                      <div className="text-[10px] px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground uppercase tracking-wide">
                                        {session.appVersion}
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-4">
                                      <div className="text-xs text-muted-foreground font-medium">
                                        {session.eventCount} events
                                      </div>
                                      <div className="flex items-center gap-2">
                                        {!session.endedAt ? (
                                          <span className="flex items-center gap-1 text-[10px] font-medium text-green-400">
                                            <span className="relative flex h-1.5 w-1.5">
                                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                                              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
                                            </span>
                                            Active
                                          </span>
                                        ) : (
                                          <span className="text-[10px] text-muted-foreground">
                                            Ended
                                          </span>
                                        )}
                                        <ArrowRight className="h-3 w-3 text-muted-foreground/40 group-hover/session:text-brand transition-colors" />
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-border">
            <p className="text-xs text-muted-foreground">
              Page {page} of {totalPages} ({total} total)
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-lg border border-border hover:border-brand/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded-lg border border-border hover:border-brand/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

interface ScreenshotEvent {
  id: string;
  timestamp: string;
  name: string;
  screenshotUrl: string | null;
  message: string;
  journeyId: string;
  journey: {
    id: string;
    sessionId: string;
    deviceId: string;
    appUserId: string | null;
    userName: string | null;
    userEmail: string | null;
    userMobile: string | null;
    uniqueId: string | null;
    platform: string;
    appVersion: string;
  };
}

function ScreenshotsTab({
  projectId,
  dateRange,
}: {
  projectId: string;
  dateRange: { from: Date | null; to: Date | null };
}) {
  const [screenshots, setScreenshots] = useState<ScreenshotEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedScreenshot, setSelectedScreenshot] = useState<ScreenshotEvent | null>(null);

  useEffect(() => {
    async function loadScreenshots() {
      setLoading(true);
      try {
        const data = await getScreenshotEvents(
          projectId,
          dateRange.from?.toISOString(),
          dateRange.to?.toISOString()
        );
        setScreenshots(data as any);
      } catch (err) {
        console.error("Failed to load screenshots:", err);
      } finally {
        setLoading(false);
      }
    }
    loadScreenshots();
  }, [projectId, dateRange]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="h-8 w-8 text-brand animate-spin" />
        <p className="text-sm text-muted-foreground">Loading screenshot gallery...</p>
      </div>
    );
  }

  if (screenshots.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center py-24 px-4 text-center rounded-2xl border border-dashed border-border bg-muted/10"
      >
        <div className="p-4 rounded-full bg-brand/5 border border-brand/10 mb-4 text-brand">
          <Camera className="h-8 w-8" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-1">No Screenshots Detected</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          Screenshots captured programmatically by the Nirikshaka SDK will appear here in a unified gallery.
        </p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight font-sans">Screenshot Gallery</h2>
          <p className="text-sm text-muted-foreground">
            Browse screenshots automatically captured during user sessions
          </p>
        </div>
        <Badge variant="brand" className="border-brand/20 bg-brand/5 text-brand px-3 py-1 font-mono text-xs">
          {screenshots.length} {screenshots.length === 1 ? "screenshot" : "screenshots"}
        </Badge>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6"
      >
        {screenshots.map((s, idx) => {
          const userIdent = s.journey.uniqueId || s.journey.appUserId || s.journey.userName || s.journey.userMobile || s.journey.userEmail || "Anonymous User";
          return (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(idx * 0.05, 0.4) }}
              className="group flex flex-col rounded-xl overflow-hidden border border-border bg-card hover:border-brand/30 hover:shadow-lg hover:shadow-brand/5 hover:scale-[1.02] transition-all duration-300"
            >
              {/* Image Container */}
              <div 
                className="relative aspect-[9/16] bg-black/40 overflow-hidden cursor-pointer"
                onClick={() => setSelectedScreenshot(s)}
              >
                {s.screenshotUrl ? (
                  <img
                    src={s.screenshotUrl}
                    alt={s.name}
                    className="w-full h-full object-contain group-hover:scale-[1.05] transition-transform duration-500"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs font-mono">
                    No image URL
                  </div>
                )}
                {/* Hover Overlay */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-300">
                  <div className="p-3 rounded-full bg-brand text-black font-semibold text-xs shadow-lg flex items-center gap-1.5 transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                    <Camera className="h-4 w-4" />
                    <span>View Large</span>
                  </div>
                </div>
              </div>

              {/* Details Section */}
              <div className="p-4 flex flex-col flex-1 gap-2.5 border-t border-border bg-muted/10">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground truncate">{s.message || "System Screenshot"}</p>
                    <p className="text-sm font-semibold text-foreground truncate mt-0.5" title={s.name}>
                      {s.name}
                    </p>
                  </div>
                  <PlatformIcon platform={s.journey.platform} />
                </div>

                <hr className="border-border" />

                <div className="flex flex-col gap-1 text-xs">
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-muted-foreground">User:</span>
                    <span className="text-foreground font-medium truncate max-w-[140px]" title={userIdent}>
                      {userIdent}
                    </span>
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-muted-foreground">App Version:</span>
                    <span className="text-foreground font-mono">{s.journey.appVersion}</span>
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-muted-foreground">Captured:</span>
                    <span className="text-muted-foreground font-light">{getRelativeTime(s.timestamp)}</span>
                  </div>
                </div>

                <div className="mt-1 pt-1.5 border-t border-border/50">
                  <Link
                    href={`/dashboard/journeys/${s.journeyId}`}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted text-xs hover:bg-brand hover:text-black font-medium transition-colors"
                  >
                    <span>View Journey</span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Lightbox Modal */}
      <AnimatePresence>
        {selectedScreenshot && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm cursor-zoom-out"
            onClick={() => setSelectedScreenshot(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative max-w-full max-h-[85vh] aspect-[9/16] bg-black rounded-xl overflow-hidden shadow-2xl border border-neutral-800"
              onClick={(e) => e.stopPropagation()}
            >
              {selectedScreenshot.screenshotUrl && (
                <img
                  src={selectedScreenshot.screenshotUrl}
                  alt={selectedScreenshot.name}
                  className="w-full h-full object-contain"
                />
              )}
              {/* Modal Overlay Details */}
              <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black via-black/80 to-transparent text-white flex flex-col gap-1.5 border-t border-white/10">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-sm font-semibold">{selectedScreenshot.name}</h4>
                  <Badge variant="default" className="border-white/20 bg-white/5 text-white py-0.5 text-[10px]">
                    {selectedScreenshot.journey.platform.toUpperCase()}
                  </Badge>
                </div>
                <p className="text-xs text-neutral-400">
                  User: {selectedScreenshot.journey.uniqueId || selectedScreenshot.journey.appUserId || selectedScreenshot.journey.userName || "Anonymous"} ({selectedScreenshot.journey.deviceId})
                </p>
                <div className="flex justify-between items-center text-[10px] text-neutral-500 mt-1">
                  <span>Captured {getRelativeTime(selectedScreenshot.timestamp)}</span>
                  <Link
                    href={`/dashboard/journeys/${selectedScreenshot.journeyId}`}
                    className="text-brand hover:underline flex items-center gap-0.5"
                    onClick={() => setSelectedScreenshot(null)}
                  >
                    Open Session <ArrowRight className="h-2.5 w-2.5" />
                  </Link>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface CampaignEventStat {
  eventName: string;
  eventType: string;
  totalHits: number;
  uniqueCount: number;
  sampleUsers: Array<{
    id: string;
    name: string | null;
    email: string | null;
    mobile: string | null;
  }>;
}

interface TargetedUser {
  id: string;
  name: string;
  email: string | null;
  mobile: string | null;
  deviceId: string;
  platform: string;
}

function CampaignsTab({ projectId }: { projectId: string }) {
  const [stats, setStats] = useState<CampaignEventStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<CampaignEventStat | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [campaignTitle, setCampaignTitle] = useState("");
  const [campaignMessage, setCampaignMessage] = useState("");
  const [campaignImageUrl, setCampaignImageUrl] = useState("");
  const [campaignRedirectScreen, setCampaignRedirectScreen] = useState("");
  const [deliveryReceipt, setDeliveryReceipt] = useState<{
    success: boolean;
    targetedCount: number;
    users: TargetedUser[];
  } | null>(null);

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getCampaignEventStats(projectId);
      setStats(data as any);
    } catch (err) {
      console.error("Failed to load campaign stats:", err);
      toast.error("Failed to load campaign event statistics");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const customEventLabelMap: Record<string, string> = {
    el_login: "Customer Login",
    el_my_cart_view: "Cart View",
    charged: "Charged / Checked Out",
    click_be_a_vip: "Vip Subscription Interest",
    click_book_now: "Service Bookings Tap",
    el_ac_services: "AC Services View",
    el_cleaning_services: "Cleaning Services View",
    el_appliances_services: "Appliances Services View",
    el_plumbing_services: "Plumbing Services View",
    el_electrician_services: "Electrician Services View",
    el_painting_services: "Painting Services View",
  };

  const getReadableEventName = (name: string) => {
    if (customEventLabelMap[name]) return customEventLabelMap[name];
    if (name.startsWith("/")) {
      return `Screen: ${name}`;
    }
    return name
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const handleLaunchCampaign = (event: CampaignEventStat) => {
    setSelectedEvent(event);
    setCampaignTitle(`Special Offer for ${getReadableEventName(event.eventName)}`);
    setCampaignMessage(`Hello! We noticed you visited ${getReadableEventName(event.eventName)}. Here is a special discount for you!`);
    setCampaignImageUrl("");
    setCampaignRedirectScreen("");
    setComposeOpen(true);
  };

  const handleSendCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent) return;
    if (!campaignTitle.trim() || !campaignMessage.trim()) {
      toast.error("Please enter a title and message for the campaign");
      return;
    }

    setSending(true);
    try {
      const res = await sendCampaignNotification(
        projectId,
        selectedEvent.eventName,
        campaignTitle,
        campaignMessage,
        campaignImageUrl.trim() || undefined,
        campaignRedirectScreen.trim() || undefined
      );

      if (res.success) {
        toast.success(`Push Campaign Sent to ${res.targetedCount} users!`);
        setDeliveryReceipt(res as any);
        setComposeOpen(false);
        loadStats();
      } else {
        toast.error(res.error || "Failed to send notification campaign");
      }
    } catch (err) {
      console.error("Failed to launch push campaign:", err);
      toast.error("Failed to launch push campaign");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="h-8 w-8 text-brand animate-spin" />
        <p className="text-sm text-muted-foreground">Loading campaign insights...</p>
      </div>
    );
  }

  if (stats.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center py-24 px-4 text-center rounded-2xl border border-dashed border-border bg-muted/10"
      >
        <div className="p-4 rounded-full bg-brand/5 border border-brand/10 mb-4 text-brand">
          <Megaphone className="h-8 w-8" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-1">No Campaign Events Available</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          Once your app tracks custom events or screen views, they will appear here to let you target segments with push notifications.
        </p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight font-sans">Campaign Target Manager</h2>
          <p className="text-sm text-muted-foreground">
            Target groups of users who performed specific actions in your app
          </p>
        </div>
        <Badge variant="brand" className="border-brand/20 bg-brand/5 text-brand px-3 py-1 font-mono text-xs">
          {stats.length} target segments
        </Badge>
      </div>

      <div className="border border-border rounded-xl overflow-hidden bg-card/50 backdrop-blur-sm shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/20 text-muted-foreground font-medium text-xs uppercase tracking-wider">
                <th className="p-4">Event Segment</th>
                <th className="p-4">Tracking Type</th>
                <th className="p-4 text-right">Total Hits</th>
                <th className="p-4 text-right">Targetable Users</th>
                <th className="p-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {stats.map((s) => {
                const readableName = getReadableEventName(s.eventName);
                return (
                  <tr key={s.eventName} className="hover:bg-muted/10 transition-colors">
                    <td className="p-4 font-medium text-foreground">
                      <div className="flex flex-col">
                        <span>{readableName}</span>
                        <span className="text-xs text-muted-foreground font-mono mt-0.5">{s.eventName}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <Badge variant={s.eventType === "screen_view" ? "info" : "default"} className="text-xs">
                        {s.eventType === "screen_view" ? "Screen View" : "Custom Event"}
                      </Badge>
                    </td>
                    <td className="p-4 text-right font-mono font-medium text-foreground">
                      {s.totalHits.toLocaleString()}
                    </td>
                    <td className="p-4 text-right font-semibold text-brand font-mono">
                      {s.uniqueCount.toLocaleString()}
                    </td>
                    <td className="p-4 text-center">
                      <button
                        onClick={() => handleLaunchCampaign(s)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand hover:bg-brand/90 text-black font-semibold text-xs transition-colors shadow-md shadow-brand/10 hover:scale-105 transform active:scale-95 duration-150"
                      >
                        <Megaphone className="h-3.5 w-3.5" />
                        <span>Run Campaign</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Compose Campaign Modal */}
      <AnimatePresence>
        {composeOpen && selectedEvent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="w-full max-w-lg bg-background border border-border rounded-2xl overflow-hidden shadow-2xl flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-6 border-b border-border bg-muted/20 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <BellRing className="h-5 w-5 text-brand" />
                  <div>
                    <h3 className="font-bold text-lg text-foreground">Compose Push Campaign</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Targeting <span className="text-brand font-bold">{selectedEvent.uniqueCount}</span> unique users who completed <span className="font-semibold text-foreground">{getReadableEventName(selectedEvent.eventName)}</span>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setComposeOpen(false)}
                  className="p-1 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSendCampaign} className="p-6 space-y-4 flex-1">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Notification Title
                  </label>
                  <input
                    type="text"
                    required
                    value={campaignTitle}
                    onChange={(e) => setCampaignTitle(e.target.value)}
                    placeholder="Enter notification title..."
                    className="w-full px-3 py-2 bg-muted/30 border border-border/80 focus:border-brand focus:ring-1 focus:ring-brand rounded-lg text-sm text-foreground placeholder-muted-foreground outline-none transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Notification Body
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={campaignMessage}
                    onChange={(e) => setCampaignMessage(e.target.value)}
                    placeholder="Enter notification message details..."
                    className="w-full px-3 py-2 bg-muted/30 border border-border/80 focus:border-brand focus:ring-1 focus:ring-brand rounded-lg text-sm text-foreground placeholder-muted-foreground outline-none transition-all resize-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Notification Image URL (Optional)
                  </label>
                  <input
                    type="url"
                    value={campaignImageUrl}
                    onChange={(e) => setCampaignImageUrl(e.target.value)}
                    placeholder="https://example.com/image.jpg"
                    className="w-full px-3 py-2 bg-muted/30 border border-border/80 focus:border-brand focus:ring-1 focus:ring-brand rounded-lg text-sm text-foreground placeholder-muted-foreground outline-none transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Redirect Screen / Deep Link (Optional)
                  </label>
                  <input
                    type="text"
                    value={campaignRedirectScreen}
                    onChange={(e) => setCampaignRedirectScreen(e.target.value)}
                    placeholder="e.g. /bookings or com.eassylife.app://product/123"
                    className="w-full px-3 py-2 bg-muted/30 border border-border/80 focus:border-brand focus:ring-1 focus:ring-brand rounded-lg text-sm text-foreground placeholder-muted-foreground outline-none transition-all"
                  />
                </div>

                {/* Targeted User Samples */}
                <div className="bg-muted/10 border border-border/60 rounded-xl p-3.5 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Target Audience Sample
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      Showing up to 5 users
                    </span>
                  </div>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto">
                    {selectedEvent.sampleUsers.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">No user identities linked (will target anonymous device IDs)</p>
                    ) : (
                      selectedEvent.sampleUsers.map((u, i) => (
                        <div key={u.id || i} className="flex justify-between text-xs py-1 border-b border-border/30 last:border-0">
                          <span className="font-medium text-foreground">{u.name || "Anonymous User"}</span>
                          <span className="text-muted-foreground truncate max-w-[200px]">{u.email || u.mobile || u.id}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex justify-end gap-3 pt-3 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setComposeOpen(false)}
                    className="px-4 py-2 rounded-lg bg-muted hover:bg-muted/80 text-foreground font-medium text-sm transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={sending}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-brand hover:bg-brand/90 disabled:bg-brand/50 text-black font-bold text-sm transition-colors shadow-lg shadow-brand/10 min-w-[120px]"
                  >
                    {sending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Sending...</span>
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        <span>Launch Campaign</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delivery Receipt Modal */}
      <AnimatePresence>
        {deliveryReceipt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="w-full max-w-2xl bg-background border border-border rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-6 border-b border-border bg-emerald-950/20 flex justify-between items-center">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-500">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-foreground">Campaign Delivery Receipt</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Successfully dispatched notifications to <span className="text-emerald-500 font-bold">{deliveryReceipt.targetedCount}</span> users.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setDeliveryReceipt(null)}
                  className="p-1 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* Content */}
              <div className="p-6 space-y-4 flex-1 overflow-y-auto">
                <div className="grid grid-cols-2 gap-4 bg-muted/10 border border-border/60 rounded-xl p-4 text-sm">
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground uppercase font-semibold">Title</span>
                    <p className="font-medium text-foreground">{campaignTitle}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground uppercase font-semibold">Message</span>
                    <p className="text-muted-foreground">{campaignMessage}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Recipient Delivery Log (Simulated FCM Push)
                  </h4>
                  <div className="border border-border/80 rounded-xl overflow-hidden bg-card/30">
                    <div className="max-h-60 overflow-y-auto divide-y divide-border/60">
                      {deliveryReceipt.users.map((u) => (
                        <div key={u.id} className="p-3 flex items-center justify-between gap-3 hover:bg-muted/5 transition-colors">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">{u.name}</p>
                            <p className="text-xs text-muted-foreground font-mono truncate">
                              Device: {u.deviceId.substring(0, 12)}... | {u.email || u.mobile || "Anonymous"}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="default" className="font-mono text-[10px] uppercase">
                              {u.platform}
                            </Badge>
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-500">
                              <Check className="h-3 w-3" />
                              <span>Delivered</span>
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-border bg-muted/10 flex justify-end">
                <button
                  onClick={() => setDeliveryReceipt(null)}
                  className="px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-black font-bold text-sm transition-colors shadow-lg shadow-emerald-500/10"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
