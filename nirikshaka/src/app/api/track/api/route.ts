import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { emitRealtimeEvent } from "@/lib/event-bus";
import { encryptString, isEncryptionConfigured } from "@/lib/crypto/envelope";

let warnedNoMasterKey = false;
let warnedBadMasterKey = false;

// Encryption is best-effort defense-in-depth: a missing or malformed master
// key must never drop telemetry, so this fails open to plaintext (loudly —
// and gate:0's encryption check catches it).
function encryptBody(value: unknown, projectId: string): string | undefined {
  if (typeof value !== "string" || value === "") {
    return value as string | undefined;
  }
  if (!isEncryptionConfigured()) {
    if (!warnedNoMasterKey) {
      warnedNoMasterKey = true;
      console.warn(
        "[track/api] NIRIKSHAKA_MASTER_KEY not set — storing bodies as plaintext"
      );
    }
    return value;
  }
  try {
    return encryptString(value, projectId);
  } catch (error) {
    if (!warnedBadMasterKey) {
      warnedBadMasterKey = true;
      console.error(
        "[track/api] encryption failed — storing bodies as plaintext. Check NIRIKSHAKA_MASTER_KEY:",
        error instanceof Error ? error.message : error
      );
    }
    return value;
  }
}

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
        requestBody: encryptBody(body.requestBody, project.id),
        responseBody: encryptBody(body.responseBody, project.id),
      },
    });

    // Update the monthly event count for the project
    await prisma.project.update({
      where: { id: project.id },
      data: { monthlyEventCount: { increment: 1 } },
    });

    // Broadcast to live dashboard — plaintext bodies for the live view;
    // only the at-rest copy is encrypted
    emitRealtimeEvent({
      type: "api_request",
      projectId: project.id,
      data: {
        ...requestLog,
        requestBody: body.requestBody,
        responseBody: body.responseBody,
      },
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, id: requestLog.id }, {
      headers: { "Access-Control-Allow-Origin": "*" }
    });
  } catch (error) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
