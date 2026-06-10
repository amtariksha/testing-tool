"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface LoadingSkeletonProps {
  className?: string;
  lines?: number;
}

export function LoadingSkeleton({ className, lines = 1 }: LoadingSkeletonProps) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-4 bg-muted rounded-md shimmer"
          style={{ width: `${100 - i * 15}%` }}
        />
      ))}
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="card-premium p-5">
      <div className="flex items-start justify-between mb-4">
        <div className="h-10 w-10 rounded-xl bg-muted shimmer" />
        <div className="h-6 w-16 rounded-full bg-muted shimmer" />
      </div>
      <div className="space-y-2">
        <div className="h-8 w-24 rounded-md bg-muted shimmer" />
        <div className="h-4 w-32 rounded-md bg-muted shimmer" />
      </div>
    </div>
  );
}

export function TableRowSkeleton({ cols = 5 }: { cols?: number }) {
  return (
    <tr className="border-b border-border">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-muted rounded shimmer" style={{ width: `${60 + i * 10}%` }} />
        </td>
      ))}
    </tr>
  );
}

export function CardSkeleton({ height = "h-48" }: { height?: string }) {
  return (
    <div className={cn("card-premium p-5", height)}>
      <div className="h-4 w-32 bg-muted rounded shimmer mb-4" />
      <div className="flex-1 bg-muted rounded-lg shimmer h-32" />
    </div>
  );
}

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16 px-4 text-center"
    >
      {icon && (
        <div className="mb-4 p-4 rounded-2xl bg-muted/50 text-muted-foreground">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-6">{description}</p>
      {action}
    </motion.div>
  );
}
