"use server";

import prisma from "@/lib/prisma";
import { resolveUserCompany } from "@/app/dashboard/actions";
import crypto from "crypto";
import http2 from "http2";

export async function getJourneys(
  projectId?: string,
  startDate?: string,
  endDate?: string,
  search?: string,
  page: number = 1,
  limit: number = 20,
  groupByUser: boolean = true,
  eventName?: string
) {
  try {
    const team = await resolveUserCompany();
    const teamProjects = await prisma.project.findMany({
      where: { teamId: team.id },
      select: { id: true }
    });
    const projectIds = teamProjects.map(p => p.id);

    const where: any = {};
    if (projectId) {
      if (!projectIds.includes(projectId)) {
        return { journeys: [], total: 0, totalPages: 0, page: 1 };
      }
      where.projectId = projectId;
    } else {
      where.projectId = { in: projectIds };
    }

    // Date range filter
    if (startDate || endDate) {
      where.startedAt = {};
      if (startDate) where.startedAt.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.startedAt.lte = end;
      }
    }

    // Search by user name, email, mobile, or device ID
    if (search) {
      where.OR = [
        { userName: { contains: search, mode: "insensitive" } },
        { userEmail: { contains: search, mode: "insensitive" } },
        { userMobile: { contains: search, mode: "insensitive" } },
        { deviceId: { contains: search, mode: "insensitive" } },
        { appUserId: { contains: search, mode: "insensitive" } },
      ];
    }

    // Filter by specific custom/other event name
    if (eventName) {
      where.events = {
        some: {
          name: eventName,
        },
      };
    }

    if (groupByUser) {
      // Fetch matching journeys (up to a safety limit of 2000 to group in-memory)
      const allJourneys = await prisma.userJourney.findMany({
        where,
        orderBy: { startedAt: "desc" },
        take: 2000,
        include: {
          _count: {
            select: { events: true },
          },
        },
      });

      const userGroups: { [key: string]: any } = {};

      for (const j of allJourneys) {
        // Compute unique key using CleverTap-like identity hierarchy
        const userKey =
          j.uniqueId ||
          j.appUserId ||
          j.userMobile ||
          j.userEmail ||
          j.deviceId ||
          "anonymous";

        if (!userGroups[userKey]) {
          userGroups[userKey] = {
            id: userKey, // Use userKey as unique ID for rendering React keys
            userKey,
            userName: j.userName || null,
            userEmail: j.userEmail || null,
            userMobile: j.userMobile || null,
            deviceId: j.deviceId,
            platform: j.platform,
            appVersion: j.appVersion,
            startedAt: j.startedAt.toISOString(),
            endedAt: j.endedAt ? j.endedAt.toISOString() : null,
            eventCount: 0,
            sessionCount: 0,
            sessions: [],
            isGrouped: true,
          };
        }

        const group = userGroups[userKey];
        group.eventCount += j._count.events;
        group.sessionCount += 1;

        // If this session is more recent, update display details
        const jStartedTime = j.startedAt.getTime();
        const groupStartedTime = new Date(group.startedAt).getTime();
        if (jStartedTime > groupStartedTime) {
          if (j.userName) group.userName = j.userName;
          if (j.userEmail) group.userEmail = j.userEmail;
          if (j.userMobile) group.userMobile = j.userMobile;
          group.platform = j.platform;
          group.appVersion = j.appVersion;
          group.startedAt = j.startedAt.toISOString();
        }

        // If any session has endedAt === null, the user is active now
        if (j.endedAt === null) {
          group.endedAt = null;
        } else if (group.endedAt !== null) {
          const jEndedTime = j.endedAt.getTime();
          const groupEndedTime = new Date(group.endedAt).getTime();
          if (jEndedTime > groupEndedTime) {
            group.endedAt = j.endedAt.toISOString();
          }
        }

        group.sessions.push({
          id: j.id,
          sessionId: j.sessionId,
          deviceId: j.deviceId,
          startedAt: j.startedAt.toISOString(),
          endedAt: j.endedAt?.toISOString() || null,
          duration: j.duration,
          eventCount: j._count.events,
          platform: j.platform,
          appVersion: j.appVersion,
          screenCount: j.screenCount,
          summary: j.summary,
        });
      }

      // Sort unique users by last active time descending
      const sortedUsers = Object.values(userGroups).sort((a: any, b: any) => {
        return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime();
      });

      const total = sortedUsers.length;
      const paginatedUsers = sortedUsers.slice((page - 1) * limit, page * limit);

      return {
        journeys: paginatedUsers,
        total,
        totalPages: Math.ceil(total / limit),
        page,
      };
    } else {
      // Non-grouped flat list
      const [journeys, total] = await Promise.all([
        prisma.userJourney.findMany({
          where,
          orderBy: { startedAt: "desc" },
          skip: (page - 1) * limit,
          take: limit,
          include: {
            _count: {
              select: { events: true },
            },
          },
        }),
        prisma.userJourney.count({ where }),
      ]);

      return {
        journeys: journeys.map((j) => ({
          ...j,
          startedAt: j.startedAt.toISOString(),
          endedAt: j.endedAt?.toISOString() || null,
          eventCount: j._count.events,
          isGrouped: false,
        })),
        total,
        totalPages: Math.ceil(total / limit),
        page,
      };
    }
  } catch (error) {
    console.error("Failed to fetch journeys:", error);
    return { journeys: [], total: 0, totalPages: 0, page: 1 };
  }
}

