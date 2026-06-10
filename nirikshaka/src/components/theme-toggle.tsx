"use client";

import { useTheme } from "@/components/theme-provider";
import { Moon, Sun } from "lucide-react";
import { motion } from "framer-motion";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <motion.button
      onClick={toggleTheme}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className="relative p-2 rounded-lg border border-border hover:border-brand/50 bg-card hover:bg-brand/5 transition-all duration-200 group"
      aria-label="Toggle theme"
    >
      <motion.div
        key={theme}
        initial={{ rotate: -90, opacity: 0 }}
        animate={{ rotate: 0, opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        {theme === "dark" ? (
          <Sun className="h-4 w-4 text-muted-foreground group-hover:text-brand transition-colors" />
        ) : (
          <Moon className="h-4 w-4 text-muted-foreground group-hover:text-brand transition-colors" />
        )}
      </motion.div>
    </motion.button>
  );
}
