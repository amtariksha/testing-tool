import "dotenv/config";
import os from "node:os";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  NIRIKSHAKA_MASTER_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  WACRM_WEBHOOK_URL: z.string().optional(),
  DASHBOARD_URL: z.string().optional(),
  AGENT_SHARED_SECRET: z.string().optional(),
  WORKER_ID: z.string().default(`worker-${os.hostname()}`),
  POLL_INTERVAL_MS: z.coerce.number().int().positive().default(2000),
  HEARTBEAT_INTERVAL_MS: z.coerce.number().int().positive().default(10000),
  STALE_CLAIM_SECONDS: z.coerce.number().int().positive().default(300),
  // ── Runner (Phase 2) ──
  RUNNER_HEADLESS: z
    .string()
    .default("true")
    .transform((v) => v !== "false" && v !== "0"),
  RUNNER_MAX_COST_USD: z.coerce.number().positive().default(1.0),
  ARTIFACTS_DIR: z.string().default("./artifacts"),
  SUPABASE_ARTIFACTS_BUCKET: z.string().default("test-artifacts"),
  // ── MCP server (Phase 2) ──
  MCP_TRANSPORT: z.enum(["stdio", "http"]).default("stdio"),
  MCP_HTTP_PORT: z.coerce.number().int().positive().default(8788),
});

export type WorkerConfig = z.infer<typeof envSchema>;

export function loadConfig(): WorkerConfig {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid worker environment:\n${issues}`);
  }

  const config = parsed.data;

  if (!config.SUPABASE_URL || !config.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn(
      "[config] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — realtime mailbox disabled"
    );
  }
  if (!config.NIRIKSHAKA_MASTER_KEY) {
    console.warn(
      "[config] NIRIKSHAKA_MASTER_KEY not set — envelope encryption unavailable"
    );
  }

  return config;
}
