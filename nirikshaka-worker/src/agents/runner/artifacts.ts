import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { WorkerConfig } from "../../config";

/**
 * Failure screenshots: Supabase Storage when configured (public URL), else
 * local ARTIFACTS_DIR (path stored instead). Never throws — a failed
 * screenshot must not fail the case.
 */

let supabase: SupabaseClient | null | undefined;

function getStorage(config: WorkerConfig): SupabaseClient | null {
  if (supabase !== undefined) return supabase;
  supabase =
    config.SUPABASE_URL && config.SUPABASE_SERVICE_ROLE_KEY
      ? createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY)
      : null;
  return supabase;
}

export async function saveScreenshot(
  config: WorkerConfig,
  buffer: Buffer,
  runId: string,
  caseExternalId: string,
  stepIndex: number
): Promise<string | null> {
  const fileName = `${runId}/${caseExternalId}-step${stepIndex}.png`;
  try {
    const storage = getStorage(config);
    if (storage) {
      const { error } = await storage.storage
        .from(config.SUPABASE_ARTIFACTS_BUCKET)
        .upload(fileName, buffer, { contentType: "image/png", upsert: true });
      if (!error) {
        const { data } = storage.storage
          .from(config.SUPABASE_ARTIFACTS_BUCKET)
          .getPublicUrl(fileName);
        return data.publicUrl;
      }
      console.warn(`[artifacts] supabase upload failed (${error.message}); falling back to disk`);
    }
    const localPath = path.join(config.ARTIFACTS_DIR, fileName);
    await mkdir(path.dirname(localPath), { recursive: true });
    await writeFile(localPath, buffer);
    return localPath;
  } catch (error: unknown) {
    console.warn(
      `[artifacts] screenshot save failed: ${error instanceof Error ? error.message : String(error)}`
    );
    return null;
  }
}
