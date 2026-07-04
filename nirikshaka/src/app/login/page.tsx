"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Zap, Eye, EyeOff, ArrowRight, GitBranch, Globe } from "lucide-react";
import { toast } from "sonner";
import { signIn } from "@/app/auth/actions";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Password reset states
  const [showResetForm, setShowResetForm] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);

    try {
      const result = await signIn(formData);
      if (result?.error) {
        setError(result.error);
        toast.error(result.error);
        setLoading(false);
      }
      // If no error, the server action redirects to /dashboard
    } catch (err) {
      // NEXT_REDIRECT throws, which is expected on successful login
      // If it's a genuine error, show it
      setLoading(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setResetLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      });
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Recovery link sent to your email!");
        setShowResetForm(false);
        setResetEmail("");
      }
    } catch (err) {
      toast.error("Failed to send recovery link.");
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel — Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-background overflow-hidden">
        {/* Animated background */}
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand/10 rounded-full blur-3xl animate-pulse-slow" />
          <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-brand/5 rounded-full blur-2xl animate-float" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,163,0,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,163,0,0.03)_1px,transparent_1px)] bg-[size:40px_40px]" />
        </div>

        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group w-fit">
            <div className="h-10 w-10 rounded-2xl brand-gradient flex items-center justify-center brand-glow-sm">
              <Zap className="h-5 w-5 text-black" fill="black" />
            </div>
            <span className="font-bold text-xl text-foreground">
              Nirikshaka
            </span>
          </Link>

          {/* Hero text */}
          <div className="space-y-8">
            <div>
              <h1 className="text-4xl font-bold text-foreground leading-tight mb-4">
                Monitor everything.<br />
                <span className="text-gradient">Fix it fast.</span>
              </h1>
              <p className="text-lg text-muted-foreground leading-relaxed max-w-sm">
                Real-time API monitoring, crash analytics, and SDK tracking — all in one beautiful dashboard.
              </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { value: "Real-time", label: "API monitoring" },
                { value: "99.97%", label: "Uptime" },
                { value: "<200ms", label: "Avg latency" },
              ].map((stat) => (
                <div key={stat.label} className="glass rounded-2xl p-4">
                  <p className="text-2xl font-bold text-brand">{stat.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Testimonial */}
            <div className="glass rounded-2xl p-5">
              <p className="text-sm text-muted-foreground italic mb-3">
                &ldquo;Nirikshaka replaced 3 tools for us. Our MTTR dropped by 60% in the first week.&rdquo;
              </p>
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-brand/20 text-brand font-bold text-xs flex items-center justify-center">
                  AM
                </div>
                <div>
                  <p className="text-sm font-medium">Alex Morgan</p>
                  <p className="text-xs text-muted-foreground">CTO, Launchpad Inc.</p>
                </div>
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            © 2026 Nirikshaka. Built for developers.
          </p>
        </div>
      </div>

      {/* Right Panel — Login Form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-card lg:bg-background">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          {/* Mobile logo */}
          <Link href="/" className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="h-8 w-8 rounded-xl brand-gradient flex items-center justify-center">
              <Zap className="h-4 w-4 text-black" fill="black" />
            </div>
            <span className="font-bold text-foreground">
              Nirikshaka
            </span>
          </Link>

          <div className="mb-8">
            <h2 className="text-3xl font-bold text-foreground">Welcome back</h2>
            <p className="text-muted-foreground mt-2">
              Sign in to your dashboard
            </p>
          </div>

          {/* OAuth buttons */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => toast.info("OAuth coming soon")}
              className="flex items-center justify-center gap-2 h-11 rounded-xl border border-border bg-muted/50 hover:bg-muted hover:border-brand/30 transition-all text-sm font-medium"
            >
              <GitBranch className="h-4 w-4" />
              GitHub
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => toast.info("OAuth coming soon")}
              className="flex items-center justify-center gap-2 h-11 rounded-xl border border-border bg-muted/50 hover:bg-muted hover:border-brand/30 transition-all text-sm font-medium"
            >
              <Globe className="h-4 w-4" />
              Google
            </motion.button>
          </div>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs text-muted-foreground">
              <span className="bg-card lg:bg-background px-3">or continue with email</span>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Email address
              </label>
              <input
                type="email"
                name="email"
                required
                className="w-full h-11 px-4 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:border-brand/50 focus:bg-muted/80 transition-all"
                placeholder="you@company.com"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-foreground">Password</label>
                <button type="button" className="text-xs text-brand hover:underline">
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  required
                  className="w-full h-11 px-4 pr-11 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:border-brand/50 transition-all"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <motion.button
              type="submit"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              disabled={loading}
              className="w-full h-11 brand-gradient text-black font-semibold rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-all brand-glow-sm disabled:opacity-70"
            >
              {loading ? (
                <div className="h-4 w-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              ) : (
                <>
                  Sign in
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </motion.button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="text-brand font-medium hover:underline">
              Sign up free
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
