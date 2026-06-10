"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { RealtimeEvent, RealtimeEventType } from "@/lib/event-bus";

interface UseRealtimeOptions {
  projectId?: string;
  /** Which event types to listen for. Default: all */
  eventTypes?: RealtimeEventType[];
  /** Called whenever a matching event arrives */
  onEvent?: (event: RealtimeEvent) => void;
}

type ConnectionStatus = "connecting" | "connected" | "disconnected";

export function useRealtime({
  projectId,
  eventTypes,
  onEvent,
}: UseRealtimeOptions) {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const eventSourceRef = useRef<EventSource | null>(null);
  const onEventRef = useRef(onEvent);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Keep callback ref fresh without re-triggering effect
  onEventRef.current = onEvent;

  const connect = useCallback(() => {
    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const params = new URLSearchParams();
    if (projectId) params.set("projectId", projectId);

    const url = `/api/events${params.toString() ? `?${params}` : ""}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    setStatus("connecting");

    es.onopen = () => {
      setStatus("connected");
      reconnectAttemptRef.current = 0; // Reset backoff on success
    };

    es.onmessage = (e) => {
      try {
        const event: RealtimeEvent = JSON.parse(e.data);

        // Skip heartbeats and connection confirmations
        if (event.type === ("heartbeat" as any) || event.type === ("connected" as any)) return;

        // Filter by event type if specified
        if (eventTypes && !eventTypes.includes(event.type)) return;

        onEventRef.current?.(event);
      } catch {
        // Ignore parse errors
      }
    };

    es.onerror = () => {
      es.close();
      setStatus("disconnected");

      // Exponential backoff: 1s, 2s, 4s, 8s, max 30s
      const delay = Math.min(1000 * Math.pow(2, reconnectAttemptRef.current), 30000);
      reconnectAttemptRef.current++;

      reconnectTimerRef.current = setTimeout(() => {
        connect();
      }, delay);
    };
  }, [projectId, eventTypes]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [connect]);

  return { status };
}