export async function getJourneyDetail(journeyId: string) {
  try {
    const team = await resolveUserCompany();

    // Try finding by database id first
    let journey = await prisma.userJourney.findUnique({
      where: { id: journeyId },
      include: {
        events: {
          orderBy: { timestamp: "asc" },
        },
        project: {
          select: { name: true, packageName: true, teamId: true },
        },
      },
    });

    // If not found, fallback to searching by sessionId
    if (!journey) {
      journey = await prisma.userJourney.findUnique({
        where: { sessionId: journeyId },
        include: {
          events: {
            orderBy: { timestamp: "asc" },
          },
          project: {
            select: { name: true, packageName: true, teamId: true },
          },
        },
      });
    }

    if (!journey) return null;

    if (journey.project.teamId !== team.id) {
      return null;
    }

    return {
      ...journey,
      startedAt: journey.startedAt.toISOString(),
      endedAt: journey.endedAt?.toISOString() || null,
      events: journey.events.map((e) => ({
        ...e,
        timestamp: e.timestamp.toISOString(),
      })),
    };
  } catch (error) {
    console.error("Failed to fetch journey detail:", error);
    return null;
  }
}

export async function analyzeJourney(journeyId: string) {
  try {
    const team = await resolveUserCompany();

    // Try finding by database id first
    let journey = await prisma.userJourney.findUnique({
      where: { id: journeyId },
      include: {
        events: {
          orderBy: { timestamp: "asc" },
        },
        project: {
          select: { teamId: true }
        }
      },
    });

    // Fallback to sessionId
    if (!journey) {
      journey = await prisma.userJourney.findUnique({
        where: { sessionId: journeyId },
        include: {
          events: {
            orderBy: { timestamp: "asc" },
          },
          project: {
            select: { teamId: true }
          }
        },
      });
    }

    if (!journey) return { error: "Journey not found" };

    if (journey.project.teamId !== team.id) {
      return { error: "Unauthorized" };
    }

    // Build a concise event timeline for the AI
    const timeline = journey.events.map((e) => ({
      type: e.type,
      name: e.name,
      data: e.data,
      timestamp: e.timestamp.toISOString(),
      duration: e.duration,
    }));

    const userInfo = [
      journey.userName && `Name: ${journey.userName}`,
      journey.userEmail && `Email: ${journey.userEmail}`,
      journey.userMobile && `Mobile: ${journey.userMobile}`,
    ]
      .filter(Boolean)
      .join(", ");

    const prompt = `You are a UX analyst for a mobile/web application. Analyze this user's journey through the app and provide:

1. **Summary**: A 2-3 sentence summary of what the user was trying to accomplish. What were they looking for? What was their intent?

2. **Suggestions**: 3-5 specific, actionable UX improvement suggestions based on this journey. Each suggestion should have:
   - A short title
   - A description of the issue observed
   - A concrete recommendation

User Info: ${userInfo || "Anonymous user"}
Platform: ${journey.platform}
App Version: ${journey.appVersion}
Session Duration: ${journey.duration ? `${journey.duration}s` : "ongoing"}
Total Events: ${journey.events.length}

Journey Timeline:
${JSON.stringify(timeline, null, 2)}

Respond in this exact JSON format:
{
  "summary": "...",
  "suggestions": [
    {
      "title": "...",
      "issue": "...",
      "recommendation": "..."
    }
  ]
}`;

    // Try to call Gemini API
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      // Fallback: generate a basic analysis without AI
      const screenViews = journey.events.filter(
        (e) => e.type === "screen_view"
      );
      const uniqueScreens = [
        ...new Set(screenViews.map((e) => e.name)),
      ];
      const summary = `User visited ${uniqueScreens.length} screens (${uniqueScreens.join(" → ")}) over ${journey.duration || "unknown"} seconds. ${screenViews.length > 5 ? "The user explored extensively, suggesting they were searching for specific content." : "Brief session with focused navigation."}`;

      const suggestions = [
        {
          title: "Track More Events",
          issue: "Limited event data makes it hard to understand user intent fully.",
          recommendation:
            "Add journey tracking to key interactions like button taps, form submissions, and search queries.",
        },
        {
          title: "Monitor Drop-off Points",
          issue: `The user's last screen was "${uniqueScreens[uniqueScreens.length - 1] || "unknown"}".`,
          recommendation:
            "Check if users frequently exit from this screen and optimize its content or add clearer CTAs.",
        },
      ];

      await prisma.userJourney.update({
        where: { id: journeyId },
        data: {
          summary,
          suggestions: suggestions as any,
        },
      });

      return { summary, suggestions, source: "rule-based" };
    }

    // Call Gemini API
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1024,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const result = await response.json();
    const text =
      result.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const analysis = JSON.parse(text);

    // Save analysis to DB
    await prisma.userJourney.update({
      where: { id: journeyId },
      data: {
        summary: analysis.summary || null,
        suggestions: analysis.suggestions || null,
      },
    });

    return { ...analysis, source: "ai" };
  } catch (error: any) {
    console.error("Journey analysis failed:", error?.message || error);
    return { error: error?.message || "Analysis failed" };
  }
}

