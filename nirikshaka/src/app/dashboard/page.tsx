"use client";

import React, { useCallback } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  Zap,
  Bug,
  Monitor,
  Users,
  Clock,
  Shield,
  TrendingUp,
} from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import { LiveBadge } from "@/components/ui/badge";
import { getApiRequests, getCrashLogs, getDashboardStats } from "./actions";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { getRelativeTime } from "@/lib/utils";
import { MethodBadge, StatusCodeBadge, SeverityBadge } from "@/components/ui/badge";
import { useRealtime } from "@/hooks/use-realtime";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const defaultStats = {
  totalRequests: "0",
  activeAPIs: "0",
  errorRate: "0.0%",
  crashCount: "0",
  sdkInstalls: "0",
  avgLatency: "0ms",
  uptime: "99.9%",
  activeUsers: "0",
  sdkDistribution: {
    WEB: 0,
    ANDROID: 0,
    IOS: 0,
    FLUTTER: 0,
    REACT_NATIVE: 0,
  } as Record<string, number>,
};

const customTooltipStyle = {
  background: "hsl(222 47% 6%)",
  border: "1px solid hsl(217.2 32.6% 14%)",
  borderRadius: "12px",
  color: "hsl(210 40% 98%)",
  fontSize: "12px",
};

function DashboardContent() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId") || undefined;
  
  const [stats, setStats] = React.useState(defaultStats);
  const [recentRequests, setRecentRequests] = React.useState<any[]>([]);
  const [recentCrashes, setRecentCrashes] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  const sdkActivityData = React.useMemo(() => {
    const dist = stats.sdkDistribution || defaultStats.sdkDistribution;
    const total = Object.values(dist).reduce((acc: number, val: number) => acc + val, 0);

    const data = [
      { name: "Web SDK", value: dist.WEB || 0, color: "#FFA300" },
      { name: "Android SDK", value: dist.ANDROID || 0, color: "#22c55e" },
      { name: "iOS SDK", value: dist.IOS || 0, color: "#3b82f6" },
      { name: "Flutter SDK", value: dist.FLUTTER || 0, color: "#ef4444" },
      { name: "React Native SDK", value: dist.REACT_NATIVE || 0, color: "#6366f1" },
    ];

    if (total === 0) {
      return [];
    }

    return data.map(item => ({
      ...item,
      percentage: Math.round((item.value / total) * 100),
    }));
  }, [stats]);

  React.useEffect(() => {
    setLoading(true);
    Promise.all([
      getDashboardStats(projectId), 
      getApiRequests(projectId), 
      getCrashLogs(projectId)
    ]).then(
      ([dbStats, requests, crashes]) => {
        if (dbStats) setStats(dbStats);
        setRecentRequests(requests.slice(0, 8));
        setRecentCrashes(crashes.slice(0, 5));
        setLoading(false);
      }
    );
  }, [projectId]);

  // ─── REAL-TIME ─────────────────────────────────────────────
  const handleRealtimeEvent = useCallback((event: any) => {
    switch (event.type) {
      case "api_request":
        setRecentRequests((prev) => [event.data, ...prev].slice(0, 8));
        setStats((prev) => ({
          ...prev,
          totalRequests: ((parseInt(prev.totalRequests.replace(/,/g, "")) || 0) + 1).toLocaleString(),
        }));
        break;
      case "crash_log":
        setRecentCrashes((prev) => [event.data, ...prev].slice(0, 5));
        setStats((prev) => ({
          ...prev,
          crashCount: ((parseInt(prev.crashCount) || 0) + 1).toString(),
        }));
        toast.error("New crash detected!", { duration: 3000 });
        break;
      case "ui_error":
        toast.warning("New UI error detected", { duration: 2000 });
        break;
    }
  }, []);

  const { status: connectionStatus } = useRealtime({
    projectId,
    onEvent: handleRealtimeEvent,
  });

  const connColor = connectionStatus === "connected" ? "bg-green-500" : connectionStatus === "connecting" ? "bg-yellow-500" : "bg-red-500";

  const statItems = [
    { title: "Total Requests", value: stats.totalRequests, change: "", positive: true, icon: Activity },
    { title: "Active APIs", value: stats.activeAPIs, change: "", positive: true, icon: Zap },
    { title: "Error Rate", value: stats.errorRate, change: "", positive: true, icon: Shield },
    { title: "Crash Count", value: stats.crashCount, change: "", positive: true, icon: Bug },
    { title: "SDK Installs", value: stats.sdkInstalls, change: "", positive: true, icon: Monitor },
    { title: "Avg Latency", value: stats.avgLatency, change: "", positive: true, icon: Clock },
    { title: "Uptime", value: stats.uptime, change: "", positive: true, icon: TrendingUp },
    { title: "Active Projects", value: stats.activeUsers, change: "", positive: true, icon: Users },
  ];

  // Build chart data from recent requests
  const requestsChartData = React.useMemo(() => {
    if (recentRequests.length === 0) {
      return [{ time: "Now", requests: 0, errors: 0 }];
    }
    const hourMap: Record<string, { requests: number; errors: number }> = {};
    recentRequests.forEach((req) => {
      const hour = new Date(req.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      if (!hourMap[hour]) hourMap[hour] = { requests: 0, errors: 0 };
      hourMap[hour].requests++;
      if (req.status >= 400) hourMap[hour].errors++;
    });
    return Object.entries(hourMap).map(([time, data]) => ({ time, ...data }));
  }, [recentRequests]);

  // Build crash chart data
  const crashChartData = React.useMemo(() => {
    if (recentCrashes.length === 0) {
      return [{ date: "Today", crashes: 0, resolved: 0 }];
    }
    const dayMap: Record<string, { crashes: number; resolved: number }> = {};
    recentCrashes.forEach((crash) => {
      const day = new Date(crash.timestamp).toLocaleDateString([], { weekday: "short" });
      if (!dayMap[day]) dayMap[day] = { crashes: 0, resolved: 0 };
      dayMap[day].crashes++;
      if (crash.resolved) dayMap[day].resolved++;
    });
    return Object.entries(dayMap).map(([date, data]) => ({ date, ...data }));
  }, [recentCrashes]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-foreground">Overview</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Monitor your application health in real-time
          </p>
        </div>
        <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium",
            connectionStatus === "connected" ? "bg-green-500/10 border-green-500/20" :
            connectionStatus === "connecting" ? "bg-yellow-500/10 border-yellow-500/20" :
            "bg-red-500/10 border-red-500/20"
          )}>
            <span className="relative flex h-2 w-2">
              {connectionStatus === "connected" && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              )}
              <span className={cn("relative inline-flex rounded-full h-2 w-2", connColor)} />
            </span>
            <span className={connectionStatus === "connected" ? "text-green-400" : connectionStatus === "connecting" ? "text-yellow-400" : "text-red-400"}>
              {connectionStatus === "connected" ? "Live" : connectionStatus === "connecting" ? "Connecting..." : "Offline"}
            </span>
          </div>
      </motion.div>

      {/* Stat Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-3">
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

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Requests Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-2 card-premium p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-foreground">API Traffic</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Requests & errors over 24h</p>
            </div>

          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={requestsChartData}>
              <defs>
                <linearGradient id="requestsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#FFA300" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#FFA300" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="errorsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 10, fill: "hsl(215 20.2% 55%)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "hsl(215 20.2% 55%)" }}
                axisLine={false}
                tickLine={false}
                width={35}
              />
              <Tooltip contentStyle={customTooltipStyle} />
              <Area
                type="monotone"
                dataKey="requests"
                stroke="#FFA300"
                strokeWidth={2}
                fill="url(#requestsGrad)"
              />
              <Area
                type="monotone"
                dataKey="errors"
                stroke="#ef4444"
                strokeWidth={2}
                fill="url(#errorsGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* SDK Activity Pie */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="card-premium p-5"
        >
          <div className="mb-4">
            <h3 className="font-semibold text-foreground">SDK Activity</h3>
            <p className="text-xs text-muted-foreground mt-0.5">By platform</p>
          </div>
          {sdkActivityData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[180px] text-zinc-500 text-xs">
              <span className="font-bold text-zinc-400">No Active SDKs</span>
              <span className="text-[10px] text-zinc-650 mt-1">Integrate our SDKs to track installations</span>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                  <Pie
                    data={sdkActivityData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={65}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {sdkActivityData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={customTooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-2">
                {sdkActivityData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 rounded-full flex-shrink-0"
                        style={{ background: item.color }}
                      />
                      <span className="text-muted-foreground">{item.name}</span>
                    </div>
                    <span className="font-medium">{item.percentage}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </motion.div>
      </div>

      {/* Crash Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="card-premium p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-foreground">Crash Analytics</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Weekly crash & resolution trend</p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={crashChartData} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: "hsl(215 20.2% 55%)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "hsl(215 20.2% 55%)" }}
              axisLine={false}
              tickLine={false}
              width={30}
            />
            <Tooltip contentStyle={customTooltipStyle} />
            <Bar dataKey="crashes" fill="#FFA300" radius={[4, 4, 0, 0]} />
            <Bar dataKey="resolved" fill="#22c55e" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Recent Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent API Calls */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="card-premium overflow-hidden"
        >
          <div className="flex items-center justify-between p-5 border-b border-border">
            <div>
              <h3 className="font-semibold text-foreground">Recent API Calls</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Last 8 requests</p>
            </div>
          </div>
          <div className="divide-y divide-border">
            {recentRequests.length === 0 && !loading && (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                No API requests recorded yet. Integrate the SDK to start tracking.
              </div>
            )}
            {recentRequests.map((req: any) => (
              <div
                key={req.id}
                className="flex items-center justify-between px-5 py-3 hover:bg-muted/30 transition-colors group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <MethodBadge method={req.method} />
                  <span className="text-sm text-muted-foreground truncate font-mono text-xs">
                    {req.path}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <StatusCodeBadge status={req.status} />
                  <span className="text-xs text-muted-foreground">{req.duration}ms</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Recent Crashes */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="card-premium overflow-hidden"
        >
          <div className="flex items-center justify-between p-5 border-b border-border">
            <div>
              <h3 className="font-semibold text-foreground">Recent Crashes</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Top 5 crashes</p>
            </div>
          </div>
          <div className="divide-y divide-border">
            {recentCrashes.length === 0 && !loading && (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                No crashes recorded yet. Your app is running clean! 🎉
              </div>
            )}
            {recentCrashes.map((crash: any) => (
              <div
                key={crash.id}
                className="flex items-center justify-between px-5 py-3 hover:bg-muted/30 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <SeverityBadge severity={crash.severity?.toLowerCase() as any || "error"} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{crash.title}</p>
                    <p className="text-xs text-muted-foreground">{crash.platform}</p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0 ml-2">
                  <p className="text-xs font-medium text-brand">{crash.count}x</p>
                  <p className="text-[10px] text-muted-foreground">{getRelativeTime(crash.timestamp)}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="flex justify-center p-10"><p className="text-muted-foreground animate-pulse">Loading dashboard...</p></div>}>
      <DashboardContent />
    </Suspense>
  );
}
