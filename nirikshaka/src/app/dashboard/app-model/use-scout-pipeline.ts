"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getScoutPipeline, type ScoutTaskInfo } from "./actions";

const POLL_MS = 3000;
const MAX_ACTIVE_MS = 10 * 60 * 1000; // hard stop: don't poll a wedged queue forever

/**
 * Polls the Scout→Critic pipeline while any task is queued/claimed and calls
 * onSettled when it goes idle (the page then reloads the model). Broadcasts on
 * the "agent:tasks" channel are used ONLY as a "poll now" nudge — payloads are
 * ids-only by design and must never be rendered.
 */
export function useScoutPipeline(projectId: string, onSettled: () => void) {
  const [tasks, setTasks] = useState<ScoutTaskInfo[]>([]);
  const [active, setActive] = useState(false);
  const activeRef = useRef(false);
  const activeSinceRef = useRef<number | null>(null);
  const onSettledRef = useRef(onSettled);
  onSettledRef.current = onSettled;

  const refresh = useCallback(async () => {
    if (!projectId) return;
    try {
      const result = await getScoutPipeline(projectId);
      setTasks(result.tasks);
      setActive(result.active);
      if (result.active && activeSinceRef.current === null) {
        activeSinceRef.current = Date.now();
      }
      if (!result.active) {
        activeSinceRef.current = null;
        if (activeRef.current) onSettledRef.current();
      }
      activeRef.current = result.active;
    } catch {
      // transient — next poll retries
    }
  }, [projectId]);

  // Initial load + reset when the project changes.
  useEffect(() => {
    activeRef.current = false;
    activeSinceRef.current = null;
    setTasks([]);
    setActive(false);
    void refresh();
  }, [refresh]);

  // Poll while active (with a hard stop).
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => {
      if (activeSinceRef.current && Date.now() - activeSinceRef.current > MAX_ACTIVE_MS) {
        clearInterval(timer);
        return;
      }
      void refresh();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [active, refresh]);

  // Realtime nudge: any agent event → poll immediately.
  useEffect(() => {
    const channel = supabase
      .channel("agent:tasks")
      .on("broadcast", { event: "*" }, () => void refresh())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [refresh]);

  /** Call after enqueueing a task so the poller starts without waiting. */
  const notifyEnqueued = useCallback(() => {
    activeSinceRef.current = Date.now();
    setActive(true);
    activeRef.current = true;
    void refresh();
  }, [refresh]);

  return { tasks, active, notifyEnqueued, refresh };
}
