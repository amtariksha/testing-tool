"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ZoomIn, Download, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";

/* ─── SCREENSHOT THUMBNAIL (clickable) ─── */
export function ScreenshotThumbnail({ url, label }: { url: string; label: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Screenshot</p>
        <div
          onClick={() => setOpen(true)}
          className="rounded-xl overflow-hidden border border-border bg-muted/30 max-h-48 relative cursor-pointer group"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={label} className="w-full h-full object-contain" />
          {/* Hover overlay */}
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <div className="flex items-center gap-2 px-4 py-2 bg-brand/90 rounded-lg text-black text-xs font-semibold">
              <Maximize2 className="h-4 w-4" />
              Click to view full size
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox Modal */}
      <AnimatePresence>
        {open && (
          <ScreenshotLightbox url={url} label={label} onClose={() => setOpen(false)} />
        )}
      </AnimatePresence>
    </>
  );
}

/* ─── SCREENSHOT LIGHTBOX (full-screen modal) ─── */
function ScreenshotLightbox({ url, label, onClose }: { url: string; label: string; onClose: () => void }) {
  const [zoomed, setZoomed] = useState(false);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = url;
    a.download = `screenshot-${Date.now()}.png`;
    a.target = "_blank";
    a.click();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      {/* Toolbar */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute top-4 right-4 flex items-center gap-2 z-[101]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => setZoomed(!zoomed)}
          className={cn(
            "p-2.5 rounded-xl border transition-all",
            zoomed
              ? "bg-brand/20 border-brand/40 text-brand"
              : "bg-muted/80 border-border text-muted-foreground hover:text-foreground hover:border-brand/50"
          )}
          title={zoomed ? "Zoom out" : "Zoom in"}
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <button
          onClick={handleDownload}
          className="p-2.5 rounded-xl bg-muted/80 border border-border text-muted-foreground hover:text-foreground hover:border-brand/50 transition-all"
          title="Download screenshot"
        >
          <Download className="h-4 w-4" />
        </button>
        <button
          onClick={onClose}
          className="p-2.5 rounded-xl bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30 transition-all"
          title="Close (Esc)"
        >
          <X className="h-4 w-4" />
        </button>
      </motion.div>

      {/* Label */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[101]"
      >
        <div className="px-4 py-2 rounded-xl bg-muted/80 border border-border text-xs text-muted-foreground backdrop-blur-sm">
          {label} • Press <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-foreground font-mono">Esc</kbd> to close
        </div>
      </motion.div>

      {/* Image */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className={cn(
          "relative z-[101] transition-all duration-300",
          zoomed ? "max-w-[95vw] max-h-[95vh]" : "max-w-[80vw] max-h-[80vh]"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="rounded-2xl overflow-hidden border-2 border-border/50 shadow-2xl bg-muted/30">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={label}
            className={cn(
              "transition-all duration-300 cursor-pointer",
              zoomed ? "max-w-[95vw] max-h-[90vh] object-contain" : "max-w-[80vw] max-h-[75vh] object-contain"
            )}
            onClick={() => setZoomed(!zoomed)}
          />
        </div>
      </motion.div>
    </motion.div>
  );
}
