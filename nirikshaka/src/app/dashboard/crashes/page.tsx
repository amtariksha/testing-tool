"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Bug, CheckCircle2, ChevronDown, ChevronRight, Search } from "lucide-react";
import { getCrashLogs } from "../actions";
import type { CrashLog } from "@prisma/client";
import { SeverityBadge } from "@/components/ui/badge";
import { getRelativeTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import { toast } from "sonner";
import { useRealtime } from "@/hooks/use-realtime";
import { ScreenshotThumbnail } from "@/components/ui/screenshot-viewer";

function CrashesContent() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId") || undefined;
  
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState("ALL");
  const [showResolved, setShowResolved] = useState(false);
  const [crashes, setCrashes] = useState<CrashLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    getCrashLogs(projectId).then((data) => {
      setCrashes(data as any);
      setIsLoading(false);
    });
  }, [projectId]);

  // Real-time updates
  const handleRealtimeEvent = useCallback((event: any) => {
    if (event.type === "crash_log") {
      setCrashes((prev) => [event.data, ...prev]);
      toast.error("New crash detected!", { duration: 3000 });
    }
  }, []);

  useRealtime({
    projectId,
    onEvent: handleRealtimeEvent,
    eventTypes: ["crash_log"],
  });

  const filtered = crashes.filter((c) => {
    const matchSearch = c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.platform.toLowerCase().includes(search.toLowerCase());
    const matchSeverity = severityFilter === "ALL" || c.severity === severityFilter.toLowerCase();
    const matchResolved = showResolved ? true : !c.resolved;
    return matchSearch && matchSeverity && matchResolved;
  });

  const customTooltipStyle = {
    background: "hsl(222 47% 6%)",
    border: "1px solid hsl(217.2 32.6% 14%)",
    borderRadius: "12px",
    color: "hsl(210 40% 98%)",
    fontSize: "12px",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-foreground">Crash Logs</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {filtered.length} active crashes across all projects
          </p>
        </div>
      </motion.div>

      {/* Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="card-premium p-5"
      >
        <h3 className="font-semibold text-foreground mb-4">Crash Timeline (7 days)</h3>
        <ResponsiveContainer width="100%" height={150}>
          <AreaChart data={[]}>
            <defs>
              <linearGradient id="crashGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#FFA300" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#FFA300" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(215 20.2% 55%)" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "hsl(215 20.2% 55%)" }} axisLine={false} tickLine={false} width={25} />
            <Tooltip contentStyle={customTooltipStyle} />
            <Area type="monotone" dataKey="crashes" stroke="#FFA300" strokeWidth={2} fill="url(#crashGrad)" />
            <Area type="monotone" dataKey="resolved" stroke="#22c55e" strokeWidth={2} fill="none" strokeDasharray="4 2" />
          </AreaChart>
        </ResponsiveContainer>
      </motion.div>

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
        <div className="flex gap-1.5 p-1 bg-muted/50 rounded-xl border border-border">
          {["ALL", "CRITICAL", "ERROR", "WARNING"].map((s) => (
            <button
              key={s}
              onClick={() => setSeverityFilter(s)}
              className={cn(
                "px-3 py-1 rounded-lg text-xs font-medium transition-all",
                severityFilter === s ? "bg-brand text-black" : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              {s}
            </button>
          ))}
        </div>
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
        {filtered.map((crash, i) => (
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
                  crash.severity.toLowerCase() === "critical" ? "text-red-400" :
                  crash.severity.toLowerCase() === "error" ? "text-orange-400" : "text-yellow-400"
                )} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h3 className="font-semibold text-sm text-foreground truncate">{crash.title}</h3>
                  <SeverityBadge severity={crash.severity.toLowerCase() as any} />
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

                    {/* Stack Trace */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Stack Trace</p>
                        <pre className="text-xs font-mono bg-muted/30 rounded-xl p-4 overflow-x-auto text-muted-foreground border border-border max-h-64">
                          {crash.stackTrace}
                        </pre>
                      </div>

                      {/* Steps to Reproduce */}
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

export default function CrashLogsPage() {
  return (
    <Suspense fallback={<div className="flex justify-center p-10"><p className="text-muted-foreground animate-pulse">Loading...</p></div>}>
      <CrashesContent />
    </Suspense>
  );
}
