import { NextRequest } from "next/server";
import { gateEventEmitter, GateStatusEvent } from "@/lib/eventEmitter";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        start(controller) {
            // Send initial connected message
            controller.enqueue(encoder.encode(`event: connected\ndata: ${JSON.stringify({ connected: true, timestamp: Date.now() })}\n\n`));

            // Handler for real-time gate status changes
            const onGateStatusChange = (eventData: GateStatusEvent) => {
                try {
                    const message = `event: gate_status\ndata: ${JSON.stringify(eventData)}\n\n`;
                    controller.enqueue(encoder.encode(message));
                } catch (e) {
                    console.warn("⚠️ Error pushing SSE message:", e);
                }
            };

            gateEventEmitter.on("gate_status_change", onGateStatusChange);

            // Heartbeat ping every 20 seconds to keep connection alive
            const interval = setInterval(() => {
                try {
                    controller.enqueue(encoder.encode(`: ping\n\n`));
                } catch (e) {
                    clearInterval(interval);
                }
            }, 20000);

            // Cleanup when client disconnects
            request.signal.addEventListener("abort", () => {
                clearInterval(interval);
                gateEventEmitter.off("gate_status_change", onGateStatusChange);
                try {
                    controller.close();
                } catch (e) {}
            });
        }
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    });
}
