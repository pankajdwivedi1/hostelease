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

    try {
        const api = await initializeFaceAPI();
        const modelPath = path.join(process.cwd(), 'public', 'models');

        // ✅ FIX: Add error handling for model loading
        const modelLoadPromises = [
            api.nets.ssdMobilenetv1.loadFromDisk(modelPath).catch((e: any) => {
                console.error('❌ Failed to load SSD Mobilenet model:', e.message);
                throw new Error('Face detection model failed to load');
            }),
            api.nets.faceLandmark68Net.loadFromDisk(modelPath).catch((e: any) => {
                console.error('❌ Failed to load Face Landmark model:', e.message);
                throw new Error('Face landmark model failed to load');
            }),
            api.nets.faceRecognitionNet.loadFromDisk(modelPath).catch((e: any) => {
                console.error('❌ Failed to load Face Recognition model:', e.message);
                throw new Error('Face recognition model failed to load');
            })
        ];

        await Promise.all(modelLoadPromises);
        modelsLoaded = true;
        console.log("💎 Server-Side Face Models Loaded (SSD Accuracy)");
    } catch (error: any) {
        modelsLoaded = false;
        console.error('❌ Critical: Face models failed to load:', error.message);
        throw error;
    }
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

        // ✅ FIX: Wrap face model loading in try-catch
        try {
            const api = await initializeFaceAPI();
            await loadServerModels();

            // 1. Convert Base64 to Buffer
            const base64Data = image.replace(/^data:image\/\w+;base64,/, "");

            // 2. Decode Image using canvas
            // ✅ FIX: Add error handling for image decoding
            let img;
            try {
                img = await api.fetchImage(`data:image/jpeg;base64,${base64Data}`);
            } catch (imgError: any) {
                console.error('❌ Failed to decode image:', imgError.message);
                return NextResponse.json({ 
                    success: false, 
                    message: "Invalid image format. Please provide a valid JPEG or PNG image" 
                }, { status: 400 });
            }

            // 3. Detect Face on Server (High Accuracy Mode)
            // ✅ FIX: Add error handling for face detection
            let detection;
            try {
                detection = await api
                    .detectSingleFace(img as any)
                    .withFaceLandmarks()
                    .withFaceDescriptor();
            } catch (detectionError: any) {
                console.error('❌ Face detection failed:', detectionError.message);
                return NextResponse.json({ 
                    success: false, 
                    message: "Face detection service temporarily unavailable" 
                }, { status: 503 });
            }

            if (!detection) {
                return NextResponse.json({ 
                    success: false, 
                    message: "No face detected. Please take a clear photo with your face visible" 
                }, { status: 400 });
            }

            // 4. Fetch Student's Locked Descriptor (⚡ Optimized: Select only face descriptor)
            const student = await Student.findOne({ firebaseUID }).lean().select('faceDescriptor name');
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
        } catch (modelError: any) {
            console.error('❌ Face recognition system error:', modelError.message);
            return NextResponse.json({
                success: false,
                message: "Face recognition service is temporarily unavailable. Please try again later."
            }, { status: 503 });
        }

    } catch (error: any) {
        console.error("❌ Backend Face Match Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
