"use server";

import prisma from "@/lib/prisma";
import { Platform, UserRole } from "@prisma/client";

export async function verifyAdminPin(pin: string) {
  try {
    const correctPin = process.env.ADMIN_PIN || "123456";
    if (pin === correctPin) {
      return { success: true };
    }
    return { success: false, error: "Invalid passcode. Access denied." };
  } catch (error: any) {
    return { success: false, error: "Authentication system error" };
  }
}

// Ensure a default team exists in the database
async function getOrCreateDefaultTeam() {
  let team = await prisma.team.findFirst();
  if (!team) {
    // Find or create default user first
    let user = await prisma.user.findFirst();
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: "admin@nirikshaka.io",
          name: "Nirikshaka Admin",
          role: "SUPERADMIN",
        },
      });
    }
    team = await prisma.team.create({
      data: {
        name: "Nirikshaka Global Team",
        slug: "nirikshaka-global",
        ownerId: user.id,
      },
    });
  }
  return team;
}

export async function getCompanies() {
  try {
    const teams = await prisma.team.findMany({
      include: {
        owner: true,
        projects: {
          include: {
            apiKeys: true,
            _count: {
              select: {
                apiRequests: true,
                crashLogs: true,
                uiErrors: true,
                userJourneys: true,
              },
            },
          },
        },
        _count: {
          select: {
            projects: true,
            members: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return { success: true, data: teams };
  } catch (error: any) {
    console.error("Error fetching companies:", error);
    return { success: false, error: error.message || "Failed to fetch companies" };
  }
}

export async function getProjects() {
  try {
    const projects = await prisma.project.findMany({
      include: {
        apiKeys: true,
        _count: {
          select: {
            apiRequests: true,
            crashLogs: true,
            uiErrors: true,
            userJourneys: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return { success: true, data: projects };
  } catch (error: any) {
    console.error("Error fetching projects:", error);
    return { success: false, error: error.message || "Failed to fetch projects" };
  }
}

export async function toggleFeature(
  projectId: string,
  featureKey: string,
  newValue: boolean
) {
  try {
    // Whitelist valid flags to prevent arbitrary field updates
    const validFlags = [
      "enableCrashReporting",
      "enableNetworkTracking",
      "enableUIErrorTracking",
      "enableBreadcrumbs",
      "enableLifecycleTracking",
      "enableJourneyTracking",
      "enableScreenshotDetection",
    ];

    if (!validFlags.includes(featureKey)) {
      throw new Error(`Invalid feature key: ${featureKey}`);
    }

    const updatedProject = await prisma.project.update({
      where: { id: projectId },
      data: {
        [featureKey]: newValue,
      },
    });

    return { success: true, data: updatedProject };
  } catch (error: any) {
    console.error("Error toggling feature:", error);
    return { success: false, error: error.message || "Failed to update feature" };
  }
}

export async function updateQuota(projectId: string, monthlyEventLimit: number) {
  try {
    const updatedProject = await prisma.project.update({
      where: { id: projectId },
      data: {
        monthlyEventLimit: Number(monthlyEventLimit),
      },
    });
    return { success: true, data: updatedProject };
  } catch (error: any) {
    console.error("Error updating quota:", error);
    return { success: false, error: error.message || "Failed to update quota" };
  }
}

export async function toggleSuspension(projectId: string, isSuspended: boolean) {
  try {
    const updatedProject = await prisma.project.update({
      where: { id: projectId },
      data: {
        isSuspended,
      },
    });
    return { success: true, data: updatedProject };
  } catch (error: any) {
    console.error("Error toggling suspension:", error);
    return { success: false, error: error.message || "Failed to update suspension" };
  }
}

export async function createCompany(
  name: string,
  ownerEmail: string,
  ownerName: string
) {
  try {
    // 1. Find or create user
    let user = await prisma.user.findUnique({
      where: { email: ownerEmail },
    });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: ownerEmail,
          name: ownerName || name + " Admin",
          role: "OWNER",
        },
      });
    }

    // Generate slug from name
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "") + "-" + Math.random().toString(36).substring(2, 6);

    // 2. Create the Team (Company)
    const team = await prisma.team.create({
      data: {
        name,
        slug,
        ownerId: user.id,
      },
    });

    // 3. Add owner as team member
    await prisma.teamMember.create({
      data: {
        userId: user.id,
        teamId: team.id,
        role: "OWNER",
      },
    });

    return { success: true, data: team };
  } catch (error: any) {
    console.error("Error creating company:", error);
    return { success: false, error: error.message || "Failed to create company" };
  }
}

export async function createProject(
  companyId: string,
  name: string,
  packageName: string,
  platform: Platform,
  monthlyEventLimit: number
) {
  try {
    // Create the project under the company (team)
    const project = await prisma.project.create({
      data: {
        name,
        packageName,
        platform,
        monthlyEventLimit: Number(monthlyEventLimit),
        teamId: companyId,
      },
    });

    // Automatically generate an API Key for this project
    const keyString = `eqk_live_${Math.random().toString(36).substring(2)}${Math.random().toString(36).substring(2)}`;
    await prisma.aPIKey.create({
      data: {
        name: "Default Live Key",
        key: keyString,
        projectId: project.id,
      },
    });

    return { success: true, data: project };
  } catch (error: any) {
    console.error("Error creating project:", error);
    return { success: false, error: error.message || "Failed to create project" };
  }
}

export async function getStats() {
  try {
    const totalProjects = await prisma.project.count();
    const activeProjects = await prisma.project.count({ where: { status: "ACTIVE", isSuspended: false } });
    const suspendedProjects = await prisma.project.count({ where: { isSuspended: true } });

    // Aggregate ingestion counts
    const totalCrashes = await prisma.crashLog.count();
    const totalUIErrors = await prisma.uIError.count();
    const totalAPIRequests = await prisma.aPIRequest.count();
    const totalJourneys = await prisma.userJourney.count();
    const totalCompanies = await prisma.team.count();

    return {
      success: true,
      stats: {
        totalProjects,
        activeProjects,
        suspendedProjects,
        totalCrashes,
        totalUIErrors,
        totalAPIRequests,
        totalJourneys,
        totalCompanies,
      },
    };
  } catch (error: any) {
    console.error("Error fetching stats:", error);
    return { success: false, error: error.message || "Failed to fetch platform stats" };
  }
}

export async function getUsers() {
  try {
    const users = await prisma.user.findMany({
      include: {
        teams: {
          include: {
            team: true
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });
    return { success: true, data: users };
  } catch (error: any) {
    console.error("Error fetching users:", error);
    return { success: false, error: error.message || "Failed to fetch users" };
  }
}

export async function updateUserRole(userId: string, newRole: UserRole) {
  try {
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        role: newRole
      }
    });
    return { success: true, data: updatedUser };
  } catch (error: any) {
    console.error("Error updating user role:", error);
    return { success: false, error: error.message || "Failed to update user role" };
  }
}

export async function pruneTelemetryData(days: number) {
  try {
    const thresholdDate = new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000);

    // Order of dependency delete
    const deletedEvents = await prisma.journeyEvent.deleteMany({
      where: { timestamp: { lt: thresholdDate } }
    });
    const deletedJourneys = await prisma.userJourney.deleteMany({
      where: { startedAt: { lt: thresholdDate } }
    });
    const deletedCrashes = await prisma.crashLog.deleteMany({
      where: { timestamp: { lt: thresholdDate } }
    });
    const deletedUiErrors = await prisma.uIError.deleteMany({
      where: { timestamp: { lt: thresholdDate } }
    });
    const deletedApiRequests = await prisma.aPIRequest.deleteMany({
      where: { timestamp: { lt: thresholdDate } }
    });

    const totalPruned = deletedEvents.count + deletedJourneys.count + deletedCrashes.count + deletedUiErrors.count + deletedApiRequests.count;

    return {
      success: true,
      message: `Pruned ${totalPruned} historical database records successfully!`,
      details: {
        events: deletedEvents.count,
        journeys: deletedJourneys.count,
        crashes: deletedCrashes.count,
        uiErrors: deletedUiErrors.count,
        apiRequests: deletedApiRequests.count
      }
    };
  } catch (error: any) {
    console.error("Error pruning data:", error);
    return { success: false, error: error.message || "Failed to prune telemetry logs" };
  }
}

export async function manuallySetTier(projectId: string, tier: 'starter' | 'growth' | 'enterprise') {
  try {
    let newLimit = 10000;
    if (tier === 'growth') {
      newLimit = 100000;
    } else if (tier === 'enterprise') {
      newLimit = 1000000;
    }

    const updatedProject = await prisma.project.update({
      where: { id: projectId },
      data: {
        monthlyEventLimit: newLimit
      }
    });

    return { success: true, data: updatedProject };
  } catch (error: any) {
    console.error("Error setting tier:", error);
    return { success: false, error: error.message || "Failed to set project limit tier" };
  }
}

export async function getSystemConfig(key: string) {
  try {
    const config = await prisma.systemConfig.findUnique({
      where: { key },
    });
    return { success: true, data: config ? config.value : "" };
  } catch (error: any) {
    console.error(`Error fetching system config for ${key}:`, error);
    return { success: false, error: error.message || "Failed to fetch system config" };
  }
}

export async function updateSystemConfig(key: string, value: string) {
  try {
    const config = await prisma.systemConfig.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
    return { success: true, data: config };
  } catch (error: any) {
    console.error(`Error updating system config for ${key}:`, error);
    return { success: false, error: error.message || "Failed to update system config" };
  }
}

