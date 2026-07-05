import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAgentCaller } from "@/lib/agent-auth";

// Task types the worker actually registers — MUST mirror
// nirikshaka-worker/src/tasks/registry.ts (claimableTypes()); anything else
// would queue forever. Set-equality is enforced by
// nirikshaka-worker/src/tasks/registry.test.ts — update both together, one
// phase at a time. `noop` exists for Gate 0 plumbing checks.
const ALLOWED_TASK_TYPES = [
  "noop",
  "fuse_model",
  "review_model",
  "execute_run",
  "review_run",
  "plan_strategy",
  "generate_tests",
  "review_tests",
  "analyze_run",
] as const;

export async function POST(req: Request) {
  try {
    const caller = await getAgentCaller(req);
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const type = body?.type;
    const projectId = body?.projectId;
    const payload = body?.payload;

    if (typeof type !== "string" || !ALLOWED_TASK_TYPES.includes(type as never)) {
      return NextResponse.json(
        { error: `Invalid task type. Allowed: ${ALLOWED_TASK_TYPES.join(", ")}` },
        { status: 400 }
      );
    }
    if (projectId !== undefined && typeof projectId !== "string") {
      return NextResponse.json({ error: "projectId must be a string" }, { status: 400 });
    }
    if (payload !== undefined && (typeof payload !== "object" || payload === null || Array.isArray(payload))) {
      return NextResponse.json({ error: "payload must be an object" }, { status: 400 });
    }

    if (projectId) {
      // Session callers may only target their own team's projects; a 404
      // (not 403) avoids leaking that a foreign projectId exists.
      if (caller.kind === "user" && !caller.projectIds.includes(projectId)) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }
      const project = await prisma.project.findUnique({ where: { id: projectId } });
      if (!project) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }
    }

    const task = await prisma.agentTask.create({
      data: {
        type,
        projectId: projectId ?? null,
        payload: payload ?? {},
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: { id: task.id, type: task.type, status: task.status },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[agent/enqueue] failed:", error);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
