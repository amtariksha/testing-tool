"use server";

import prisma from "@/lib/prisma";
import crypto from "crypto";
import { getUser } from "@/app/auth/actions";
import { tryDecryptString } from "@/lib/crypto/envelope";

// Resolves the logged-in user and returns their company (team).
// Creates the user and a default team if they don't exist yet.
export async function resolveUserCompany() {
  const sbUser = await getUser();
  if (!sbUser || !sbUser.email) {
    throw new Error("Unauthorized");
  }

  // 1. Find or create user in prisma
  let prismaUser = await prisma.user.findUnique({
    where: { email: sbUser.email },
  });

  if (!prismaUser) {
    prismaUser = await prisma.user.create({
      data: {
        email: sbUser.email,
        name: sbUser.user_metadata?.full_name || sbUser.email.split("@")[0] || "User",
        role: "OWNER",
      },
    });
  }

  // 2. Find if this user owns a team (company) or is a member of one
  let teamMember = await prisma.teamMember.findFirst({
    where: { userId: prismaUser.id },
    include: { team: true },
  });

  let team = teamMember?.team || null;

  if (!team) {
    // Check if user owns any team
    team = await prisma.team.findFirst({
      where: { ownerId: prismaUser.id },
    });
  }

  if (!team) {
    // Generate a default company/team name based on user name/email
    const companyName = prismaUser.name.endsWith("s") ? `${prismaUser.name}' Company` : `${prismaUser.name}'s Company`;
    const slug = prismaUser.email.split("@")[0].toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + Math.random().toString(36).substring(2, 6);

    team = await prisma.team.create({
      data: {
        name: companyName,
        slug,
        ownerId: prismaUser.id,
      },
    });

    // Add as team member
    await prisma.teamMember.create({
      data: {
        userId: prismaUser.id,
        teamId: team.id,
        role: "OWNER",
      },
    });
  }

  return team;
}

export async function getProjects() {
  try {
    const team = await resolveUserCompany();

    const projects = await prisma.project.findMany({
      where: { teamId: team.id },
      orderBy: { updatedAt: 'desc' },
      include: {
        apiKeys: {
          take: 1
        },
        _count: {
          select: {
            apiRequests: true,
            crashLogs: true,
            uiErrors: true,
          }
        }
      }
    });

    const projectsWithStats = await Promise.all(
      projects.map(async (project) => {
        const failedApiRequests = await prisma.aPIRequest.count({
          where: {
            projectId: project.id,
            status: { gte: 400 }
          }
        });

        return {
          ...project,
          requestCount: project._count.apiRequests,
          errorCount: project._count.crashLogs + project._count.uiErrors + failedApiRequests
        };
      })
    );

    return projectsWithStats;
  } catch (error) {
    console.error("Failed to fetch projects:", error);
    return [];
  }
}

export async function createProject(data: {
  name: string;
  packageName: string;
  platform: any;
  environment: any;
}) {
  try {
    const team = await resolveUserCompany();

    const project = await prisma.project.create({
      data: {
        name: data.name,
        packageName: data.packageName,
        platform: data.platform,
        environment: data.environment,
        teamId: team.id,
      }
    });
    
    // Automatically generate an API key for the new project
    await prisma.aPIKey.create({
      data: {
        name: "Default Key",
        key: `eqk_live_${Math.random().toString(36).substring(2, 15)}`,
        projectId: project.id
      }
    });

    return { success: true, project };
  } catch (error: any) {
    console.error("Failed to create project:", error);
    return { success: false, error: error.message };
  }
}

export async function getCrashLogs(projectId?: string, limit: number = 50) {
  try {
    const team = await resolveUserCompany();
    const teamProjects = await prisma.project.findMany({
      where: { teamId: team.id },
      select: { id: true }
    });
    const projectIds = teamProjects.map(p => p.id);

    const finalWhere = projectId 
      ? { projectId: projectId, project: { teamId: team.id } }
      : { projectId: { in: projectIds } };

    return await prisma.crashLog.findMany({
      where: finalWhere,
      orderBy: { timestamp: 'desc' },
      take: limit
    });
  } catch (error) {
    return [];
  }
}

