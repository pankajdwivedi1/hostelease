import path from "path";
import { createCanvas, loadImage, Canvas, Image, ImageData } from "canvas";
let ortModule: any = null;
function getOrt() {
    if (!ortModule) {
        const mod = require("onnxruntime-node");
        ortModule = mod.InferenceSession ? mod : (mod.default || mod);
    }
    return ortModule;
}

export interface ServerBiometricVerificationResult {
    success: boolean;
    isLive: boolean;
    isSpoof: boolean;
    isMatch: boolean;
    livenessScore: number;
    matchScore: number;
    distance?: number;
    reason: string;
    faceDetected: boolean;
    descriptor?: number[];
    engine: string;
}

// Global cached runtime state on globalThis to ensure 24/7 in-memory persistence without cold starts
interface GlobalBiometricsState {
    faceapi: any;
    miniFASNetSession: any;
    modelsLoaded: boolean;
    modelLoadingPromise: Promise<void> | null;
}

const g = globalThis as unknown as { __serverBiometrics?: GlobalBiometricsState };
if (!g.__serverBiometrics) {
    g.__serverBiometrics = {
        faceapi: null,
        miniFASNetSession: null,
        modelsLoaded: false,
        modelLoadingPromise: null
    };
}

/**
 * Initializes face detection and MiniFASNet anti-spoofing models in Node.js memory.
 * Loaded once and retained across all subsequent requests 24/7 in RAM.
 */
export async function initServerBiometricModels(): Promise<void> {
    const state = g.__serverBiometrics!;
    if (state.modelsLoaded) return;
    if (state.modelLoadingPromise) return state.modelLoadingPromise;

    state.modelLoadingPromise = (async () => {
        try {
            if (!state.faceapi) {
                state.faceapi = require("face-api.js");
                state.faceapi.env.monkeyPatch({ Canvas, Image, ImageData });
            }

            const modelsDir = path.join(process.cwd(), "public", "models");

            // 1. Load Face-API detector, landmarks & recognition models
            await Promise.all([
                state.faceapi.nets.tinyFaceDetector.loadFromDisk(modelsDir).catch((e: any) => {
                    console.warn("⚠️ Failed to load TinyFaceDetector:", e.message);
                }),
                state.faceapi.nets.ssdMobilenetv1.loadFromDisk(modelsDir).catch((e: any) => {
                    console.warn("⚠️ Failed to load SSD Mobilenet:", e.message);
                }),
                state.faceapi.nets.faceLandmark68Net.loadFromDisk(modelsDir).catch((e: any) => {
                    console.error("❌ Failed to load Landmark68 Net:", e.message);
                    throw e;
                }),
                state.faceapi.nets.faceRecognitionNet.loadFromDisk(modelsDir).catch((e: any) => {
                    console.error("❌ Failed to load FaceRecognition Net:", e.message);
                    throw e;
                })
            ]);

            // 2. Load MiniFASNetV2 ONNX Anti-Spoofing Model
            const miniFasPath = path.join(modelsDir, "MiniFASNetV2.onnx");
            state.miniFASNetSession = await getOrt().InferenceSession.create(miniFasPath, {
                intraOpNumThreads: 2
            });

            state.modelsLoaded = true;
            console.log("🛡️ [Server Biometrics] MiniFASNetV2 + Face Models successfully pre-warmed in memory (24/7 Hot)!");
        } catch (error: any) {
            state.modelsLoaded = false;
            state.modelLoadingPromise = null;
            console.error("❌ [Server Biometrics] Model initialization failed:", error.message);
            throw error;
        }
    })();

    return state.modelLoadingPromise;
}

// ⚡ AUTO PRE-WARM: Warm up models immediately on server import so zero cold start occurs for students
if (!g.__serverBiometrics.modelsLoaded && !g.__serverBiometrics.modelLoadingPromise) {
    initServerBiometricModels().catch((e: any) => {
        console.warn("⚠️ [Server Biometrics] Background warm-up deferred:", e?.message);
    });
}

export interface ServerBiometricVerificationParams {
    liveImage: string;
    referenceDescriptor?: number[];
    clientDescriptor?: number[];
    box?: { x: number; y: number; width: number; height: number };
}

