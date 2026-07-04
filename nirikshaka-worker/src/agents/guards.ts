import type { AppModel, PrismaClient } from "@prisma/client";

/**
 * The Confirmation Gate as code (doc §4.3: "the gate is law") plus the
 * permission write-matrix (PRD v3 §2.7). Enforcement is by construction —
 * each handler contains only its allowed writes — with this table as the
 * contract reviewers check against:
 *
 * | Agent      | May write                                                    |
 * |------------|--------------------------------------------------------------|
 * | Scout      | AppModel create (DRAFT), agent_tasks                         |
 * | Critic     | Critique create; AppModel.status DRAFT↔IN_REVIEW;            |
 * |            | TestCase confidence + tags (needs-human flag) ONLY           |
 * | Strategist | TestStrategy create/supersede; agent_tasks                   |
 * | Author     | TestCase upsert — ALWAYS needsReview:true, status:DRAFT      |
 * | Runner     | TestRun, TestCaseResult, LocatorCache                        |
 * | Analyst    | Critique create; TestCase.status→QUARANTINED (+reason);      |
 * |            | AppModel.status CONFIRMED→STALE                              |
 * | Human (UI) | ACTIVE/RETIRED, needsReview:false, unquarantine, CONFIRM     |
 */

export class ConfirmationGateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfirmationGateError";
  }
}

/**
 * The LATEST model version must itself be CONFIRMED — an older CONFIRMED v3
 * does not satisfy the gate while a newer DRAFT v4 exists, because generating
 * tests from a superseded understanding is exactly what the gate forbids.
 */
export async function assertConfirmedModel(
  prisma: PrismaClient,
  projectId: string
): Promise<AppModel> {
  const latest = await prisma.appModel.findFirst({
    where: { projectId },
    orderBy: { version: "desc" },
  });
  if (!latest) {
    throw new ConfirmationGateError(
      `no app model for project ${projectId} — run Scout and confirm the model first`
    );
  }
  if (latest.status !== "CONFIRMED") {
    throw new ConfirmationGateError(
      `latest app model (v${latest.version}) is ${latest.status}, not CONFIRMED — ` +
        `the Confirmation Gate must pass before test generation`
    );
  }
  return latest;
}
