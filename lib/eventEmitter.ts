import { EventEmitter } from "events";

// Use a global singleton to survive hot-module reloading in Next.js
declare global {
    var __gateEventEmitter: EventEmitter | undefined;
}

export const gateEventEmitter: EventEmitter = global.__gateEventEmitter || new EventEmitter();
gateEventEmitter.setMaxListeners(200);

global.__gateEventEmitter = gateEventEmitter;

export interface GateStatusEvent {
    studentId: string;
    studentStatus: "in" | "out";
    outingType?: "outing" | "leave" | null;
    action?: "checkin" | "checkout" | "manual_in" | "manual_out";
    studentName?: string;
    hostelName?: string;
    roomNumber?: string;
    registrationId?: string;
    phoneNumber?: string;
    profilePicture?: string;
    year?: string | null;
    semester?: string | null;
    timestamp: number;
}

export interface HostelActivityEvent {
    hostelName: string;
    actionType: "ADD" | "DELETE" | "UPDATE" | "ONBOARD";
    studentName: string;
    erpId: string;
    operator: string;
    changeSummary?: string;
    timestamp: number;
}

export function broadcastGateEvent(eventData: Omit<GateStatusEvent, "timestamp"> & { timestamp?: number }) {
    try {
        const payload: GateStatusEvent = {
            ...eventData,
            timestamp: eventData.timestamp || Date.now()
        };
        gateEventEmitter.emit("gate_status_change", payload);
    } catch (err) {
        console.warn("⚠️ Failed to broadcast gate event:", err);
    }
}

export function broadcastHostelActivity(eventData: Omit<HostelActivityEvent, "timestamp"> & { timestamp?: number }) {
    try {
        const payload: HostelActivityEvent = {
            ...eventData,
            timestamp: eventData.timestamp || Date.now()
        };
        gateEventEmitter.emit("hostel_activity", payload);
    } catch (err) {
        console.warn("⚠️ Failed to broadcast hostel activity event:", err);
    }
}
