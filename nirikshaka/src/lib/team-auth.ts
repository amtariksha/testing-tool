import "server-only";
import prisma from "@/lib/prisma";
import type { Team, TeamMemberRole } from "@prisma/client";
import { resolveUserCompany } from "@/app/dashboard/actions";
import { getUser } from "@/app/auth/actions";

export interface TeamCaller {
  userId: string;
  team: Team;
  role: TeamMemberRole;
}

/**
 * Resolve the caller's team + role and refuse when the role isn't allowed.
 * resolveUserCompany's ownerId branch can return a team the caller owns
 * WITHOUT a TeamMember row — ownership counts as OWNER.
 */
export async function requireTeamRole(allowed: TeamMemberRole[]): Promise<TeamCaller> {
  const sbUser = await getUser();
  if (!sbUser?.email) throw new Error("Unauthorized");
  const team = await resolveUserCompany();

  const prismaUser = await prisma.user.findUnique({ where: { email: sbUser.email } });
  if (!prismaUser) throw new Error("Unauthorized");

  let role: TeamMemberRole | null = null;
  if (team.ownerId === prismaUser.id) {
    role = "OWNER";
  } else {
    const membership = await prisma.teamMember.findUnique({
      where: { userId_teamId: { userId: prismaUser.id, teamId: team.id } },
    });
    role = membership?.role ?? null;
  }

  if (!role || !allowed.includes(role)) {
    throw new Error("Forbidden — this action needs one of: " + allowed.join(", "));
  }
  return { userId: prismaUser.id, team, role };
}
