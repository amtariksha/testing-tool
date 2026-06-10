"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Zap, Eye, EyeOff, ArrowRight, GitBranch, Globe, Check } from "lucide-react";
import { toast } from "sonner";
import { signUp } from "@/app/auth/actions";

const features = [
  "Real-time API monitoring",
  "Crash & error analytics",
  "Multi-platform SDK support",
  "Team collaboration tools",
  "14-day free trial",
];

export default function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);

    try {
      const result = await signUp(formData);
      if (result?.error) {
        setError(result.error);
        toast.error(result.error);
        setLoading(false);
      } else {
        toast.success("Account created! Redirecting to dashboard...");
      }
    } catch (err) {
      // NEXT_REDIRECT throws on success
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-background overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-1/3 left-1/3 w-80 h-80 bg-brand/10 rounded-full blur-3xl animate-pulse-slow" />
          <div className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-brand/5 rounded-full blur-2xl animate-float" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,163,0,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,163,0,0.03)_1px,transparent_1px)] bg-[size:40px_40px]" />
        </div>

        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <Link href="/" className="flex items-center gap-3 w-fit">
            <img src="/logo.png" alt="Nirikshaka Logo" className="h-10 w-10 rounded-xl object-contain" />
            <span className="font-bold text-xl text-foreground">
              Nirikshaka
            </span>
          </Link>

          <div className="space-y-8">
            <div>
              <h1 className="text-4xl font-bold text-foreground leading-tight mb-4">
                Start monitoring<br />
                <span className="text-gradient">in 5 minutes.</span>
              </h1>
              <p className="text-lg text-muted-foreground leading-relaxed max-w-sm">
                Join developers who ship with confidence using Nirikshaka.
              </p>
            </div>

            <div className="space-y-3">
              {features.map((feature, i) => (
                <motion.div
                  key={feature}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.1 }}
                  className="flex items-center gap-3"
                >
                  <div className="h-5 w-5 rounded-full bg-brand/20 border border-brand/30 flex items-center justify-center flex-shrink-0">
                    <Check className="h-3 w-3 text-brand" />
                  </div>
                  <span className="text-sm text-muted-foreground">{feature}</span>
                </motion.div>
              ))}
            </div>

            {/* Social proof */}
            <div className="glass rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-2">
                {["KP", "SM", "JC", "PS", "MW"].map((av, i) => (
                  <div
                    key={av}
                    style={{ marginLeft: i > 0 ? "-8px" : "0" }}
                    className="h-8 w-8 rounded-full bg-brand/20 border-2 border-background text-brand text-xs font-bold flex items-center justify-center"
                  >
                    {av}
                  </div>
                ))}
                <span className="text-sm text-muted-foreground ml-2">+1,995 others</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Trusted by developers at startups and scale-ups worldwide.
              </p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">© 2026 Nirikshaka. No credit card required.</p>
        </div>
      </div>

      {/* Right Panel — Register Form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-card lg:bg-background">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <Link href="/" className="flex items-center gap-2.5 mb-8 lg:hidden">
            <img src="/logo.png" alt="Nirikshaka Logo" className="h-8 w-8 rounded-lg object-contain" />
            <span className="font-bold text-foreground">
              Nirikshaka
            </span>
          </Link>

          <div className="mb-8">
            <h2 className="text-3xl font-bold text-foreground">Create account</h2>
            <p className="text-muted-foreground mt-2">Free forever. No credit card required.</p>
          </div>

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
              <span className="bg-card lg:bg-background px-3">or sign up with email</span>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">First name</label>
                <input
                  type="text"
                  name="firstName"
                  required
                  className="w-full h-11 px-4 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:border-brand/50 transition-all"
                  placeholder="Alex"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Last name</label>
                <input
                  type="text"
                  name="lastName"
                  required
                  className="w-full h-11 px-4 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:border-brand/50 transition-all"
                  placeholder="Doe"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Work email</label>
              <input
                type="email"
                name="email"
                required
                className="w-full h-11 px-4 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:border-brand/50 transition-all"
                placeholder="you@company.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  required
                  className="w-full h-11 px-4 pr-11 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:border-brand/50 transition-all"
                  placeholder="Min. 8 characters"
                  minLength={8}
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

            <p className="text-xs text-muted-foreground">
              By signing up, you agree to our{" "}
              <Link href="#" className="text-brand hover:underline">Terms of Service</Link>
              {" "}and{" "}
              <Link href="#" className="text-brand hover:underline">Privacy Policy</Link>.
            </p>

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
                  Create account
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </motion.button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Already have an account?{" "}
            <Link href="/login" className="text-brand font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
