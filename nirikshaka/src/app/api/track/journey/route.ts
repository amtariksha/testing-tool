import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { emitRealtimeEvent } from "@/lib/event-bus";

export async function OPTIONS() {
  return NextResponse.json({}, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key",
    }
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const apiKey = req.headers.get("x-api-key");

    if (!apiKey) {
      return NextResponse.json({ error: "Missing API Key" }, { status: 401 });
    }

    const apiKeyRecord = await prisma.aPIKey.findUnique({
      where: { key: apiKey },
      include: { project: true }
    });

    if (!apiKeyRecord || !apiKeyRecord.project) {
      return NextResponse.json({ error: "Invalid API Key" }, { status: 401 });
    }
    const project = apiKeyRecord.project;

    if (project.isSuspended) {
      return NextResponse.json({ error: "Project is suspended" }, { status: 403 });
    }

    if (project.monthlyEventCount >= project.monthlyEventLimit) {
      return NextResponse.json({ error: "Project quota exceeded" }, { status: 403 });
    }

    const {
      sessionId,
      deviceId,
      appUserId,
      userName,
      userEmail,
      userMobile,
      uniqueId,
      events = [],
      context = {},
      endSession = false,
      pushToken,
    } = body;

    if (!sessionId || !deviceId) {
      return NextResponse.json(
        { error: "sessionId and deviceId are required" },
        { status: 400 }
      );
    }

    // Find existing journey if any to calculate session statistics
    const existingJourney = await prisma.userJourney.findUnique({
      where: { sessionId },
    });

    const now = new Date();
    const uniqueScreens = new Set(
      events
         .filter((e: any) => e.type === "screen_view")
         .map((e: any) => e.name)
    );

    let journey;
    if (existingJourney) {
      // Calculate duration if ending session
      let durationSec = existingJourney.duration;
      if (endSession) {
        durationSec = Math.floor((now.getTime() - existingJourney.startedAt.getTime()) / 1000);
      }

      journey = await prisma.userJourney.update({
        where: { sessionId },
        data: {
          userName: userName || undefined,
          userEmail: userEmail || undefined,
          userMobile: userMobile || undefined,
          appUserId: appUserId || undefined,
          uniqueId: uniqueId || undefined,
          endedAt: endSession ? now : undefined,
          eventCount: { increment: events.length },
          screenCount: { increment: uniqueScreens.size },
          duration: durationSec ?? undefined,
          pushToken: pushToken || undefined,
          pushTokenUpdatedAt: pushToken ? now : undefined,
        },
      });
    } else {
      journey = await prisma.userJourney.create({
        data: {
          sessionId,
          deviceId,
          appUserId: appUserId || null,
          userName: userName || null,
          userEmail: userEmail || null,
          userMobile: userMobile || null,
          uniqueId: uniqueId || null,
          platform: context.platform || "unknown",
          appVersion: context.appVersion || "1.0.0",
          os: context.os || null,
          osVersion: context.osVersion || null,
          startedAt: now,
          endedAt: endSession ? now : null,
          screenCount: uniqueScreens.size,
          eventCount: events.length,
          projectId: project.id,
          duration: endSession ? 0 : null,
          pushToken: pushToken || null,
          pushTokenUpdatedAt: pushToken ? now : null,
        },
      });
    }

    // Bulk insert journey events
    if (events.length > 0) {
      await prisma.journeyEvent.createMany({
        data: events.map((event: any) => ({
          type: event.type || "custom",
          name: event.name || "Unknown",
          data: event.data || null,
          timestamp: event.timestamp ? new Date(event.timestamp) : now,
          duration: event.duration || null,
          journeyId: journey.id,
        })),
      });

      // Update the monthly event count for the project
      await prisma.project.update({
        where: { id: project.id },
        data: { monthlyEventCount: { increment: events.length } },
      });
    }

    // Broadcast to live dashboard
    emitRealtimeEvent({
      type: "user_journey",
      projectId: project.id,
      data: {
        journeyId: journey.id,
        sessionId,
        deviceId,
        userName,
        userEmail,
        eventCount: events.length,
        endSession,
      },
      timestamp: now.toISOString(),
    });

    return NextResponse.json(
      { success: true, journeyId: journey.id },
      { headers: { "Access-Control-Allow-Origin": "*" } }
    );
  } catch (error: any) {
    console.error("Journey track failed:", error?.message || error);
    return NextResponse.json(
      { error: "Invalid payload", details: error?.message },
      { status: 400 }
    );
  }
}
