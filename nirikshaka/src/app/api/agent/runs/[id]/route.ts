import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAgentCaller } from "@/lib/agent-auth";

/**
 * Status of an agent run. Test runs (Phase 2+) take precedence; until then
 * this resolves agent_tasks rows so Gate 0 can poll task completion.
 * Session callers only see rows belonging to their team's projects;
 * project-less tasks (e.g. gate noops) are visible to secret callers only.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await getAgentCaller(req);
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const canSee = (projectId: string | null): boolean =>
      caller.kind === "secret" ||
      (projectId !== null && caller.projectIds.includes(projectId));

    const testRun = await prisma.testRun.findUnique({ where: { id } });
    if (testRun && canSee(testRun.projectId)) {
      return NextResponse.json({
        success: true,
        data: { kind: "test_run", ...testRun },
      });
    }

    const task = await prisma.agentTask.findUnique({ where: { id } });
    if (task && canSee(task.projectId)) {
      return NextResponse.json({
        success: true,
        data: {
          kind: "agent_task",
          id: task.id,
          type: task.type,
          projectId: task.projectId,
          status: task.status,
          claimedBy: task.claimedBy,
          claimedAt: task.claimedAt,
          finishedAt: task.finishedAt,
          error: task.error,
          createdAt: task.createdAt,
        },
      });
    }

    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  } catch (error) {
    console.error("[agent/runs] failed:", error);
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }
}
