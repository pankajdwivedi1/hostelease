import { NextRequest, NextResponse } from "next/server";
import path from "path";

export const dynamic = "force-dynamic";

// Runtime-only state
let faceapi: any = null;
let modelsLoaded = false;

async function initializeFaceAPI() {
    if (faceapi) return faceapi;

    // Polyfill TextEncoder for Node environment
    if (typeof TextEncoder === 'undefined') {
        const { TextEncoder, TextDecoder } = require('util');
        (global as any).TextEncoder = TextEncoder;
        (global as any).TextDecoder = TextDecoder;
    }

    // Dynamic import to prevent build-time loading
    const faceapiModule = await import("@vladmandic/face-api");
    faceapi = faceapiModule;

    // Setup canvas for Node environment
    const { Canvas, Image, ImageData } = require('canvas');
    faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

    return faceapi;
}

async function loadServerModels() {
    if (modelsLoaded) return;

    const api = await initializeFaceAPI();
    const modelPath = path.join(process.cwd(), 'public', 'models');

    await Promise.all([
        api.nets.ssdMobilenetv1.loadFromDisk(modelPath),
        api.nets.faceLandmark68Net.loadFromDisk(modelPath),
        api.nets.faceRecognitionNet.loadFromDisk(modelPath),
    ]);

    modelsLoaded = true;
    console.log("💎 Server-Side Face Models Loaded (SSD Accuracy)");
}

export async function POST(request: NextRequest) {
    try {
        // Dynamic imports for runtime-only modules
        const { default: connectDB } = await import("@/lib/mongodb");
        const { default: Student } = await import("@/models/Student");

        await connectDB();
        const { image, firebaseUID } = await request.json();

        if (!image || !firebaseUID) {
            return NextResponse.json({ error: "Missing image or student identification" }, { status: 400 });
        }

        const api = await initializeFaceAPI();
        await loadServerModels();

        // 1. Convert Base64 to Buffer
        const base64Data = image.replace(/^data:image\/\w+;base64,/, "");

        // 2. Decode Image using canvas
        const img = await api.fetchImage(`data:image/jpeg;base64,${base64Data}`);

        // 3. Detect Face on Server (High Accuracy Mode)
        const detection = await api
            .detectSingleFace(img as any)
            .withFaceLandmarks()
            .withFaceDescriptor();

        if (!detection) {
            return NextResponse.json({ success: false, message: "No face detected by server" });
        }

        // 4. Fetch Student's Locked Descriptor
        const student = await Student.findOne({ firebaseUID });
        if (!student || !student.faceDescriptor) {
            return NextResponse.json({ error: "Student profile or face lock-in not found" }, { status: 404 });
        }

        // 5. Compare
        const distance = api.euclideanDistance(
            detection.descriptor,
            new Float32Array(student.faceDescriptor)
        );

        // Score Formula (Standard 0.6 cutoff)
        const score = Math.round(Math.max(0, Math.min(100, 115 - (distance * 75))));

        return NextResponse.json({
            success: true,
            distance,
            score,
            isMatch: score >= 70,
            message: score >= 70 ? "Identity Verified" : "Identity Mismatch"
        });

    } catch (error: any) {
        console.error("❌ Backend Face Match Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