export async function getApiRequests(projectId?: string, limit: number = 100) {
  try {
    const team = await resolveUserCompany();
    const teamProjects = await prisma.project.findMany({
      where: { teamId: team.id },
      select: { id: true }
    });
    const projectIds = teamProjects.map(p => p.id);

    const finalWhere = projectId
      ? { projectId: projectId, project: { teamId: team.id } }
      : { projectId: { in: projectIds } };

    const requests = await prisma.aPIRequest.findMany({
      where: finalWhere,
      orderBy: { timestamp: 'desc' },
      take: limit
    });

    // Bodies are envelope-encrypted at rest; legacy plaintext passes through
    return requests.map((request) => ({
      ...request,
      requestBody: tryDecryptString(request.requestBody, request.projectId),
      responseBody: tryDecryptString(request.responseBody, request.projectId),
    }));
  } catch (error) {
    return [];
  }
}

export async function getApiKeys(projectId?: string) {
  try {
    const team = await resolveUserCompany();
    const teamProjects = await prisma.project.findMany({
      where: { teamId: team.id },
      select: { id: true }
    });
    const projectIds = teamProjects.map(p => p.id);

    const finalWhere = projectId 
      ? { projectId: projectId, project: { teamId: team.id } }
      : { projectId: { in: projectIds } };

    return await prisma.aPIKey.findMany({
      where: finalWhere,
      orderBy: { createdAt: 'desc' },
      include: {
        project: true,
        _count: {
          select: { apiRequests: true }
        }
      }
    });
  } catch (error) {
    return [];
  }
}

export async function getTeamMembers() {
  try {
    const team = await resolveUserCompany();
    return await prisma.teamMember.findMany({
      where: { teamId: team.id },
      orderBy: { joinedAt: 'desc' },
      include: {
        user: true
      }
    });
  } catch (error) {
    return [];
  }
}

export async function getUiErrors(projectId?: string, limit: number = 50) {
  try {
    const team = await resolveUserCompany();
    const teamProjects = await prisma.project.findMany({
      where: { teamId: team.id },
      select: { id: true }
    });
    const projectIds = teamProjects.map(p => p.id);

    const finalWhere = projectId 
      ? { projectId: projectId, project: { teamId: team.id } }
      : { projectId: { in: projectIds } };

    return await prisma.uIError.findMany({
      where: finalWhere,
      orderBy: { timestamp: 'desc' },
      take: limit
    });
  } catch (error) {
    return [];
  }
}

export async function getDashboardStats(projectId?: string) {
  try {
    const team = await resolveUserCompany();
    
    // Build where clause restricted to this team's projects
    const teamProjects = await prisma.project.findMany({
      where: { teamId: team.id },
      select: { id: true }
    });
    const projectIds = teamProjects.map(p => p.id);

    const whereClause: any = projectId 
      ? { projectId: projectId, project: { teamId: team.id } } 
      : { projectId: { in: projectIds } };

    const [
      totalRequests,
      totalCrashes,
      totalProjects,
      totalApiKeys,
      sdkInstalls,
      avgLatency,
    ] = await Promise.all([
      prisma.aPIRequest.count({ where: whereClause }),
      prisma.crashLog.count({ where: whereClause }),
      projectId ? 1 : projectIds.length,
      prisma.aPIKey.count({ where: whereClause }),
      prisma.sDKInstallation.count({ where: whereClause }),
      prisma.aPIRequest.aggregate({ _avg: { duration: true }, where: whereClause }),
    ]);

    // Calculate error rate
    const errorRequests = await prisma.aPIRequest.count({
      where: { ...whereClause, status: { gte: 400 } },
    });
    const errorRate = totalRequests > 0
      ? ((errorRequests / totalRequests) * 100).toFixed(1)
      : "0.0";

    // Count SDK installs per platform
    const platformInstalls = await prisma.sDKInstallation.groupBy({
      by: ["platform"],
      where: whereClause,
      _count: {
        id: true,
      },
    });

    const installCounts: Record<string, number> = {
      WEB: 0,
      ANDROID: 0,
      IOS: 0,
      FLUTTER: 0,
      REACT_NATIVE: 0,
    };

    platformInstalls.forEach((item) => {
      if (item.platform) {
        installCounts[item.platform] = item._count.id;
      }
    });

    return {
      totalRequests: totalRequests.toLocaleString(),
      activeAPIs: totalApiKeys.toString(),
      errorRate: `${errorRate}%`,
      crashCount: totalCrashes.toString(),
      sdkInstalls: sdkInstalls.toLocaleString(),
      avgLatency: `${Math.round(avgLatency._avg?.duration || 0)}ms`,
      uptime: "99.9%",
      activeUsers: totalProjects.toString(),
      sdkDistribution: installCounts,
    };
  } catch (error) {
    console.error("Failed to fetch dashboard stats:", error);
    return null;
  }
}