export async function getJourneyStats(
  projectId?: string,
  startDate?: string,
  endDate?: string,
  eventName?: string
) {
  try {
    const team = await resolveUserCompany();
    const teamProjects = await prisma.project.findMany({
      where: { teamId: team.id },
      select: { id: true }
    });
    const projectIds = teamProjects.map(p => p.id);

    const where: any = {};
    if (projectId) {
      if (!projectIds.includes(projectId)) {
        return {
          totalSessions: 0,
          activeSessions: 0,
          uniqueUsers: 0,
          avgDuration: 0,
          topScreens: [],
        };
      }
      where.projectId = projectId;
    } else {
      where.projectId = { in: projectIds };
    }

    if (startDate || endDate) {
      where.startedAt = {};
      if (startDate) where.startedAt.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.startedAt.lte = end;
      }
    }

    if (eventName) {
      where.events = {
        some: {
          name: eventName,
        },
      };
    }

    const [totalSessions, activeSessions, avgDuration, topScreens] =
      await Promise.all([
        prisma.userJourney.count({ where }),
        prisma.userJourney.count({
          where: { ...where, endedAt: null },
        }),
        prisma.userJourney.aggregate({
          _avg: { duration: true },
          where,
        }),
        prisma.journeyEvent.groupBy({
          by: ["name"],
          where: {
            type: "screen_view",
            journey: {
              projectId: projectId || undefined,
              ...(eventName
                ? {
                    events: {
                      some: {
                        name: eventName,
                      },
                    },
                  }
                : {}),
              ...(startDate || endDate
                ? {
                    startedAt: {
                      ...(startDate ? { gte: new Date(startDate) } : {}),
                      ...(endDate
                        ? {
                            lte: (() => {
                              const end = new Date(endDate);
                              end.setHours(23, 59, 59, 999);
                              return end;
                            })(),
                          }
                        : {}),
                    },
                  }
                : {}),
            },
          },
          _count: { name: true },
          orderBy: { _count: { name: "desc" } },
          take: 10,
        }),
      ]);

    // Get unique users count resolving CleverTap identity hierarchy:
    // uniqueId -> appUserId -> userMobile -> userEmail -> deviceId
    const uniqueUsersList = await prisma.userJourney.findMany({
      where,
      select: {
        uniqueId: true,
        appUserId: true,
        userMobile: true,
        userEmail: true,
        deviceId: true,
      },
    });

    const uniqueUsersSet = new Set(
      uniqueUsersList.map(
        (j) =>
          j.uniqueId ||
          j.appUserId ||
          j.userMobile ||
          j.userEmail ||
          j.deviceId
      )
    );

    return {
      totalSessions,
      activeSessions,
      uniqueUsers: uniqueUsersSet.size,
      avgDuration: Math.round(avgDuration._avg?.duration || 0),
      topScreens: topScreens.map((s) => ({
        name: s.name,
        count: s._count.name,
      })),
    };
  } catch (error) {
    console.error("Failed to fetch journey stats:", error);
    return {
      totalSessions: 0,
      activeSessions: 0,
      uniqueUsers: 0,
      avgDuration: 0,
      topScreens: [],
    };
  }
}

