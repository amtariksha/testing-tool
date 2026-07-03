import { timingSafeEqual } from "crypto";
import prisma from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase-server";

function secretMatches(provided: string, expected: string): boolean {
  const providedBuffer = Buffer.from(provided, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }
  return timingSafeEqual(providedBuffer, expectedBuffer);
}

/**
 * Who is calling an /api/agent/* route:
 * - "secret": the worker / headless scripts via x-agent-secret — full access
 * - "user": a logged-in dashboard user — scoped to their team's projects
 */
export type AgentCaller =
  | { kind: "secret" }
  | { kind: "user"; projectIds: string[] };

export async function getAgentCaller(req: Request): Promise<AgentCaller | null> {
  const expected = process.env.AGENT_SHARED_SECRET;
  const provided = req.headers.get("x-agent-secret");
  if (expected && provided && secretMatches(provided, expected)) {
    return { kind: "secret" };
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    const email = data.user?.email;
    if (!email) {
      return null;
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return null;
    }

    const teams = await prisma.team.findMany({
      where: {
        OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }],
      },
      select: { id: true },
    });
    const projects = await prisma.project.findMany({
      where: { teamId: { in: teams.map((team) => team.id) } },
      select: { id: true },
    });

    return { kind: "user", projectIds: projects.map((project) => project.id) };
  } catch {
    return null;
  }
}
