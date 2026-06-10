"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, Play, Activity, Bug, Zap, Shield } from "lucide-react";
import { requestsChartData } from "@/lib/mock-data";
import { AreaChart, Area, ResponsiveContainer, Tooltip } from "recharts";

const MotionLink = motion(Link);

export function HeroSection() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-start overflow-hidden pt-36 pb-16 sm:pt-40 sm:pb-24">
      {/* Background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-brand/8 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-brand/5 rounded-full blur-[80px]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,163,0,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,163,0,0.04)_1px,transparent_1px)] bg-[size:40px_40px]" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center w-full">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-brand/30 bg-brand/10 text-brand text-sm font-medium mb-8"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-brand animate-pulse" />
          Now in Beta — Free for early adopters
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-5xl sm:text-6xl lg:text-7xl font-black text-foreground leading-[1.05] tracking-tight mb-6"
        >
          Monitor your app.
          <br />
          <span className="text-gradient">Fix bugs faster.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-10"
        >
          Real-time API logs, crash analytics, UI error tracking and SDK monitoring —
          all in one beautiful dashboard. The modern alternative to Sentry, Datadog and Firebase.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
        >
          <MotionLink
            href="/register"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="flex items-center gap-2 px-7 py-3.5 rounded-2xl brand-gradient text-black font-bold text-base brand-glow hover:opacity-90 transition-all"
          >
            Start Monitoring Free
            <ArrowRight className="h-5 w-5" />
          </MotionLink>
          <MotionLink
            href="/dashboard"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="flex items-center gap-2 px-7 py-3.5 rounded-2xl border border-border bg-card hover:border-brand/40 text-foreground font-semibold text-base transition-all"
          >
            <Play className="h-4 w-4 text-brand" />
            View Live Demo
          </MotionLink>
        </motion.div>

        {/* Dashboard preview */}
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          className="relative max-w-5xl mx-auto"
        >
          <div className="gradient-border rounded-3xl overflow-hidden shadow-premium">
            <div className="bg-card p-4 sm:p-6">
              {/* Mini topbar */}
              <div className="flex items-center gap-2 mb-5 pb-4 border-b border-border">
                <div className="flex gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-red-500/60" />
                  <div className="h-3 w-3 rounded-full bg-yellow-500/60" />
                  <div className="h-3 w-3 rounded-full bg-green-500/60" />
                </div>
                <div className="flex-1 mx-4 h-6 bg-muted/50 rounded-lg flex items-center px-3">
                  <span className="text-xs text-muted-foreground">app.nirikshaka.com/dashboard</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-green-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-400 shadow-[0_0_6px_#22c55e] animate-pulse" />
                  LIVE
                </div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                {[
                  { label: "Total Requests", value: "2.4M", icon: Activity, change: "+12%" },
                  { label: "Active APIs", value: "47", icon: Zap, change: "+3" },
                  { label: "Error Rate", value: "0.8%", icon: Shield, change: "-0.2%" },
                  { label: "Crashes", value: "284", icon: Bug, change: "+18" },
                ].map((s, i) => (
                  <motion.div
                    key={s.label}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.7 + i * 0.1 }}
                    className="bg-muted/40 rounded-2xl p-3.5 border border-border"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <s.icon className="h-4 w-4 text-brand" />
                      <span className="text-xs text-green-400">{s.change}</span>
                    </div>
                    <p className="text-xl font-bold text-foreground">{s.value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                  </motion.div>
                ))}
              </div>

              {/* Chart preview */}
              <div className="bg-muted/20 rounded-2xl p-4 border border-border">
                <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">API Traffic — Last 24h</p>
                {mounted ? (
                  <ResponsiveContainer width="100%" height={120}>
                    <AreaChart data={requestsChartData.slice(-16)}>
                      <defs>
                        <linearGradient id="heroGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#FFA300" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#FFA300" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Tooltip
                        contentStyle={{
                          background: "hsl(222 47% 6%)",
                          border: "1px solid hsl(217.2 32.6% 14%)",
                          borderRadius: "12px",
                          fontSize: "11px",
                        }}
                      />
                      <Area type="monotone" dataKey="requests" stroke="#FFA300" strokeWidth={2} fill="url(#heroGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[120px] w-full bg-muted/5 rounded-lg flex items-center justify-center">
                    <span className="text-xs text-muted-foreground">Loading chart...</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Floating badges */}
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -left-6 top-1/3 glass-dark rounded-2xl p-3 border border-white/10 hidden sm:block"
          >
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-red-400 shadow-[0_0_6px_#f87171]" />
              <span className="text-xs font-medium">Critical crash detected</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">NullPointerException · Android</p>
          </motion.div>

          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            className="absolute -right-6 top-1/2 glass-dark rounded-2xl p-3 border border-white/10 hidden sm:block"
          >
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-400 shadow-[0_0_6px_#22c55e]" />
              <span className="text-xs font-medium">SDK initialized</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Flutter · v3.19.0</p>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