export async function getScreenshotEvents(
  projectId: string,
  startDate?: string,
  endDate?: string
) {
  try {
    const team = await resolveUserCompany();
    const teamProjects = await prisma.project.findMany({
      where: { teamId: team.id },
      select: { id: true }
    });
    const projectIds = teamProjects.map(p => p.id);

    if (!projectIds.includes(projectId)) {
      return [];
    }

    const where: any = {
      journey: {
        projectId: projectId,
      },
      type: "screenshot",
    };

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.timestamp.lte = end;
      }
    }

    const events = await prisma.journeyEvent.findMany({
      where,
      include: {
        journey: {
          select: {
            id: true,
            sessionId: true,
            deviceId: true,
            appUserId: true,
            userName: true,
            userEmail: true,
            userMobile: true,
            uniqueId: true,
            platform: true,
            appVersion: true,
          },
        },
      },
      orderBy: {
        timestamp: "desc",
      },
    });

    return events.map((e) => {
      const dataObj = typeof e.data === "string" ? JSON.parse(e.data) : (e.data as any) || {};
      return {
        id: e.id,
        timestamp: e.timestamp.toISOString(),
        name: e.name,
        screenshotUrl: dataObj?.screenshotUrl || null,
        message: dataObj?.message || "",
        journeyId: e.journeyId,
        journey: e.journey,
      };
    });
  } catch (error) {
    console.error("Failed to fetch screenshot events:", error);
    return [];
  }
}

export async function getCampaignEventStats(projectId: string) {
  try {
    const team = await resolveUserCompany();
    const project = await prisma.project.findFirst({
      where: { id: projectId, teamId: team.id }
    });

    if (!project) {
      throw new Error("Unauthorized");
    }

    const events = await prisma.journeyEvent.findMany({
      where: {
        journey: { projectId },
        OR: [
          { type: "custom" },
          { type: "screen_view" }
        ]
      },
      include: {
        journey: {
          select: {
            id: true,
            sessionId: true,
            deviceId: true,
            appUserId: true,
            userName: true,
            userEmail: true,
            userMobile: true,
            uniqueId: true,
          }
        }
      }
    });

    const statsMap: Record<string, {
      eventName: string;
      eventType: string;
      totalHits: number;
      uniqueUsers: Set<string>;
      sampleUsers: Array<{
        name: string | null;
        email: string | null;
        mobile: string | null;
        id: string;
      }>;
    }> = {};

    for (const event of events) {
      const name = event.name;
      if (!statsMap[name]) {
        statsMap[name] = {
          eventName: name,
          eventType: event.type,
          totalHits: 0,
          uniqueUsers: new Set<string>(),
          sampleUsers: [],
        };
      }

      const item = statsMap[name];
      item.totalHits += 1;

      const userKey =
        event.journey.uniqueId ||
        event.journey.appUserId ||
        event.journey.userMobile ||
        event.journey.userEmail ||
        event.journey.deviceId ||
        "anonymous";

      if (!item.uniqueUsers.has(userKey)) {
        item.uniqueUsers.add(userKey);
        if (item.sampleUsers.length < 5) {
          item.sampleUsers.push({
            id: userKey,
            name: event.journey.userName,
            email: event.journey.userEmail,
            mobile: event.journey.userMobile,
          });
        }
      }
    }

    return Object.values(statsMap).map(s => ({
      eventName: s.eventName,
      eventType: s.eventType,
      totalHits: s.totalHits,
      uniqueCount: s.uniqueUsers.size,
      sampleUsers: s.sampleUsers,
    })).sort((a, b) => b.uniqueCount - a.uniqueCount);

  } catch (error) {
    console.error("Failed to fetch campaign stats:", error);
    return [];
  }
}

