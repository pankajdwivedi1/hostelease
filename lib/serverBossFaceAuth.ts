import path from "path";

import { loadImage, Canvas, Image, ImageData } from "canvas";



// Use lazy global state to retain loaded neural weights across serverless/worker invocations

interface GlobalServerFaceState {

    faceapi: any;

    isInitialized: boolean;

    initPromise: Promise<void> | null;

    lastUsedAt: number;
    cleanupTimer?: any;

}



const g = globalThis as unknown as { __serverFaceAuthState?: GlobalServerFaceState };

if (!g.__serverFaceAuthState) {

    g.__serverFaceAuthState = {

        faceapi: null,

        isInitialized: false,

        initPromise: null,

        lastUsedAt: 0

    };

}



/**

 * Initializes face-api.js models in Node.js server memory.

 * Kept warm 24/7 on Railway with zero cold start for Boss unlock.

 */

export async function initServerFaceAuthModels(): Promise<void> {

    const state = g.__serverFaceAuthState!;

    if (state.isInitialized && state.faceapi) return;

    if (state.initPromise) return state.initPromise;



    state.initPromise = (async () => {

        try {

            const faceapi = require("face-api.js");

            faceapi.env.monkeyPatch({ Canvas, Image, ImageData });



            const modelsDir = path.join(process.cwd(), "public", "models");



            // Load fast tiny networks

            await faceapi.nets.tinyFaceDetector.loadFromDisk(modelsDir);

            await faceapi.nets.faceLandmark68TinyNet.loadFromDisk(modelsDir);

            await faceapi.nets.faceRecognitionNet.loadFromDisk(modelsDir);



            // Also load SSD MobileNet as fallback for difficult angles

            await faceapi.nets.ssdMobilenetv1.loadFromDisk(modelsDir);

            await faceapi.nets.faceLandmark68Net.loadFromDisk(modelsDir);



            state.faceapi = faceapi;

            state.isInitialized = true;
            state.lastUsedAt = Date.now();

            console.log("[Server Boss Face Auth] Neural models loaded into Node.js server memory.");

        } catch (error: any) {

            state.isInitialized = false;

            state.initPromise = null;

            console.error("❌ [Server Boss Face Auth] Model initialization failed:", error?.message || error);

            throw error;

        }

    })();



    return state.initPromise;

}



// Models load lazily on first Boss face auth request




export interface ExtractedFaceBiometrics {

    success: boolean;

    descriptor?: number[];

    box?: {

        x: number;

        y: number;

        width: number;

        height: number;

        canvasWidth: number;

        canvasHeight: number;

    };

    error?: string;

}



/**

 * Extracts 128-D biometric face descriptor directly on the server from raw camera snapshot.

 * Eliminates client-side model downloads (Zero MB downloaded by browser).

 */


function scheduleBossFaceCleanup() {
    const faceState = g.__serverFaceAuthState!;
    if (faceState.cleanupTimer) {
        clearTimeout(faceState.cleanupTimer);
        faceState.cleanupTimer = null;
    }
    const TWO_HOURS = 2 * 60 * 60 * 1000;
    faceState.cleanupTimer = setTimeout(() => {
        if (faceState.isInitialized) {
            console.log("[Server Boss Face Auth] 2 hours idle reached - auto-unloading face models from RAM to save memory.");
            faceState.faceapi = null;
            faceState.isInitialized = false;
            faceState.initPromise = null;
            faceState.lastUsedAt = 0;
            faceState.cleanupTimer = null;
        }
    }, TWO_HOURS);
    if (faceState.cleanupTimer && typeof faceState.cleanupTimer.unref === "function") {
        faceState.cleanupTimer.unref();
    }
}

export async function extractFaceDescriptorServer(

    imageSource: string | Buffer

): Promise<ExtractedFaceBiometrics> {

    try {

        // Lazy unload: free RAM if models unused for more than 2 hours

        const faceState = g.__serverFaceAuthState!;

        const TWO_HOURS = 2 * 60 * 60 * 1000;

        if (faceState.isInitialized && faceState.lastUsedAt > 0 && (Date.now() - faceState.lastUsedAt) > TWO_HOURS) {

            console.log("[Server Boss Face Auth] 2h idle — unloading face models to free RAM.");

            faceState.faceapi = null;

            faceState.isInitialized = false;

            faceState.initPromise = null;

            faceState.lastUsedAt = 0;

        }

        faceState.lastUsedAt = Date.now();

        await initServerFaceAuthModels();

        const faceapi = g.__serverFaceAuthState?.faceapi;

        if (!faceapi) {

            return {

                success: false,

                error: "Server face detection engine is initializing. Please try again in a moment."

            };

        }



        // Convert base64 or buffer into canvas Image

        let imgBuffer: Buffer;

        if (typeof imageSource === "string") {

            const base64Data = imageSource.replace(/^data:image\/\w+;base64,/, "");

            imgBuffer = Buffer.from(base64Data, "base64");

        } else {

            imgBuffer = imageSource;

        }



        const img = await loadImage(imgBuffer);

        const cw = img.width;

        const ch = img.height;



        // Pass 1: Fast TinyFaceDetector (inputSize: 320)

        let detection = await faceapi

            .detectSingleFace(img as any, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.15 }))

            .withFaceLandmarks(true)

            .withFaceDescriptor();



        // Pass 2: High-Resolution TinyFaceDetector (inputSize: 416)

        if (!detection) {

            detection = await faceapi

                .detectSingleFace(img as any, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.10 }))

                .withFaceLandmarks(true)

                .withFaceDescriptor();

        }



        // Pass 3: SSD MobileNet fallback (highest precision)

        if (!detection) {

            detection = await faceapi

                .detectSingleFace(img as any, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.15 }))

                .withFaceLandmarks(false)

                .withFaceDescriptor();

        }



        if (!detection || !detection.descriptor) {

            return {

                success: false,

                error: "No clear face detected in the photo. Please align your face in center lighting and face the camera directly."

            };

        }



        const descriptor = Array.from(detection.descriptor) as number[];

        const box = detection.detection?.box

            ? {

                  x: Math.round(detection.detection.box.x),

                  y: Math.round(detection.detection.box.y),

                  width: Math.round(detection.detection.box.width),

                  height: Math.round(detection.detection.box.height),

                  canvasWidth: cw,

                  canvasHeight: ch

              }

            : undefined;



        return {

            success: true,

            descriptor,

            box

        };

    } catch (err: any) {

        console.error("❌ [Server Boss Face Auth] Extraction error:", err?.message || err);

        return {

            success: false,

            error: "Failed to analyze biometric face vector on server: " + (err?.message || "Unknown error")

        };

    }

}