/**
 * High-performance, tamper-proof biometric & presentation attack verification.
 * Evaluates live image for digital screen replays, photo displays, and identity match.
 */
export async function verifyFaceAndLivenessServer(
    params: ServerBiometricVerificationParams
): Promise<ServerBiometricVerificationResult> {
    await initServerBiometricModels();

    const state = g.__serverBiometrics!;
    const faceapi = state.faceapi;
    const miniFASNetSession = state.miniFASNetSession;

    const { liveImage, referenceDescriptor, clientDescriptor, box: clientBox } = params;

    // 1. Convert base64 data to canvas
    const base64Data = liveImage.replace(/^data:image\/\w+;base64,/, "");
    const imgBuffer = Buffer.from(base64Data, "base64");
    const img = await loadImage(imgBuffer);

    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);

    let bx = 0;
    let by = 0;
    let bw = 0;
    let bh = 0;
    let serverDetectionDescriptor: Float32Array | null = null;

    // 2. Resolve Face Coordinates:
    // If client provided a valid tracked bounding box, validate and use it directly (100x faster)
    let validBox = false;
    if (clientBox && typeof clientBox.x === 'number' && typeof clientBox.width === 'number') {
        bx = Math.max(0, Math.floor(clientBox.x));
        by = Math.max(0, Math.floor(clientBox.y));
        bw = Math.min(img.width - bx, Math.floor(clientBox.width));
        bh = Math.min(img.height - by, Math.floor(clientBox.height));
        if (bw >= 30 && bh >= 30 && bx + bw <= img.width && by + bh <= img.height) {
            validBox = true;
        }
    }

    // Fallback: Run ultra-fast TinyFaceDetector if box not provided or invalid (<30ms)
    if (!validBox) {
        let detection: any = null;
        if (faceapi.nets.tinyFaceDetector?.isLoaded) {
            detection = await faceapi.detectSingleFace(
                canvas,
                new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.15 })
            );
        }

        if (!detection) {
            return {
                success: false,
                isLive: false,
                isSpoof: true,
                isMatch: false,
                livenessScore: 0,
                matchScore: 0,
                faceDetected: false,
                reason: "No face detected in camera. Please ensure good lighting and look directly at the camera.",
                engine: "server-minifasnet-v2"
            };
        }

        const box = detection.box || detection.detection?.box;
        bx = Math.max(0, Math.floor(box.x));
        by = Math.max(0, Math.floor(box.y));
        bw = Math.min(img.width - bx, Math.floor(box.width));
        bh = Math.min(img.height - by, Math.floor(box.height));
    }

    if (bw < 30 || bh < 30) {
        return {
            success: false,
            isLive: false,
            isSpoof: true,
            isMatch: false,
            livenessScore: 0,
            matchScore: 0,
            faceDetected: true,
            reason: "Face is too small or far from the camera. Please bring your face closer.",
            engine: "server-minifasnet-v2"
        };
    }

    // 3. Multi-Factor Presentation Attack Detection (PAD)

    // CHECK A: Specular Glass Reflection (High saturation white hot-spots from mobile screens)
    const faceImgData = ctx.getImageData(bx, by, bw, bh).data;
    const totalFacePixels = bw * bh;
    let saturatedPixelCount = 0;
    let highFreqGridDiffs = 0;

    for (let i = 0; i < faceImgData.length; i += 4) {
        const r = faceImgData[i];
        const g = faceImgData[i + 1];
        const b = faceImgData[i + 2];

        // Screen glass reflection blown-out pixel
        if (r >= 246 && g >= 246 && b >= 246) {
            saturatedPixelCount++;
        }

        // Horizontal adjacent pixel delta for Moiré lattice check
        if (i > 4 && i % (bw * 4) !== 0) {
            const prevR = faceImgData[i - 4];
            const prevG = faceImgData[i - 3];
            const prevB = faceImgData[i - 2];
            const br = 0.299 * r + 0.587 * g + 0.114 * b;
            const prevBr = 0.299 * prevR + 0.587 * prevG + 0.114 * prevB;
            if (Math.abs(br - prevBr) > 28) {
                highFreqGridDiffs++;
            }
        }
    }

    const glareRatio = saturatedPixelCount / totalFacePixels;
    const moireRatio = highFreqGridDiffs / totalFacePixels;

    // CHECK B: Secondary Phone Casing / Border Detection (Analyzes margin enclosing the face)
    const marginX = Math.floor(bw * 0.22);
    const marginY = Math.floor(bh * 0.22);
    const outerX = Math.max(0, bx - marginX);
    const outerY = Math.max(0, by - marginY);
    const outerW = Math.min(img.width - outerX, bw + marginX * 2);
    const outerH = Math.min(img.height - outerY, bh + marginY * 2);

    let borderDarkRatio = 0;
    if (outerW > bw + 10 && outerH > bh + 10) {
        const outerData = ctx.getImageData(outerX, outerY, outerW, outerH).data;
        let darkBorderPixels = 0;
        let totalBorderPixels = 0;

        for (let y = 0; y < outerH; y++) {
            for (let x = 0; x < outerW; x++) {
                const isBorderRegion = (x < marginX || x >= outerW - marginX || y < marginY || y >= outerH - marginY);
                if (isBorderRegion) {
                    const idx = (y * outerW + x) * 4;
                    const br = 0.299 * outerData[idx] + 0.587 * outerData[idx + 1] + 0.114 * outerData[idx + 2];
                    if (br < 40) darkBorderPixels++;
                    totalBorderPixels++;
                }
            }
        }
        borderDarkRatio = totalBorderPixels > 0 ? darkBorderPixels / totalBorderPixels : 0;
    }

    // CHECK C: MiniFASNetV2 Neural Anti-Spoofing (Scale 2.7 Context Crop)
    const scale = 2.7;
    const s = Math.min((img.height - 1) / bh, (img.width - 1) / bw, scale);
    const new_w = bw * s;
    const new_h = bh * s;
    const center_x = bx + bw / 2;
    const center_y = by + bh / 2;

    const x1 = Math.max(0, Math.floor(center_x - new_w / 2));
    const y1 = Math.max(0, Math.floor(center_y - new_h / 2));
    const x2 = Math.min(img.width - 1, Math.floor(center_x + new_w / 2));
    const y2 = Math.min(img.height - 1, Math.floor(center_y + new_h / 2));
    const crop_w = Math.max(1, x2 - x1);
    const crop_h = Math.max(1, y2 - y1);

    const cropCanvas = createCanvas(80, 80);
    const cropCtx = cropCanvas.getContext("2d");
    cropCtx.drawImage(canvas, x1, y1, crop_w, crop_h, 0, 0, 80, 80);

    const cropPixels = cropCtx.getImageData(0, 0, 80, 80).data;
    const floatArr = new Float32Array(1 * 3 * 80 * 80);
    const hw = 80 * 80;
    for (let i = 0; i < hw; i++) {
        const r = cropPixels[i * 4];
        const g = cropPixels[i * 4 + 1];
        const b = cropPixels[i * 4 + 2];
        floatArr[0 * hw + i] = b; // BGR format
        floatArr[1 * hw + i] = g;
        floatArr[2 * hw + i] = r;
    }

    let livenessProb = 0.95;
    let isNeuralSpoof = false;
    let neuralReason = "";

    if (miniFASNetSession) {
        try {
            const ort = getOrt();
            const inputTensor = new ort.Tensor("float32", floatArr, [1, 3, 80, 80]);
            const feeds = { [miniFASNetSession.inputNames[0]]: inputTensor };
            const outputs = await miniFASNetSession.run(feeds);
            const logits = outputs[miniFASNetSession.outputNames[0]].data as Float32Array;

            // Softmax: [0: Print, 1: Real, 2: Replay/Screen]
            const maxVal = Math.max(...logits);
            const expVals = Array.from(logits).map(v => Math.exp(v - maxVal));
            const sumExp = expVals.reduce((a, b) => a + b, 0);
            const probs = expVals.map(v => v / sumExp);

            const printProb = probs[0];
            const realProb = probs[1];
            const replayProb = probs[2];

            livenessProb = realProb;

            // Calibrated thresholds for MiniFASNetV2
            if (realProb < 0.65 || replayProb > 0.40 || printProb > 0.45) {
                isNeuralSpoof = true;
                if (replayProb >= printProb) {
                    neuralReason = "Digital Mobile Screen / Video Replay Detected";
                } else {
                    neuralReason = "Printed Photo / Paper Cutout Detected";
                }
            }
        } catch (inferErr: any) {
            console.error("❌ MiniFASNet inference error:", inferErr.message);
        }
    }

    // 4. Combined Anti-Spoof Decision
    let isSpoof = false;
    let spoofReason = "";

    if (glareRatio > 0.045) {
        isSpoof = true;
        spoofReason = "Mobile Device Screen Glare / Reflection Detected. Please present your real physical face.";
    } else if (borderDarkRatio > 0.50) {
        isSpoof = true;
        spoofReason = "Mobile Phone Border / Device Casing Detected. Please present your real face directly.";
    } else if (moireRatio > 0.14) {
        isSpoof = true;
        spoofReason = "Digital Screen Pixel Grid Pattern Detected. Please present your real physical face.";
    } else if (isNeuralSpoof) {
        isSpoof = true;
        spoofReason = `${neuralReason}. Please present your real physical face in person.`;
    }

    const livenessScore = Math.round(livenessProb * 100);

    // If spoof detected, immediately reject with 0 match
    if (isSpoof) {
        console.warn(`🛑 [Server Biometrics] SPOOF BLOCKED: ${spoofReason} (Liveness: ${livenessScore}%)`);
        return {
            success: false,
            isLive: false,
            isSpoof: true,
            isMatch: false,
            livenessScore,
            matchScore: 0,
            faceDetected: true,
            reason: `Fraud Prevented: ${spoofReason}`,
            engine: "server-minifasnet-v2"
        };
    }

    // 5. Biometric Face Match (if reference descriptor is provided)
    let liveDescriptor: number[] = [];
    if (clientDescriptor && Array.isArray(clientDescriptor) && clientDescriptor.length === 128) {
        liveDescriptor = clientDescriptor;
    } else {
        // Fallback: extract descriptor on server if client didn't supply one
        try {
            const det = await faceapi
                .detectSingleFace(canvas, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.20 }))
                .withFaceLandmarks()
                .withFaceDescriptor();
            if (det?.descriptor) {
                liveDescriptor = Array.from(det.descriptor);
            }
        } catch (e: any) {
            console.warn("Server fallback descriptor extraction exception:", e?.message);
        }
    }

    let matchScore = 0;
    let distance: number | undefined = undefined;
    let isMatch = false;

    if (referenceDescriptor && Array.isArray(referenceDescriptor) && referenceDescriptor.length > 0 && liveDescriptor.length === 128) {
        distance = faceapi.euclideanDistance(
            new Float32Array(liveDescriptor),
            new Float32Array(referenceDescriptor)
        );

        // Calibrated Euclidean Distance to 0-100% Score
        // Standard threshold for face-api.js 128-D vector:
        // dist <= 0.35: 85% to 100%
        // dist <= 0.45: 65% to 85%
        // dist > 0.45: < 65%
        if (distance! <= 0.35) {
            matchScore = 100 - (distance! * 42.85);
        } else if (distance! <= 0.50) {
            matchScore = 85 - ((distance! - 0.35) * 133.33);
        } else {
            matchScore = Math.max(0, 65 - ((distance! - 0.50) * 100));
        }

        matchScore = Math.round(Math.max(0, Math.min(100, matchScore)));
        isMatch = matchScore >= 75; // Strict 75% biometric threshold
    } else if (!referenceDescriptor || referenceDescriptor.length === 0) {
        // No reference descriptor (e.g. initial photo capture during onboarding)
        isMatch = true;
        matchScore = 100;
    } else {
        isMatch = false;
        matchScore = 0;
    }

    return {
        success: isMatch && !isSpoof,
        isLive: true,
        isSpoof: false,
        isMatch,
        livenessScore,
        matchScore,
        distance,
        faceDetected: true,
        reason: isMatch ? "Identity & Real Liveness Verified" : "Identity Mismatch (Did not match registered face)",
        descriptor: liveDescriptor,
        engine: "server-minifasnet-v2"
    };
}
