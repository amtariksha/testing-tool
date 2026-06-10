"use client";

import { useEffect, useState } from "react";
import { Nirikshaka } from "@/lib/sdk/web";
import { motion } from "framer-motion";
import { Activity, Bug } from "lucide-react";

export default function SDKTestPage() {
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    // Initialize the SDK on mount
    Nirikshaka.init({
      apiKey: "eqk_web_prod_8Kx9mN2pQ7rT4vW1yZ3aB6cD0eF5gH",
      projectId: "proj_001",
      environment: "development",
    });
    setInitialized(true);
  }, []);

  const triggerAPILog = () => {
    Nirikshaka.trackAPI({
      method: "POST",
      path: "/api/checkout/process",
      status: 201,
      duration: Math.floor(Math.random() * 500) + 120,
      requestSize: 1024,
      responseSize: 512,
    });
    alert("API Log sent! Check the terminal/console.");
  };

  const triggerCrash = () => {
    try {
      // Intentional crash
      throw new Error("TypeError: Cannot read properties of undefined (reading 'amount')");
    } catch (e: any) {
      Nirikshaka.trackCrash(e, { screen: "Checkout", userId: "usr_123" });
      alert("Crash Log sent! Check the terminal/console.");
    }
  };

  if (!initialized) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-foreground">Web SDK Test</h1>
          <p className="text-muted-foreground mt-2">Trigger events to test the SDK integration</p>
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={triggerAPILog}
          className="w-full flex items-center justify-center gap-3 p-6 rounded-2xl bg-brand/10 border border-brand/30 text-brand hover:bg-brand/20 transition-all"
        >
          <Activity className="h-6 w-6" />
          <span className="font-semibold text-lg">Simulate API Request</span>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={triggerCrash}
          className="w-full flex items-center justify-center gap-3 p-6 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-all"
        >
          <Bug className="h-6 w-6" />
          <span className="font-semibold text-lg">Simulate App Crash</span>
        </motion.button>
        
        <p className="text-xs text-center text-muted-foreground">
          Go to <code className="text-brand bg-brand/10 px-1 rounded">http://localhost:3001/test</code> to interact with this page.
        </p>
      </div>
    </div>
  );
}
