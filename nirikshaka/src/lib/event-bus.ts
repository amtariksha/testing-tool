import { EventEmitter } from "events";

// Global event bus singleton — survives hot reloads in dev mode
const globalForEvents = globalThis as unknown as {
  __eventBus: EventEmitter | undefined;
};

export const eventBus =
  globalForEvents.__eventBus ?? new EventEmitter();

// Increase max listeners since each SSE connection adds one
eventBus.setMaxListeners(100);

if (process.env.NODE_ENV !== "production") {
  globalForEvents.__eventBus = eventBus;
}

// ─── Event Types ───────────────────────────────────────────

export type RealtimeEventType =
  | "api_request"
  | "crash_log"
  | "ui_error"
  | "screenshot_uploaded"
  | "user_journey";

export interface RealtimeEvent {
  type: RealtimeEventType;
  projectId: string;
  data: any;
  timestamp: string;
}

/**
 * Emit a real-time event to all connected SSE clients
 */
export function emitRealtimeEvent(event: RealtimeEvent) {
  eventBus.emit("realtime", event);
}