export async function sendCampaignNotification(
  projectId: string,
  eventName: string,
  title: string,
  message: string,
  imageUrl?: string,
  redirectScreen?: string
) {
  try {
    const team = await resolveUserCompany();
    const project = await prisma.project.findFirst({
      where: { id: projectId, teamId: team.id }
    });

    if (!project) {
      throw new Error("Unauthorized");
    }

    const journeys = await prisma.userJourney.findMany({
      where: {
        projectId,
        events: {
          some: { name: eventName }
        }
      },
      orderBy: {
        pushTokenUpdatedAt: "desc"
      },
      select: {
        id: true,
        sessionId: true,
        deviceId: true,
        appUserId: true,
        userName: true,
        userEmail: true,
        userMobile: true,
        uniqueId: true,
        platform: true,
        pushToken: true,
      }
    });

    const uniqueUsersMap: Record<string, typeof journeys[0]> = {};
    for (const j of journeys) {
      const userKey =
        j.uniqueId ||
        j.appUserId ||
        j.userMobile ||
        j.userEmail ||
        j.deviceId ||
        "anonymous";

      if (!uniqueUsersMap[userKey] || (!uniqueUsersMap[userKey].pushToken && j.pushToken)) {
        uniqueUsersMap[userKey] = j;
      }
    }

    const targetedUsers = Object.values(uniqueUsersMap);

    console.log(`\n=================== NIRIKSHAKA PUSH CAMPAIGN ===================`);
    console.log(`Campaign Event: ${eventName}`);
    console.log(`Campaign Project: ${project.name} (${project.id})`);
    console.log(`Notification Title: "${title}"`);
    console.log(`Notification Body: "${message}"`);
    console.log(`Image URL: "${imageUrl || "none"}"`);
    console.log(`Targeting ${targetedUsers.length} unique users.`);
    targetedUsers.forEach((u, index) => {
      console.log(`[${index + 1}] User: ${u.userName || "Anonymous"} | Email: ${u.userEmail || "—"} | Mobile: ${u.userMobile || "—"} | Device: ${u.deviceId} (${u.platform})`);
    });
    console.log(`=================================================================\n`);

    // Verify configuration
    const fcmProjectName = project.fcmProjectName;
    const fcmServiceAccount = project.fcmServiceAccount;
    const apnsKeyId = project.apnsKeyId;
    const apnsTeamId = project.apnsTeamId;
    const apnsBundleId = project.apnsBundleId;
    const apnsPrivateKey = project.apnsPrivateKey;
    const apnsUseSandbox = project.apnsUseSandbox;

    const hasFcm = !!(fcmServiceAccount && fcmProjectName);
    const hasApns = !!(apnsPrivateKey && apnsKeyId && apnsTeamId && apnsBundleId);

    if (!hasFcm && !hasApns) {
      return {
        success: true,
        targetedCount: targetedUsers.length,
        mocked: true,
        message: "Neither FCM nor APNs configured for this project. Simulated delivery logged to console.",
        users: targetedUsers.map(u => ({
          id: u.id,
          name: u.userName || "Anonymous",
          email: u.userEmail || null,
          mobile: u.userMobile || null,
          deviceId: u.deviceId,
          platform: u.platform,
        }))
      };
    }

    // Initialize FCM Access Token if needed
    let fcmAccessToken: string | null = null;
    if (hasFcm) {
      try {
        fcmAccessToken = await getFcmAccessToken(fcmServiceAccount!);
      } catch (err: any) {
        console.error("FCM Token exchange failed:", err);
      }
    }

    const results: any[] = [];
    let successCount = 0;
    const usersWithTokens = targetedUsers.filter(u => u.pushToken);

    for (const u of usersWithTokens) {
      const isIos = u.platform?.toLowerCase() === "ios" || u.platform?.toLowerCase() === "flutter_ios";
      
      // Dispatch iOS pushes directly to APNs if configured, else fall back to FCM
      if (isIos && hasApns) {
        // Direct APNs payload format
        const apnsPayload: any = {
          aps: {
            alert: {
              title: title,
              body: message,
            },
            sound: "default",
            badge: 1
          },
          click_action: "FLUTTER_NOTIFICATION_CLICK",
          campaignEvent: eventName,
          redirect_screen: redirectScreen || ""
        };

        if (imageUrl) {
          apnsPayload.aps["mutable-content"] = 1;
          apnsPayload.wzrk_bp = imageUrl;
          apnsPayload.image = imageUrl;
          apnsPayload.image_url = imageUrl;
          apnsPayload.ico = imageUrl;
          apnsPayload.TYPE = "big_image";
          apnsPayload.aps.alert.image = imageUrl;
        }

        const apnsRes = await sendApnsPushNotification(
          apnsPrivateKey!,
          apnsKeyId!,
          apnsTeamId!,
          apnsBundleId!,
          u.pushToken!,
          apnsUseSandbox,
          apnsPayload
        );

        if (apnsRes.success) {
          successCount++;
          results.push({ userId: u.id, status: "success", provider: "apns" });
        } else {
          results.push({ userId: u.id, status: "failed", provider: "apns", error: apnsRes.error });
        }
      } else {
        // FCM delivery path (for Android, or iOS fallback)
        if (!hasFcm || !fcmAccessToken) {
          results.push({ userId: u.id, status: "failed", error: "FCM provider not fully configured / authenticated" });
          continue;
        }

        const fcmDataPayload: any = {
          click_action: "FLUTTER_NOTIFICATION_CLICK",
          campaignEvent: eventName,
          redirect_screen: redirectScreen || ""
        };

        if (imageUrl) {
          fcmDataPayload.wzrk_bp = imageUrl;
          fcmDataPayload.ico = imageUrl;
          fcmDataPayload.TYPE = "big_image";
        }

        const messagePayload = {
          message: {
            token: u.pushToken,
            notification: {
              title: title,
              body: message,
              ...(imageUrl ? { image: imageUrl } : {})
            },
            data: fcmDataPayload
          }
        };

        try {
          const fcmResponse = await fetch(
            `https://fcm.googleapis.com/v1/projects/${fcmProjectName}/messages:send`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${fcmAccessToken}`,
              },
              body: JSON.stringify(messagePayload),
            }
          );

          const responseData = await fcmResponse.json();
          if (fcmResponse.ok) {
            successCount++;
            results.push({ userId: u.id, status: "success", provider: "fcm", messageId: responseData.name });
          } else {
            results.push({ userId: u.id, status: "failed", provider: "fcm", error: responseData.error?.message || responseData.error });
          }
        } catch (err: any) {
          results.push({ userId: u.id, status: "failed", provider: "fcm", error: err.message });
        }
      }
    }

    return {
      success: true,
      targetedCount: targetedUsers.length,
      sentCount: successCount,
      mocked: false,
      users: targetedUsers.map(u => ({
        id: u.id,
        name: u.userName || "Anonymous",
        email: u.userEmail || null,
        mobile: u.userMobile || null,
        deviceId: u.deviceId,
        platform: u.platform,
        hasToken: !!u.pushToken,
      })),
      results
    };

  } catch (error: any) {
    console.error("Failed to send campaign notification:", error);
    return { success: false, error: error.message || "Failed to send notification" };
  }
}

// Helper: base64 url-safe encoder for JWT
function base64url(str: string | Buffer): string {
  const buf = typeof str === "string" ? Buffer.from(str) : str;
  return buf.toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

// Helper: Exchanging Firebase service account credentials for access token
async function getFcmAccessToken(serviceAccountJson: string): Promise<string> {
  const creds = JSON.parse(serviceAccountJson);
  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: creds.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now
  };

  const signatureInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claim))}`;
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(signatureInput);
  const signature = signer.sign(creds.private_key);

  const jwt = `${signatureInput}.${base64url(signature)}`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to exchange JWT: ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  return data.access_token;
}

export async function getProjectEventNames(projectId: string) {
  try {
    const team = await resolveUserCompany();
    const project = await prisma.project.findFirst({
      where: { id: projectId, teamId: team.id },
      select: { id: true }
    });

    if (!project) {
      throw new Error("Unauthorized");
    }

    const events = await prisma.journeyEvent.groupBy({
      by: ["name", "type"],
      where: {
        journey: {
          projectId: projectId
        }
      },
      _count: {
        name: true
      }
    });

    return events.map((e) => ({
      name: e.name,
      type: e.type,
      count: e._count.name,
    })).sort((a, b) => b.count - a.count);
  } catch (error) {
    console.error("Failed to fetch project event names:", error);
    return [];
  }
}

export async function saveProjectFcmCredentials(
  projectId: string,
  fcmServiceAccount: string,
  fcmProjectName: string
) {
  try {
    const team = await resolveUserCompany();
    const project = await prisma.project.findFirst({
      where: { id: projectId, teamId: team.id }
    });

    if (!project) {
      return { success: false, error: "Project not found or unauthorized" };
    }

    try {
      JSON.parse(fcmServiceAccount);
    } catch {
      return { success: false, error: "Invalid JSON format for service account credentials" };
    }

    await prisma.project.update({
      where: { id: projectId },
      data: {
        fcmServiceAccount,
        fcmProjectName
      }
    });

    return { success: true };
  } catch (error: any) {
    console.error("Failed to save FCM credentials:", error);
    return { success: false, error: error.message || "Failed to save credentials" };
  }
}

export async function saveProjectApnsCredentials(
  projectId: string,
  apnsPrivateKey: string,
  apnsKeyId: string,
  apnsTeamId: string,
  apnsBundleId: string,
  apnsUseSandbox: boolean
) {
  try {
    const team = await resolveUserCompany();
    const project = await prisma.project.findFirst({
      where: { id: projectId, teamId: team.id }
    });

    if (!project) {
      return { success: false, error: "Project not found or unauthorized" };
    }

    await prisma.project.update({
      where: { id: projectId },
      data: {
        apnsPrivateKey,
        apnsKeyId,
        apnsTeamId,
        apnsBundleId,
        apnsUseSandbox
      }
    });

    return { success: true };
  } catch (error: any) {
    console.error("Failed to save APNs credentials:", error);
    return { success: false, error: error.message || "Failed to save credentials" };
  }
}

// Helper: Exchanging APNs private key (.p8) for bearer JWT token (ES256)
function generateApnsJwt(privateKey: string, keyId: string, teamId: string): string {
  const header = { alg: "ES256", kid: keyId };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: teamId,
    iat: now
  };

  const signatureInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claim))}`;
  
  // Sign using ECDSA-SHA256 (ES256)
  const signer = crypto.createSign("sha256");
  signer.update(signatureInput);
  
  const signature = signer.sign({
    key: privateKey,
    dsaEncoding: "ieee-p1363"
  });

  return `${signatureInput}.${base64url(signature)}`;
}

// Helper: HTTP/2 request to Apple APNs server
async function sendApnsPushNotification(
  apnsPrivateKey: string,
  apnsKeyId: string,
  apnsTeamId: string,
  apnsBundleId: string,
  deviceToken: string,
  useSandbox: boolean,
  payload: any
): Promise<{ success: boolean; status?: number; error?: string }> {
  return new Promise((resolve) => {
    try {
      const host = useSandbox
        ? "https://api.sandbox.push.apple.com"
        : "https://api.push.apple.com";

      const token = generateApnsJwt(apnsPrivateKey, apnsKeyId, apnsTeamId);
      
      const client = http2.connect(host);

      client.on("error", (err) => {
        resolve({ success: false, error: `HTTP/2 connection error: ${err.message}` });
      });

      client.setTimeout(5000);
      client.on("timeout", () => {
        client.close();
        resolve({ success: false, error: "HTTP/2 connection timeout after 5s" });
      });

      const path = `/3/device/${deviceToken}`;
      const req = client.request({
        ":method": "POST",
        ":path": path,
        "authorization": `bearer ${token}`,
        "apns-topic": apnsBundleId,
        "apns-push-type": "alert",
        "content-type": "application/json",
      });

      let responseData = "";
      let status = 0;

      req.on("response", (headers) => {
        status = headers[":status"] ? Number(headers[":status"]) : 0;
      });

      req.on("data", (chunk) => {
        responseData += chunk;
      });

      req.on("end", () => {
        client.close();
        if (status === 200) {
          resolve({ success: true, status });
        } else {
          try {
            const parsed = JSON.parse(responseData);
            resolve({ success: false, status, error: parsed.reason || responseData });
          } catch {
            resolve({ success: false, status, error: responseData || `HTTP status ${status}` });
          }
        }
      });

      req.on("error", (err) => {
        client.close();
        resolve({ success: false, error: `Request failed: ${err.message}` });
      });

      req.write(JSON.stringify(payload));
      req.end();
    } catch (e: any) {
      resolve({ success: false, error: e.message || "Failed to initialize request" });
    }
  });
}
