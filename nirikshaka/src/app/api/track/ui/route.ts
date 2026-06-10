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

    // Normalize UIErrorType to match Prisma enum
    const validTypes = ["COMPONENT_CRASH", "BUTTON_FAILURE", "RUNTIME_ERROR", "RENDER_ERROR"];
    const errorType = validTypes.includes(body.type) ? body.type : "RUNTIME_ERROR";

    // Insert into DB
    const uiError = await prisma.uIError.create({
      data: {
        type: errorType as any,
        component: body.component || "Unknown",
        message: body.message || "No message provided",
        url: body.url || "/",
        browser: body.browser || body.context?.platform || "unknown",
        browserVersion: body.browserVersion || body.context?.appVersion || "1.0.0",
        os: body.os || body.context?.os || "unknown",
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
      type: "ui_error",
      projectId: project.id,
      data: uiError,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, id: uiError.id }, {
      headers: { "Access-Control-Allow-Origin": "*" }
    });
  } catch (error: any) {
    console.error("UI Error track failed:", error?.message || error);
    return NextResponse.json({ error: "Invalid payload", details: error?.message }, { status: 400 });
  }
}
