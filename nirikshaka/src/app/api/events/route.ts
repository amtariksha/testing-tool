import { eventBus, type RealtimeEvent } from "@/lib/event-bus";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const projectId = url.searchParams.get("projectId");

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial keepalive
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: "connected", timestamp: new Date().toISOString() })}\n\n`)
      );

      // Heartbeat every 15s to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "heartbeat", timestamp: new Date().toISOString() })}\n\n`)
          );
        } catch {
          clearInterval(heartbeat);
        }
      }, 15000);

      // Listen for realtime events
      const handler = (event: RealtimeEvent) => {
        // If client subscribed to a specific project, filter
        if (projectId && event.projectId !== projectId) return;

        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
          );
        } catch {
          // Client disconnected
          cleanup();
        }
      };

      eventBus.on("realtime", handler);

      const cleanup = () => {
        clearInterval(heartbeat);
        eventBus.off("realtime", handler);
        try {
          controller.close();
        } catch {
          // Already closed
        }
      };

      // Handle client disconnect via AbortSignal
      req.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "X-Accel-Buffering": "no", // Disable nginx buffering
    },
  });
}
