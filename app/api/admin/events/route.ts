import { NextRequest } from "next/server";
import { gateEventEmitter, GateStatusEvent, HostelActivityEvent } from "@/lib/eventEmitter";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

// Evaluated once per Railway server container boot/deployment
function getBuildVersion(): string {
    if (process.env.RAILWAY_DEPLOYMENT_ID) return process.env.RAILWAY_DEPLOYMENT_ID;
    if (process.env.RAILWAY_GIT_COMMIT_SHA) return process.env.RAILWAY_GIT_COMMIT_SHA;
    try {
        const buildIdPath = path.join(process.cwd(), ".next", "BUILD_ID");
        if (fs.existsSync(buildIdPath)) {
            return fs.readFileSync(buildIdPath, "utf8").trim();
        }
    } catch (_) {}
    return process.env.BUILD_ID || `deploy-${Date.now()}`;
}

const SERVER_INSTANCE_ID = getBuildVersion();

export async function GET(request: NextRequest) {
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        start(controller) {
            // Send initial connected message & server deployment version
            controller.enqueue(encoder.encode(`event: connected\ndata: ${JSON.stringify({ connected: true, timestamp: Date.now() })}\n\n`));
            controller.enqueue(encoder.encode(`event: system_version\ndata: ${JSON.stringify({ version: SERVER_INSTANCE_ID })}\n\n`));

            // Handler for real-time gate status changes
            const onGateStatusChange = (eventData: GateStatusEvent) => {
                try {
                    const message = `event: gate_status\ndata: ${JSON.stringify(eventData)}\n\n`;
                    controller.enqueue(encoder.encode(message));
                } catch (e) {
                    console.warn("⚠️ Error pushing SSE message:", e);
                }
            };

            // Handler for real-time hostel activity (student edits, adds, deletes, onboards)
            const onHostelActivity = (eventData: HostelActivityEvent) => {
                try {
                    const message = `event: hostel_activity\ndata: ${JSON.stringify(eventData)}\n\n`;
                    controller.enqueue(encoder.encode(message));
                } catch (e) {
                    console.warn("⚠️ Error pushing SSE hostel_activity message:", e);
                }
            };

            const onGateSettingsUpdate = (data: any) => {
                try {
                    controller.enqueue(encoder.encode(`event: gate_settings\ndata: ${JSON.stringify(data)}\n\n`));
                } catch (e) {
                    console.warn("⚠️ Error pushing SSE gate_settings message:", e);
                }
            };

            gateEventEmitter.on("gate_status_change", onGateStatusChange);
            gateEventEmitter.on("hostel_activity", onHostelActivity);
            gateEventEmitter.on("gate_settings_update", onGateSettingsUpdate);

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
                gateEventEmitter.off("hostel_activity", onHostelActivity);
                gateEventEmitter.off("gate_settings_update", onGateSettingsUpdate);
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
