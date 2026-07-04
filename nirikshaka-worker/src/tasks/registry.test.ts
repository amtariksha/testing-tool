import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { claimableTypes } from "./registry";

/**
 * The dashboard's enqueue route advertises which task types can be queued;
 * the worker's registry decides which ever get claimed. If the two drift, a
 * task type queues forever (DEVELOPER-MANUAL §8 gap 3). This test pins them
 * to set-equality by reading the route source from the sibling checkout —
 * same repo, same precedent as the sync:schema script.
 */
const ENQUEUE_ROUTE = path.resolve(
  __dirname,
  "../../../nirikshaka/src/app/api/agent/enqueue/route.ts"
);

describe("enqueue allowlist honesty", () => {
  it.skipIf(!existsSync(ENQUEUE_ROUTE))(
    "dashboard ALLOWED_TASK_TYPES equals worker claimableTypes()",
    () => {
      const source = readFileSync(ENQUEUE_ROUTE, "utf8");
      const match = source.match(/const ALLOWED_TASK_TYPES = \[([\s\S]*?)\] as const/);
      expect(match, "ALLOWED_TASK_TYPES literal not found in enqueue route").toBeTruthy();

      const advertised = [...match![1]!.matchAll(/"([\w-]+)"/g)].map((m) => m[1]!);
      expect(new Set(advertised)).toEqual(new Set(claimableTypes()));
    }
  );
});
