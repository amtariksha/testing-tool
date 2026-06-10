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

    // Normalize severity to uppercase to match Prisma enum (CRITICAL, ERROR, WARNING, INFO)
    const severityMap: Record<string, string> = {
      critical: "CRITICAL",
      error: "ERROR",
      warning: "WARNING",
      info: "INFO",
    };
    const rawSeverity = (body.severity || "error").toLowerCase();
    const severity = severityMap[rawSeverity] || "ERROR";

    // Insert into DB
    const crashLog = await prisma.crashLog.create({
      data: {
        title: body.title || "Unknown Error",
        message: body.message || "No message provided",
        stackTrace: body.stackTrace || "",
        severity: severity as any,
        platform: body.context?.platform || "unknown",
        version: body.context?.appVersion || "1.0.0",
        device: body.device || body.context?.device || "unknown",
        os: body.os || body.context?.os || "unknown",
        osVersion: body.osVersion || body.context?.osVersion || "unknown",
        sessionId: body.sessionId || "session_" + Math.random().toString(36).substring(7),
        timestamp: new Date(),
        projectId: project.id,
        count: 1,
        resolved: false,
        screenshotUrl: body.screenshotUrl || null,
        stepsToReproduce: body.stepsToReproduce || null,
      }
    });

    // Update the monthly event count for the project
    await prisma.project.update({
      where: { id: project.id },
      data: { monthlyEventCount: { increment: 1 } },
    });

    // Broadcast to live dashboard
    emitRealtimeEvent({
      type: "crash_log",
      projectId: project.id,
      data: crashLog,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, id: crashLog.id }, {
      headers: { "Access-Control-Allow-Origin": "*" }
    });
  } catch (error: any) {
    console.error("Crash track failed:", error?.message || error);
    return NextResponse.json({ error: "Invalid payload", details: error?.message }, { status: 400 });
  }
}
