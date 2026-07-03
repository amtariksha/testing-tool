import {
  createClient,
  type RealtimeChannel,
  type SupabaseClient,
} from "@supabase/supabase-js";
import type { WorkerConfig } from "./config";

export const AGENT_CHANNEL = "agent:tasks";

/**
 * Mailbox events are pointers at shared state, never payloads (doc §3):
 * ids only — the channel is readable with the public anon key, so details
 * (errors, project data) must be fetched via authenticated paths.
 */
export interface AgentTaskEvent {
  event: "task_claimed" | "task_done" | "task_failed";
  taskId: string;
  taskType: string;
  workerId: string;
  timestamp: string;
}

export interface RealtimePublisher {
  publish(event: AgentTaskEvent): Promise<void>;
  close(): Promise<void>;
}

/**
 * Supabase Realtime mailbox (decision D4). Broadcasts are fire-and-forget
 * pointers at shared state — payloads carry ids, never data.
 */
export function createRealtimePublisher(config: WorkerConfig): RealtimePublisher {
  if (!config.SUPABASE_URL || !config.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      async publish() {
        // Mailbox disabled — task state still lives in Postgres.
      },
      async close() {},
    };
  }

  const supabase: SupabaseClient = createClient(
    config.SUPABASE_URL,
    config.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );

  let channel: RealtimeChannel | null = null;

  function getChannel(): RealtimeChannel {
    if (!channel) {
      channel = supabase.channel(AGENT_CHANNEL);
    }
    return channel;
  }

  return {
    async publish(event: AgentTaskEvent): Promise<void> {
      try {
        const result = await getChannel().send({
          type: "broadcast",
          event: event.event,
          payload: event,
        });
        if (result !== "ok") {
          console.warn(`[realtime] broadcast ${event.event} returned: ${result}`);
        }
      } catch (error: unknown) {
        console.error(
          "[realtime] publish failed:",
          error instanceof Error ? error.message : error
        );
      }
    },
    async close(): Promise<void> {
      if (channel) {
        await supabase.removeChannel(channel);
        channel = null;
      }
    },
  };
}
