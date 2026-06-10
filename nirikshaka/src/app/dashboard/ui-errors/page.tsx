"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Monitor, Search, ChevronRight, Play } from "lucide-react";
import { getUiErrors } from "../actions";
import type { UIError } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { getRelativeTime, cn } from "@/lib/utils";
import { toast } from "sonner";
import { useRealtime } from "@/hooks/use-realtime";
import { ScreenshotThumbnail } from "@/components/ui/screenshot-viewer";

const typeConfig: Record<string, { label: string; color: "error" | "warning" | "success" | "default" }> = {
  COMPONENT_CRASH: { label: "Component Crash", color: "error" },
  BUTTON_FAILURE: { label: "Button Failure", color: "warning" },
  RUNTIME_ERROR: { label: "Runtime Error", color: "error" },
  RENDER_ERROR: { label: "Render Error", color: "warning" },
};

function UIErrorsContent() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId") || undefined;
  
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [errors, setErrors] = useState<UIError[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    getUiErrors(projectId).then(data => {
      setErrors(data as any);
      setIsLoading(false);
    });
  }, [projectId]);

  // Real-time updates
  const handleRealtimeEvent = useCallback((event: any) => {
    if (event.type === "ui_error") {
      setErrors((prev) => [event.data, ...prev]);
      toast.warning("New UI error detected", { duration: 2000 });
    }
  }, []);

  useRealtime({
    projectId,
    onEvent: handleRealtimeEvent,
    eventTypes: ["ui_error"],
  });

  const filtered = errors.filter(
    (e) =>
      e.component.toLowerCase().includes(search.toLowerCase()) ||
      e.message.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-foreground">UI Errors</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Component failures, rendering issues, and JS runtime errors
          </p>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Errors", value: errors.length, color: "text-red-400" },
          { label: "Component Crashes", value: errors.filter(e => e.type === "COMPONENT_CRASH").length, color: "text-orange-400" },
          { label: "Button Failures", value: errors.filter(e => e.type === "BUTTON_FAILURE").length, color: "text-yellow-400" },
          { label: "Resolved", value: errors.filter(e => e.resolved).length, color: "text-green-400" },
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

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search components..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 h-9 bg-card border border-border rounded-xl text-sm focus:outline-none focus:border-brand/50"
        />
      </div>

      {/* Error List */}
      <div className="space-y-3">
        {filtered.map((err, i) => (
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
                  {err.resolved && (
                    <Badge variant="success">Resolved</Badge>
                  )}
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

                    {/* Additional Context */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* Steps to Reproduce */}
                      {(err as any).stepsToReproduce && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Steps to Reproduce</p>
                          <div className="bg-muted/30 rounded-xl p-4 border border-border max-h-48 overflow-y-auto space-y-2">
                            {((err as any).stepsToReproduce as any[]).map((step: any, idx: number) => (
                              <div key={idx} className="flex gap-2 text-xs text-muted-foreground">
                                <span className="text-brand w-4">{idx + 1}.</span>
                                <span>{step.action}</span>
                                {step.data && <span className="text-muted-foreground/60">({JSON.stringify(step.data)})</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Screenshot */}
                      {(err as any).screenshotUrl && (
                        <ScreenshotThumbnail url={(err as any).screenshotUrl} label="UI Error Screenshot" />
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

export default function UIErrorsPage() {
  return (
    <Suspense fallback={<div className="flex justify-center p-10"><p className="text-muted-foreground animate-pulse">Loading...</p></div>}>
      <UIErrorsContent />
    </Suspense>
  );
}
