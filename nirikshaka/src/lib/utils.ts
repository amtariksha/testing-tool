import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatTime(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatDateTime(date: Date | string): string {
  const d = new Date(date);
  return `${formatDate(d)} ${formatTime(d)}`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + "...";
}

export function generateApiKey(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const prefix = "eqk_";
  const keyLength = 40;
  let result = prefix;
  for (let i = 0; i < keyLength; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function getStatusColor(status: number): string {
  if (status >= 500) return "text-red-500";
  if (status >= 400) return "text-orange-500";
  if (status >= 300) return "text-yellow-500";
  if (status >= 200) return "text-green-500";
  return "text-muted-foreground";
}

export function getStatusBgColor(status: number): string {
  if (status >= 500) return "bg-red-500/10 text-red-400 border-red-500/20";
  if (status >= 400) return "bg-orange-500/10 text-orange-400 border-orange-500/20";
  if (status >= 300) return "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";
  if (status >= 200) return "bg-green-500/10 text-green-400 border-green-500/20";
  return "bg-muted text-muted-foreground";
}

export function getSeverityColor(severity: string): string {
  switch (severity.toLowerCase()) {
    case "critical": return "bg-red-500/10 text-red-400 border-red-500/20";
    case "error": return "bg-orange-500/10 text-orange-400 border-orange-500/20";
    case "warning": return "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";
    case "info": return "bg-blue-500/10 text-blue-400 border-blue-500/20";
    default: return "bg-muted text-muted-foreground";
  }
}

export function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function getRelativeTime(date: Date | string): string {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}
