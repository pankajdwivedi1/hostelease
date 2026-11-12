import crypto from "crypto";

export interface QRLoginSession {
    id: string;
    token: string;
    status: "PENDING" | "APPROVED" | "EXPIRED";
    createdAt: number;
    expiresAt: number;
    approvedBy?: string;
    userAgent?: string;
    ip?: string;
}

const globalQRStore = global as unknown as { __superAdminQRSessions?: Map<string, QRLoginSession> };
if (!globalQRStore.__superAdminQRSessions) {
    globalQRStore.__superAdminQRSessions = new Map<string, QRLoginSession>();
}
export const activeQRSessions = globalQRStore.__superAdminQRSessions;

// Periodic cleanup of expired challenges
if (typeof setInterval !== "undefined") {
    setInterval(() => {
        const now = Date.now();
        for (const [id, session] of activeQRSessions.entries()) {
            if (now > session.expiresAt) {
                activeQRSessions.delete(id);
            }
        }
    }, 15000);
}

/**
 * Creates a new secure 90-second QR login challenge
 */
export function createSuperAdminQRChallenge(metadata?: { userAgent?: string; ip?: string }) {
    const challengeId = "qr_sa_" + crypto.randomBytes(8).toString("hex") + "_" + Date.now().toString(36);
    const token = crypto.randomBytes(16).toString("hex");
    const now = Date.now();
    const expiresAt = now + 90 * 1000; // 90 seconds lifetime

    const sessionData: QRLoginSession = {
        id: challengeId,
        token,
        status: "PENDING",
        createdAt: now,
        expiresAt,
        userAgent: metadata?.userAgent || "",
        ip: metadata?.ip || ""
    };

    activeQRSessions.set(challengeId, sessionData);

    const qrPayload = JSON.stringify({
        app: "hosteleaze-superadmin-qr",
        challengeId,
        token,
        t: now
    });

    return {
        challengeId,
        token,
        qrPayload,
        expiresAt,
        expiresInSeconds: 90
    };
}
