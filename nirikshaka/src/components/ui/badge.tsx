"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "error" | "info" | "brand";
  size?: "sm" | "md";
  className?: string;
}

export function Badge({ children, variant = "default", size = "sm", className }: BadgeProps) {
  const variants = {
    default: "bg-muted text-muted-foreground border-border",
    success: "bg-green-500/10 text-green-400 border-green-500/20",
    warning: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    error: "bg-red-500/10 text-red-400 border-red-500/20",
    info: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    brand: "bg-brand/10 text-brand border-brand/20",
  };

  const sizes = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-2.5 py-1",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-medium rounded-full border",
        variants[variant],
        sizes[size],
        className
      )}
    >
      {children}
    </span>
  );
}

interface SeverityBadgeProps {
  severity: "critical" | "error" | "warning" | "info";
}

export function SeverityBadge({ severity }: SeverityBadgeProps) {
  const config = {
    critical: { label: "Critical", variant: "error" as const, dot: "bg-red-400" },
    error: { label: "Error", variant: "warning" as const, dot: "bg-orange-400" },
    warning: { label: "Warning", variant: "warning" as const, dot: "bg-yellow-400" },
    info: { label: "Info", variant: "info" as const, dot: "bg-blue-400" },
  };

  const { label, variant, dot } = config[severity];

  return (
    <Badge variant={variant}>
      <span className={cn("h-1.5 w-1.5 rounded-full", dot)} />
      {label}
    </Badge>
  );
}

interface StatusCodeBadgeProps {
  status: number;
}

export function StatusCodeBadge({ status }: StatusCodeBadgeProps) {
  let variant: BadgeProps["variant"] = "default";
  if (status >= 500) variant = "error";
  else if (status >= 400) variant = "warning";
  else if (status >= 200) variant = "success";

  return <Badge variant={variant}>{status}</Badge>;
}

interface MethodBadgeProps {
  method: string;
}

export function MethodBadge({ method }: MethodBadgeProps) {
  const variants: Record<string, BadgeProps["variant"]> = {
    GET: "success",
    POST: "brand",
    PUT: "info",
    PATCH: "warning",
    DELETE: "error",
  };

  return (
    <Badge variant={variants[method] || "default"} size="sm">
      {method}
    </Badge>
  );
}

export function LiveBadge() {
  return (
    <motion.div
      animate={{ opacity: [1, 0.5, 1] }}
      transition={{ duration: 1.5, repeat: Infinity }}
      className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-green-500/10 text-green-400 border border-green-500/20"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-green-400 shadow-[0_0_6px_#22c55e]" />
      LIVE
    </motion.div>
  );
}
