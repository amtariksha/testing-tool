"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string;
  change: string;
  positive: boolean;
  icon: LucideIcon;
  description?: string;
  className?: string;
  delay?: number;
}

export function StatCard({
  title,
  value,
  change,
  positive,
  icon: Icon,
  description,
  className,
  delay = 0,
}: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className={cn(
        "card-premium p-5 group cursor-default",
        className
      )}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="p-2.5 rounded-xl bg-brand/10 border border-brand/20 group-hover:bg-brand/15 transition-colors">
          <Icon className="h-5 w-5 text-brand" />
        </div>
        <div
          className={cn(
            "flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full border",
            positive
              ? "bg-green-500/10 text-green-400 border-green-500/20"
              : "bg-red-500/10 text-red-400 border-red-500/20"
          )}
        >
          {positive ? (
            <TrendingUp className="h-3 w-3" />
          ) : (
            <TrendingDown className="h-3 w-3" />
          )}
          {change}
        </div>
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground tracking-tight">{value}</p>
        <p className="text-sm text-muted-foreground mt-0.5">{title}</p>
        {description && (
          <p className="text-xs text-muted-foreground/70 mt-1">{description}</p>
        )}
      </div>
    </motion.div>
  );
}