export async function createRazorpayOrder(projectId: string, tier: "growth" | "enterprise") {
  try {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      throw new Error("Razorpay credentials not configured");
    }

    let amount = 250000; // 2500 INR (approx $29) for Growth plan
    if (tier === "enterprise") {
      amount = 800000; // 8000 INR (approx $99) for Enterprise plan
    }

    const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${auth}`
      },
      body: JSON.stringify({
        amount,
        currency: "INR",
        receipt: `receipt_${projectId}_${Date.now()}`
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Razorpay Order creation failed: ${errorText}`);
    }

    const order = await response.json();
    return { success: true, orderId: order.id, amount, keyId };
  } catch (error: any) {
    console.error("Order creation error:", error);
    return { success: false, error: error.message };
  }
}

export async function verifyRazorpayPayment(data: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  projectId: string;
  tier: "growth" | "enterprise";
}) {
  try {
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      throw new Error("Razorpay key secret not configured");
    }

    // Verify signature using HMAC-SHA256
    const hmac = crypto.createHmac("sha256", keySecret);
    hmac.update(`${data.razorpay_order_id}|${data.razorpay_payment_id}`);
    const expectedSignature = hmac.digest("hex");

    if (expectedSignature !== data.razorpay_signature) {
      return { success: false, error: "Payment verification failed. Invalid signature." };
    }

    // Update Project Limit
    let newLimit = 100000; // Growth plan: 100,000 events
    if (data.tier === "enterprise") {
      newLimit = 1000000; // Enterprise plan: 1,000,000 events
    }

    const updatedProject = await prisma.project.update({
      where: { id: data.projectId },
      data: {
        monthlyEventLimit: newLimit,
        isSuspended: false // Automatically lift any suspensions upon payment
      }
    });

    return { success: true, project: updatedProject };
  } catch (error: any) {
    console.error("Payment verification error:", error);
    return { success: false, error: error.message };
  }
}

export async function upgradeProjectTierFree(projectId: string, tier: "growth" | "enterprise") {
  try {
    const team = await resolveUserCompany();
    
    // Verify project belongs to user's company/team
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { teamId: true }
    });

    if (!project || project.teamId !== team.id) {
      throw new Error("Unauthorized to access this project");
    }

    let newLimit = 100000;
    if (tier === "enterprise") {
      newLimit = 1000000;
    }

    const updatedProject = await prisma.project.update({
      where: { id: projectId },
      data: {
        monthlyEventLimit: newLimit,
        isSuspended: false
      }
    });

    return { success: true, project: updatedProject };
  } catch (error: any) {
    console.error("Free upgrade error:", error);
    return { success: false, error: error.message };
  }
}

export async function getProject(projectId: string) {
  try {
    const team = await resolveUserCompany();
    return await prisma.project.findFirst({
      where: { id: projectId, teamId: team.id }
    });
  } catch (error) {
    console.error("Failed to fetch project:", error);
    return null;
  }
}

export async function saveProjectNotificationSettings(
  projectId: string,
  settings: {
    notifyOnCriticalCrash: boolean;
    notifyOnErrorSpike: boolean;
    notifyOnSDKInstall: boolean;
    notifyWeeklySummary: boolean;
    notifyOnApiDown: boolean;
  }
) {
  try {
    const team = await resolveUserCompany();

    const project = await prisma.project.findFirst({
      where: { id: projectId, teamId: team.id }
    });

    if (!project) {
      return { success: false, error: "Project not found or unauthorized" };
    }

    const updated = await prisma.project.update({
      where: { id: projectId },
      data: settings
    });

    return { success: true, project: updated };
  } catch (error: any) {
    console.error("Failed to save notification settings:", error);
    return { success: false, error: error.message };
  }
}

export async function saveProjectWebhookSettings(
  projectId: string,
  webhookUrl: string,
  webhookEvents: string
) {
  try {
    const team = await resolveUserCompany();

    const project = await prisma.project.findFirst({
      where: { id: projectId, teamId: team.id }
    });

    if (!project) {
      return { success: false, error: "Project not found or unauthorized" };
    }

    const updated = await prisma.project.update({
      where: { id: projectId },
      data: {
        webhookUrl,
        webhookEvents
      }
    });

    return { success: true, project: updated };
  } catch (error: any) {
    console.error("Failed to save webhook settings:", error);
    return { success: false, error: error.message };
  }
}




