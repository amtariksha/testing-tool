"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

const AGENT_CHANNEL = "agent:tasks";

/**
 * Subscribes to the worker's Supabase Realtime mailbox and logs agent task
 * events to the browser console (Gate 0). Live status UI builds on this
 * channel in later phases.
 */
export function AgentEventLogger() {
  useEffect(() => {
    const channel = supabase
      .channel(AGENT_CHANNEL)
      .on("broadcast", { event: "*" }, (message) => {
        console.debug("[nirikshaka:agent]", message.event, message.payload);
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  return null;
}
