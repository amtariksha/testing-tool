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

    // Insert into DB
    const requestLog = await prisma.aPIRequest.create({
      data: {
        method: body.method || "GET",
        path: body.path || "/",
        status: body.status || 200,
        duration: body.duration || 0,
        requestSize: body.requestSize || 0,
        responseSize: body.responseSize || 0,
        ip: req.headers.get("x-forwarded-for") || "unknown",
        userAgent: req.headers.get("user-agent") || "unknown",
        timestamp: new Date(),
        projectId: project.id,
        headers: body.headers || {},
        requestBody: body.requestBody,
        responseBody: body.responseBody,
      },
    });

    // Update the monthly event count for the project
    await prisma.project.update({
      where: { id: project.id },
      data: { monthlyEventCount: { increment: 1 } },
    });

    // Broadcast to live dashboard
    emitRealtimeEvent({
      type: "api_request",
      projectId: project.id,
      data: requestLog,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, id: requestLog.id }, {
      headers: { "Access-Control-Allow-Origin": "*" }
    });
  } catch (error) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
