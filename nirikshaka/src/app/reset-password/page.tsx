"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Eye, EyeOff, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { updatePassword } from "@/app/auth/actions";

export default function ResetPasswordPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    try {
      const result = await updatePassword(formData);
      if (result?.error) {
        setError(result.error);
        toast.error(result.error);
        setLoading(false);
      } else {
        toast.success("Password reset successfully!");
      }
    } catch (err) {
      // NEXT_REDIRECT throws a redirect error on success, which handles transition to /dashboard
      setLoading(false);
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
            <img src="/logo.png" alt="Nirikshaka Logo" className="h-10 w-10 rounded-xl object-contain" />
            <span className="font-bold text-xl text-foreground">
              Nirikshaka
            </span>
          </Link>

          {/* Hero text */}
          <div className="space-y-6">
            <h1 className="text-4xl font-bold text-foreground leading-tight">
              Secure your account with a<br />
              <span className="text-gradient">new password.</span>
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed max-w-sm">
              Please enter your new credential. Once updated, you will be logged into your monitoring dashboard automatically.
            </p>
          </div>

          <p className="text-xs text-muted-foreground">
            © 2026 Nirikshaka. Built for developers.
          </p>
        </div>
      </div>

      {/* Right Panel — Reset Password Form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-card lg:bg-background">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          {/* Mobile logo */}
          <Link href="/" className="flex items-center gap-2.5 mb-8 lg:hidden">
            <img src="/logo.png" alt="Nirikshaka Logo" className="h-8 w-8 rounded-lg object-contain" />
            <span className="font-bold text-foreground">
              Nirikshaka
            </span>
          </Link>

          <div className="mb-8">
            <h2 className="text-3xl font-bold text-foreground">
              Set your password
            </h2>
            <p className="text-muted-foreground mt-2">
              Choose a password for your account
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                New Password
              </label>
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

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  name="confirmPassword"
                  required
                  className="w-full h-11 px-4 pr-11 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:border-brand/50 transition-all"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
                  Update Password
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </motion.button>
          </form>

          <p className="mt-8 text-sm text-center text-muted-foreground">
            Remembered your password?{" "}
            <Link href="/login" className="text-brand hover:underline font-semibold">
              Sign In
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
