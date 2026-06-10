import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

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

    const { deviceId, sessionId, pushToken } = body;

    if (!pushToken) {
      return NextResponse.json(
        { error: "pushToken is required" },
        { status: 400 }
      );
    }

    if (!deviceId && !sessionId) {
      return NextResponse.json(
        { error: "deviceId or sessionId is required" },
        { status: 400 }
      );
    }

    const now = new Date();

    // Strategy 1: Update by sessionId (most precise — matches this exact session)
    if (sessionId) {
      const updated = await prisma.userJourney.updateMany({
        where: {
          sessionId,
          projectId: project.id,
        },
        data: {
          pushToken,
          pushTokenUpdatedAt: now,
        },
      });

      if (updated.count > 0) {
        return NextResponse.json(
          { success: true, matched: updated.count, strategy: "sessionId" },
          { headers: { "Access-Control-Allow-Origin": "*" } }
        );
      }
    }

    // Strategy 2: Update by deviceId (matches all sessions for this device)
    if (deviceId) {
      const updated = await prisma.userJourney.updateMany({
        where: {
          deviceId,
          projectId: project.id,
        },
        data: {
          pushToken,
          pushTokenUpdatedAt: now,
        },
      });

      if (updated.count > 0) {
        return NextResponse.json(
          { success: true, matched: updated.count, strategy: "deviceId" },
          { headers: { "Access-Control-Allow-Origin": "*" } }
        );
      }
    }

    // Strategy 3: No matching journey found — this is fine.
    // The push token will be persisted when the journey flush creates/updates
    // the journey record (the journey flush payload includes pushToken).
    return NextResponse.json(
      { success: true, matched: 0, strategy: "deferred" },
      { headers: { "Access-Control-Allow-Origin": "*" } }
    );
  } catch (error: any) {
    console.error("Push token track failed:", error?.message || error);
    return NextResponse.json(
      { error: "Invalid payload", details: error?.message },
      { status: 400 }
    );
  }
}
