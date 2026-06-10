"use client";

import React, { useCallback, useEffect, useState, Suspense, Fragment } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Footprints,
  Search,
  Calendar,
  Users,
  Clock,
  Monitor,
  ArrowRight,
  Filter,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Mail,
  Phone,
  User,
  Smartphone,
  Globe,
  Activity,
} from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import { getJourneys, getJourneyStats } from "./actions";
import { StatCard } from "@/components/ui/stat-card";
import { cn } from "@/lib/utils";

function formatDuration(seconds: number | null): string {
  if (!seconds) return "—";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function PlatformIcon({ platform }: { platform: string }) {
  const p = platform?.toLowerCase();
  if (p === "android") return <Smartphone className="h-3.5 w-3.5 text-green-400" />;
  if (p === "ios") return <Smartphone className="h-3.5 w-3.5 text-blue-400" />;
  if (p === "web") return <Globe className="h-3.5 w-3.5 text-purple-400" />;
  return <Monitor className="h-3.5 w-3.5 text-muted-foreground" />;
}

function JourneysContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const projectId = searchParams.get("projectId") || undefined;

  const [journeys, setJourneys] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [groupByUser, setGroupByUser] = useState(true);
  const [expandedUsers, setExpandedUsers] = useState<string[]>([]);

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
        groupByUser
      ),
      getJourneyStats(projectId),
    ]);

    setJourneys(journeyData.journeys);
    setTotalPages(journeyData.totalPages);
    setTotal(journeyData.total);
    setStats(statsData);
    setLoading(false);
  }, [projectId, startDate, endDate, search, page, groupByUser]);

  useEffect(() => {
    setExpandedUsers([]);
  }, [search, startDate, endDate, page, groupByUser]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSearch = () => {
    setPage(1);
    fetchData();
  };

  const handleViewJourney = (journeyId: string) => {
    const params = projectId ? `?projectId=${projectId}` : "";
    router.push(`/dashboard/journeys/${journeyId}${params}`);
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
      value: formatDuration(stats?.avgDuration || 0),
      change: "",
      positive: true,
      icon: Clock,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            User Journeys
          </h1>
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
      </motion.div>

      {/* Filters Panel */}
      <AnimatePresence>
        {filtersOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
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

                {/* Start Date */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                    From Date
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => {
                        setStartDate(e.target.value);
                        setPage(1);
                      }}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background border border-border text-sm text-foreground focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all [color-scheme:dark]"
                    />
                  </div>
                </div>

                {/* End Date */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                    To Date
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => {
                        setEndDate(e.target.value);
                        setPage(1);
                      }}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background border border-border text-sm text-foreground focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all [color-scheme:dark]"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 mt-4">
                <button
                  onClick={handleSearch}
                  className="px-5 py-2 rounded-xl bg-brand text-black font-semibold text-sm hover:bg-brand/90 transition-all"
                >
                  Apply Filters
                </button>
                <button
                  onClick={() => {
                    setSearch("");
                    setStartDate("");
                    setEndDate("");
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
                            {groupByUser ? "—" : formatDuration(journey.duration)}
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
                                          Duration: {formatDuration(session.duration)}
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

export default function JourneysPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center p-10">
          <p className="text-muted-foreground animate-pulse">
            Loading journeys...
          </p>
        </div>
      }
    >
      <JourneysContent />
    </Suspense>
  );
}
