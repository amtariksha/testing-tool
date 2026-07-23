"use server";

import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { requireTeamRole } from "@/lib/team-auth";
import { getAppUrl } from "@/lib/app-url";

/**
 * Team invites (the seam: pre-provisioning a Prisma User + TeamMember row
 * BEFORE first login makes resolveUserCompany attach the invitee to THIS
 * team instead of spawning them a fresh empty tenant).
 */

const INVITABLE_ROLES = ["ADMIN", "DEVELOPER", "VIEWER"] as const;
type InvitableRole = (typeof INVITABLE_ROLES)[number];

interface InviteInput {
  email: string;
  name: string;
  role: InvitableRole;
}

interface ActionResult {
  success?: string;
  error?: string;
  existingAuthUser?: boolean;
}

function isEmailExistsError(error: { status?: number; message?: string; code?: string }): boolean {
  // Error shape varies across supabase-js versions — match defensively.
  return (
    error.status === 422 ||
    error.code === "email_exists" ||
    /already.*(registered|exists)/i.test(error.message ?? "")
  );
}

export async function inviteTeamMember(input: InviteInput): Promise<ActionResult> {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address" };
  if (!name) return { error: "Name is required" };
  if (!INVITABLE_ROLES.includes(input.role)) return { error: "Invalid role" };

  const caller = await requireTeamRole(["OWNER", "ADMIN"]);

  // Find-or-create the Prisma user. OMIT role on create (default DEVELOPER)
  // — User.role carries SUPERADMIN semantics and is never handed out here.
  let user = await prisma.user.findUnique({ where: { email } });
  const createdUser = !user;
  if (!user) {
    user = await prisma.user.create({ data: { email, name } });
  }

  const memberships = await prisma.teamMember.findMany({ where: { userId: user.id } });
  if (memberships.some((m) => m.teamId === caller.team.id)) {
    return { error: `${email} is already a member of your team` };
  }
  if (memberships.length > 0) {
    // Multi-team membership is deferred — a second row would make
    // resolveUserCompany's findFirst nondeterministic.
    return { error: `${email} already belongs to another workspace` };
  }

  let member;
  try {
    member = await prisma.teamMember.create({
      data: { userId: user.id, teamId: caller.team.id, role: input.role },
    });
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: `${email} is already a member of your team` };
    }
    throw error;
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${getAppUrl()}/auth/callback?next=/reset-password`,
    data: { full_name: name },
  });

  if (inviteError) {
    if (isEmailExistsError(inviteError)) {
      return {
        success: `${email} already has an account — they've been added to your team and can sign in with their existing password (or use Forgot password).`,
        existingAuthUser: true,
      };
    }
    // Compensate: undo what this call created so a retry starts clean.
    await prisma.teamMember.delete({ where: { id: member.id } }).catch(() => {});
    if (createdUser) {
      await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
    }
    return { error: `Invite email failed: ${inviteError.message}` };
  }

  return { success: `Invitation email sent to ${email}` };
}

export async function removeTeamMember(memberId: string): Promise<ActionResult> {
  const caller = await requireTeamRole(["OWNER", "ADMIN"]);

  const member = await prisma.teamMember.findUnique({ where: { id: memberId } });
  if (!member || member.teamId !== caller.team.id) {
    return { error: "Member not found" };
  }
  if (member.role === "OWNER" || member.userId === caller.team.ownerId) {
    return { error: "The team owner cannot be removed" };
  }
  if (member.userId === caller.userId) {
    return { error: "You cannot remove yourself" };
  }

  // Membership only — never the global User row or the Supabase auth user.
  await prisma.teamMember.delete({ where: { id: memberId } });
  return { success: "Member removed" };
}
