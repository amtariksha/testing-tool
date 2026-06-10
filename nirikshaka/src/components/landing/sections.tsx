"use client";

import { motion } from "framer-motion";
import { Activity, Bug, Monitor, Code2, Zap, Shield, BarChart3, Bell } from "lucide-react";

const features = [
  {
    icon: Activity,
    title: "API Monitoring",
    description: "Track every request and response in real-time. View headers, payloads, status codes, and latency.",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
  },
  {
    icon: Bug,
    title: "Crash Analytics",
    description: "Automatic crash detection with full stack traces, device info, and session context.",
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
  },
  {
    icon: Monitor,
    title: "UI Error Tracking",
    description: "Capture component failures, button errors, and rendering issues with session replay.",
    color: "text-orange-400",
    bg: "bg-orange-500/10",
    border: "border-orange-500/20",
  },
  {
    icon: Code2,
    title: "Multi-Platform SDKs",
    description: "Integrate in minutes with our SDKs for React, Flutter, Android, iOS, and React Native.",
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/20",
  },
  {
    icon: BarChart3,
    title: "Performance Tracking",
    description: "Monitor p50, p95, p99 latencies and identify bottlenecks before users notice.",
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
    border: "border-cyan-500/20",
  },
  {
    icon: Bell,
    title: "Smart Alerts",
    description: "Get notified instantly via email, Slack, or webhooks when critical issues occur.",
    color: "text-green-400",
    bg: "bg-green-500/10",
    border: "border-green-500/20",
  },
  {
    icon: Shield,
    title: "Security Headers",
    description: "Inspect and validate request headers for security compliance and authentication issues.",
    color: "text-yellow-400",
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/20",
  },
  {
    icon: Zap,
    title: "Real-time Stream",
    description: "Watch logs flow in real-time with live filtering, search, and instant error highlighting.",
    color: "text-brand",
    bg: "bg-brand/10",
    border: "border-brand/20",
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="py-24 relative">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,163,0,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,163,0,0.03)_1px,transparent_1px)] bg-[size:40px_40px] -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="inline-block px-4 py-1.5 rounded-full border border-brand/30 bg-brand/10 text-brand text-sm font-medium mb-4">
            Everything you need
          </span>
          <h2 className="text-4xl sm:text-5xl font-black text-foreground mb-4">
            One platform.<br />
            <span className="text-gradient">Complete visibility.</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Stop context-switching between Sentry, Datadog, and Firebase. Nirikshaka brings all your monitoring into one clean, startup-friendly dashboard.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.07 }}
              whileHover={{ y: -4 }}
              className="card-premium p-5 group"
            >
              <div className={`w-10 h-10 rounded-xl ${feature.bg} border ${feature.border} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                <feature.icon className={`h-5 w-5 ${feature.color}`} />
              </div>
              <h3 className="font-semibold text-foreground mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

const testimonials = [
  {
    quote: "Nirikshaka replaced Sentry + Datadog for us. We cut our monitoring costs by 70% and the UI is 10x better.",
    name: "Sarah Mitchell",
    role: "CTO at Launchpad",
    avatar: "SM",
  },
  {
    quote: "Integration took 20 minutes. Now our whole team has visibility into crashes and API issues we never noticed before.",
    name: "James Chen",
    role: "Lead Engineer, TechFlow",
    avatar: "JC",
  },
  {
    quote: "The Flutter SDK works flawlessly. Best monitoring tool we've found for mobile apps.",
    name: "Priya Sharma",
    role: "Mobile Lead, Fintrack",
    avatar: "PS",
  },
];

export function TestimonialsSection() {
  return (
    <section className="py-24 bg-muted/20 border-y border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl font-black text-foreground mb-4">
            Loved by developers
          </h2>
          <p className="text-muted-foreground">Join 2,000+ teams shipping with confidence</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="card-premium p-6"
            >
              <div className="flex gap-1 mb-4">
                {Array.from({ length: 5 }).map((_, j) => (
                  <span key={j} className="text-brand text-sm">★</span>
                ))}
              </div>
              <p className="text-muted-foreground italic mb-5 leading-relaxed">&ldquo;{t.quote}&rdquo;</p>
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-brand/10 border border-brand/20 text-brand font-bold text-sm flex items-center justify-center">
                  {t.avatar}
                </div>
                <div>
                  <p className="font-semibold text-sm">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.role}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

const plans = [
  {
    name: "Starter",
    price: "₹0",
    desc: "For hobbyists & testing",
    features: ["1 project workspace", "10,000 monthly events limit", "7-day logs retention", "Basic crash & UI logs"],
    cta: "Start Free",
    highlighted: false,
  },
  {
    name: "Growth",
    price: "₹0",
    desc: "For growing apps & teams",
    features: ["10 projects workspace", "100,000 monthly events limit", "30-day logs retention", "All platforms supported", "Real-time webhook integration", "Email alert notifications"],
    cta: "Upgrade Free Instantly",
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "₹0",
    desc: "For production services",
    features: ["Unlimited projects workspace", "1,000,000 monthly events limit", "90-day logs retention", "Automatic User Journey Replays", "Remote screenshot callbacks", "Priority support & high SLA"],
    cta: "Unlock Enterprise Free",
    highlighted: false,
  },
];

export function PricingSection() {
  return (
    <section id="pricing" className="py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl font-black text-foreground mb-4">Simple pricing</h2>
          <p className="text-muted-foreground">No surprises. Scale as you grow.</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className={`card-premium p-6 relative ${plan.highlighted ? "border-brand/40 brand-glow-sm" : ""}`}
            >
              {plan.highlighted && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="px-4 py-1 text-xs font-bold bg-brand text-black rounded-full">Most Popular</span>
                </div>
              )}
              <div className="mb-4">
                <h3 className="font-bold text-foreground">{plan.name}</h3>
                <p className="text-xs text-muted-foreground">{plan.desc}</p>
              </div>
              <div className="mb-6">
                <span className="text-4xl font-black">{plan.price}</span>
                <span className="text-muted-foreground text-xs ml-1">/ forever (Free)</span>
              </div>
              <ul className="space-y-2 mb-6">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <span className="text-brand">✓</span>
                    <span className="text-muted-foreground">{f}</span>
                  </li>
                ))}
              </ul>
              <a
                href="/register"
                className={`block w-full py-2.5 rounded-xl text-sm font-semibold text-center transition-all ${
                  plan.highlighted
                    ? "brand-gradient text-black hover:opacity-90"
                    : "border border-border hover:border-brand/40 hover:text-brand"
                }`}
              >
                {plan.cta}
              </a>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function CTASection() {
  return (
    <section className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-brand/10 rounded-full blur-[100px]" />
      </div>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-5xl font-black text-foreground mb-6">
            Ready to ship with<br />
            <span className="text-gradient">confidence?</span>
          </h2>
          <p className="text-xl text-muted-foreground mb-10 max-w-xl mx-auto">
            Start monitoring your application in 5 minutes. Free forever, no credit card required.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="/register"
              className="flex items-center gap-2 px-8 py-4 rounded-2xl brand-gradient text-black font-bold text-lg brand-glow hover:opacity-90 transition-all"
            >
              Start Monitoring Free
            </a>
            <a
              href="/dashboard"
              className="flex items-center gap-2 px-8 py-4 rounded-2xl border border-border bg-card font-semibold hover:border-brand/40 transition-all"
            >
              View Live Dashboard
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

export function LandingFooter() {
  return (
    <footer className="border-t border-border py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="Nirikshaka Logo" className="h-7 w-7 object-contain" />
            <span className="font-bold text-foreground">
              Nirikshaka
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            © 2026 Nirikshaka. Built for developers, by developers.
          </p>
          <div className="flex gap-4 text-sm text-muted-foreground">
            <a href="/privacy" className="hover:text-foreground transition-colors">Privacy</a>
            <a href="/terms" className="hover:text-foreground transition-colors">Terms</a>
            <a href="#" className="hover:text-foreground transition-colors">Docs</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
