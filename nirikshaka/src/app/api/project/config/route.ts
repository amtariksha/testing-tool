import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function OPTIONS() {
  return NextResponse.json({}, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key",
    }
  });
}

export async function GET(req: Request) {
  try {
    const apiKey = req.headers.get("x-api-key");
    const { searchParams } = new URL(req.url);
    const queryProjectId = searchParams.get("projectId");

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

    // Optional validation: match project ID if provided by query parameters
    if (queryProjectId && project.id !== queryProjectId) {
      return NextResponse.json({ error: "Project ID mismatch" }, { status: 403 });
    }

    // Return the feature configurations
    return NextResponse.json({
      success: true,
      enableCrashReporting: project.enableCrashReporting,
      enableNetworkTracking: project.enableNetworkTracking,
      enableUIErrorTracking: project.enableUIErrorTracking,
      enableBreadcrumbs: project.enableBreadcrumbs,
      enableLifecycleTracking: project.enableLifecycleTracking,
      enableJourneyTracking: project.enableJourneyTracking,
      enableScreenshotDetection: project.enableScreenshotDetection,
      isSuspended: project.isSuspended,
      monthlyEventLimit: project.monthlyEventLimit,
      monthlyEventCount: project.monthlyEventCount,
    }, {
      headers: {
        "Access-Control-Allow-Origin": "*",
      }
    });
  } catch (error: any) {
    console.error("Config fetch failed:", error?.message || error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error?.message },
      { status: 500 }
    );
  }
}
