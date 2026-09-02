/**
 * AI Attendance Microservice Client (Hostelease Option B3)
 * Connects Next.js backend with Python ArcFace + MiniFASNet microservice.
 */

export interface AIVerifyResult {
    success: boolean;
    isSpoof: boolean;
    isMatch: boolean;
    score: number;
    distance?: number;
    livenessScore?: number;
    message: string;
    source: 'python-arcface' | 'local-fallback';
}

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://127.0.0.1:8000";
const REQUEST_TIMEOUT_MS = 5000;

export async function verifyFaceWithAIService(params: {
    liveImage: string;
    referenceImage?: string;
    referenceDescriptor?: number[];
}): Promise<AIVerifyResult | null> {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

        const response = await fetch(`${AI_SERVICE_URL}/verify`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                live_image: params.liveImage,
                reference_image: params.referenceImage || null,
                reference_descriptor: params.referenceDescriptor || null,
            }),
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            console.warn(`[AI Service] HTTP error ${response.status} from ${AI_SERVICE_URL}`);
            return null;
        }

        const data = await response.json();

        return {
            success: Boolean(data.success),
            isSpoof: Boolean(data.is_spoof),
            isMatch: Boolean(data.is_match),
            score: Number(data.score || 0),
            distance: data.distance,
            livenessScore: data.liveness_score,
            message: data.message || (data.is_match ? 'Identity Verified' : 'Identity Mismatch'),
            source: 'python-arcface'
        };
    } catch (err: any) {
        // AI service is offline or timeout
        console.warn(`[AI Service] Connection to ${AI_SERVICE_URL} failed or timed out (${err?.message || err}).`);
        return null;
    }
}

export async function checkLivenessWithAIService(image: string): Promise<{ isLive: boolean; isSpoof: boolean; reason: string }> {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

        const response = await fetch(`${AI_SERVICE_URL}/check-liveness`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image }),
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
            const data = await response.json();
            return {
                isLive: Boolean(data.is_live),
                isSpoof: Boolean(data.is_spoof),
                reason: data.reason || (data.is_spoof ? "Screen or photo spoof detected." : "Living human verified.")
            };
        }
    } catch (err: any) {
        console.warn(`[AI Service Liveness] Offline or timed out:`, err?.message || err);
    }
    return { isLive: true, isSpoof: false, reason: "Living human assumed (fallback mode)." };
}

