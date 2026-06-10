"use client";

import { motion } from "framer-motion";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getApiRequests } from "../actions";
import type { APIRequest } from "@prisma/client";
import { MethodBadge, StatusCodeBadge } from "@/components/ui/badge";
import { getRelativeTime, formatBytes } from "@/lib/utils";
import { cn } from "@/lib/utils";

function RequestsContent() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId") || undefined;
  
  const [requests, setRequests] = useState<APIRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    getApiRequests(projectId).then((data) => {
      setRequests(data as any);
      setIsLoading(false);
    });
  }, [projectId]);

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-2xl font-bold text-foreground">Requests</h1>
        <p className="text-sm text-muted-foreground mt-0.5">All API request & response logs</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
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
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Req Size</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Res Size</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">IP</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Time</th>
              </tr>
            </thead>
            <tbody>
              {!isLoading && requests.map((req, i) => (
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
      </motion.div>
    </div>
  );
}

export default function RequestsPage() {
  return (
    <Suspense fallback={<div className="flex justify-center p-10"><p className="text-muted-foreground animate-pulse">Loading...</p></div>}>
      <RequestsContent />
    </Suspense>
  );
}
