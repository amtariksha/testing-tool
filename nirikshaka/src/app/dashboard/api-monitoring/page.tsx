"use client";

import React, { useState, useEffect, Fragment, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Filter, ChevronDown, ChevronRight, RefreshCw } from "lucide-react";
import { getApiRequests } from "../actions";
import type { APIRequest } from "@prisma/client";
import { MethodBadge, StatusCodeBadge, LiveBadge } from "@/components/ui/badge";
import { formatDuration, formatBytes, getRelativeTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { useRealtime } from "@/hooks/use-realtime";
import { toast } from "sonner";

export default function APIMonitoringPage() {
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [methodFilter, setMethodFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [requests, setRequests] = useState<APIRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getApiRequests().then(data => {
      setRequests(data as any);
      setIsLoading(false);
    });
  }, []);

  // Real-time updates
  const handleRealtimeEvent = useCallback((event: any) => {
    if (event.type === "api_request") {
      setRequests((prev) => [event.data, ...prev]);
      toast.success("New request received", { duration: 2000 });
    }
  }, []);

  const { status: connectionStatus } = useRealtime({
    onEvent: handleRealtimeEvent,
    eventTypes: ["api_request"],
  });
  const connColor = connectionStatus === "connected" ? "bg-green-500" : connectionStatus === "connecting" ? "bg-yellow-500" : "bg-red-500";

  const filtered = requests.filter((req) => {
    const matchSearch =
      req.path.toLowerCase().includes(search.toLowerCase()) ||
      req.ip.includes(search);
    const matchMethod = methodFilter === "ALL" || req.method === methodFilter;
    const matchStatus =
      statusFilter === "ALL" ||
      (statusFilter === "2xx" && req.status >= 200 && req.status < 300) ||
      (statusFilter === "4xx" && req.status >= 400 && req.status < 500) ||
      (statusFilter === "5xx" && req.status >= 500);
    return matchSearch && matchMethod && matchStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-foreground">API Monitoring</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Real-time request & response logs</p>
        </div>
        <div className="flex items-center gap-2">
          <LiveBadge />
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95, rotate: 180 }}
            className="p-2 rounded-lg border border-border hover:border-brand/50 transition-colors"
          >
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </motion.button>
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="flex flex-wrap gap-3"
      >
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
      </motion.div>

      {/* Requests Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="card-premium overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Method</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Path</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Duration</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Size</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">IP</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Time</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((req, i) => (
                <Fragment key={req.id}>
                  <motion.tr
                    key={req.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.02 }}
                    onClick={() => setExpandedId(expandedId === req.id ? null : req.id)}
                    className="border-b border-border hover:bg-muted/30 transition-colors cursor-pointer group"
                  >
                    <td className="px-4 py-3">
                      <MethodBadge method={req.method} />
                    </td>
                    <td className="px-4 py-3">
                      <code className="text-sm text-muted-foreground font-mono">{req.path}</code>
                    </td>
                    <td className="px-4 py-3">
                      <StatusCodeBadge status={req.status} />
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        "text-sm font-mono",
                        req.duration > 1000 ? "text-red-400" : req.duration > 500 ? "text-yellow-400" : "text-green-400"
                      )}>
                        {req.duration}ms
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {formatBytes(req.responseSize)}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground font-mono">{req.ip}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{getRelativeTime(req.timestamp)}</td>
                    <td className="px-4 py-3">
                      <ChevronRight
                        className={cn(
                          "h-4 w-4 text-muted-foreground transition-transform",
                          expandedId === req.id && "rotate-90"
                        )}
                      />
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
                            {/* Headers */}
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Request Headers</p>
                              <div className="space-y-1">
                                {Object.entries((req.headers || {}) as Record<string, string>).map(([k, v]) => (
                                  <div key={k} className="flex gap-2 text-xs">
                                    <span className="text-brand font-mono">{k}:</span>
                                    <span className="text-muted-foreground font-mono truncate">{v.substring(0, 40)}...</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                            {/* Request Body */}
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Request Body</p>
                              <pre className="text-xs text-muted-foreground font-mono bg-muted/50 rounded-lg p-3 overflow-auto max-h-24">
                                {req.requestBody || "No body"}
                              </pre>
                            </div>
                            {/* Response Body */}
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
          <span className="text-brand">Real-time • Updates every 5s</span>
        </div>
      </motion.div>
    </div>
  );
}
