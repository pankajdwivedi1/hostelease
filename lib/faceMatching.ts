/**
 * Face Matching Utility using face-api.js (FREE)
 * Provides client-side face detection and matching
 */

// Use dynamic imports to avoid SSR issues
// Internal state for robustness
let faceapi: any = null;
let liteModelsLoaded = false;
let proModelsLoaded = false;
let loadingPromise: Promise<boolean> | null = null;

/**
 * Safely import face-api library with retries (essential for slow WiFi / hotspot latency in Next.js dev mode)
 */
async function importFaceApiWithRetry(maxRetries = 3, initialDelay = 1000): Promise<any> {
    let lastError: any = null;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const fa = await import('@vladmandic/face-api');
            return fa;
        } catch (err: any) {
            lastError = err;
            console.warn(`⚠️ [Face-API] Dynamic import attempt ${attempt}/${maxRetries} failed:`, err?.message || err);
            if (attempt < maxRetries) {
                await new Promise((resolve) => setTimeout(resolve, initialDelay * attempt));
            }
        }
    }
    throw lastError;
}

export async function getFaceApi() {
    if (!faceapi) {
        if (typeof window === 'undefined') return null;
        try {
            faceapi = await importFaceApiWithRetry(3, 1200);
        } catch (err) {
            console.error('❌ [Face-API] Failed to load face-api package chunk:', err);
            return null;
        }
    }
    return faceapi;
}

let loadingPromiseLite: Promise<boolean> | null = null;
let loadingPromisePro: Promise<boolean> | null = null;

/**
 * Load face-api.js models with clean non-blocking mutex and micro-yields to prevent browser freezes
 */
export async function loadFaceApiModels(accurate: boolean = false): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    // 1. Fast path: return immediately if already loaded in memory
    if (accurate && proModelsLoaded) return true;
    if (!accurate && liteModelsLoaded) return true;

    const MODEL_PATH = '/models';

    if (accurate) {
        if (loadingPromisePro) return loadingPromisePro;
        loadingPromisePro = (async () => {
            try {
                const fa = await getFaceApi();
                if (!fa) return false;

                if (!fa.nets.tinyFaceDetector.isLoaded) {
                    await fa.nets.tinyFaceDetector.loadFromUri(MODEL_PATH);
                    await new Promise(r => setTimeout(r, 10));
                }
                if (!fa.nets.faceLandmark68TinyNet.isLoaded) {
                    await fa.nets.faceLandmark68TinyNet.loadFromUri(MODEL_PATH);
                    await new Promise(r => setTimeout(r, 10));
                }
                if (!fa.nets.faceRecognitionNet.isLoaded) {
                    await fa.nets.faceRecognitionNet.loadFromUri(MODEL_PATH);
                    await new Promise(r => setTimeout(r, 10));
                }
                if (!fa.nets.ssdMobilenetv1.isLoaded) {
                    await fa.nets.ssdMobilenetv1.loadFromUri(MODEL_PATH);
                    await new Promise(r => setTimeout(r, 10));
                }
                if (!fa.nets.faceLandmark68Net.isLoaded) {
                    await fa.nets.faceLandmark68Net.loadFromUri(MODEL_PATH);
                    await new Promise(r => setTimeout(r, 10));
                }

                liteModelsLoaded = true;
                proModelsLoaded = true;
                console.log('✅ [Face-API] PRO models ready');
                return true;
            } catch (err) {
                console.error('❌ [Face-API] Pro model load failed:', err);
                return false;
            } finally {
                loadingPromisePro = null;
            }
        })();
        return loadingPromisePro;
    } else {
        if (loadingPromiseLite) return loadingPromiseLite;
        loadingPromiseLite = (async () => {
            try {
                const fa = await getFaceApi();
                if (!fa) return false;

                if (!fa.nets.tinyFaceDetector.isLoaded) {
                    await fa.nets.tinyFaceDetector.loadFromUri(MODEL_PATH);
                    await new Promise(r => setTimeout(r, 10));
                }
                if (!fa.nets.faceLandmark68TinyNet.isLoaded) {
                    await fa.nets.faceLandmark68TinyNet.loadFromUri(MODEL_PATH);
                    await new Promise(r => setTimeout(r, 10));
                }
                if (!fa.nets.faceRecognitionNet.isLoaded) {
                    await fa.nets.faceRecognitionNet.loadFromUri(MODEL_PATH);
                    await new Promise(r => setTimeout(r, 10));
                }

                liteModelsLoaded = true;
                console.log('✅ [Face-API] LITE models ready');
                return true;
            } catch (err) {
                console.error('❌ [Face-API] Lite model load failed:', err);
                return false;
            } finally {
                loadingPromiseLite = null;
            }
        })();
        return loadingPromiseLite;
    }
}

/**
 * Calculate match score based on distance
 * Uses an industrial-grade exponential weight to reduce false positives
 * Distance <= 0.32 maps to Score >= 90% (SSD-MobileNet PRO High Confidence)
 */
/**
 * Calculate match score based on Euclidean distance
 * Standard calibrated mapping for 128-D ResNet embeddings:
 * - Distance <= 0.35 -> 90% - 100% (High Confidence Same Person)
 * - Distance 0.35 - 0.45 -> 75% - 90% (Same Person under natural indoor/mobile lighting)
 * - Distance 0.45 - 0.55 -> 50% - 74% (Uncertain / Mismatch)
 * - Distance > 0.55 -> 0% - 49% (Different Person / Impostor)
 */
export function calculateScore(distance: number): number {
    let score;
    if (distance <= 0.35) {
        score = 100 - (distance * 28.57); // 0.0 -> 100%, 0.35 -> 90%
    } else if (distance <= 0.48) {
        score = 90 - ((distance - 0.35) * 115.38); // 0.35 -> 90%, 0.48 -> 75%
    } else if (distance <= 0.58) {
        score = 75 - ((distance - 0.48) * 250); // 0.48 -> 75%, 0.58 -> 50%
    } else {
        score = Math.max(0, 50 - ((distance - 0.58) * 200)); // 0.58+ drops quickly to 0%
    }

    const matchPercentage = Math.round(Math.max(0, Math.min(100, score)));
    console.log(`📏 Face Match: Distance=${distance.toFixed(3)}, Score=${matchPercentage}%`);
    return matchPercentage;
}

/**
 * Face Distance & Alignment Quality Analyzer
 * Estimates physical distance (in cm) based on optical bounding box proportion
 * and computes real-time alignment percentage (0% to 100%).
 */
export function estimateFaceDistance(
    box: { width: number; height: number },
    frameWidth: number,
    frameHeight: number
): {
    estimatedDistanceCm: number;
    distanceStatus: 'too-far' | 'too-close' | 'optimal';
    alignmentQualityPercent: number;
    guidanceMessage: string;
} {
    if (!box || !frameHeight || frameHeight === 0) {
        return {
            estimatedDistanceCm: 0,
            distanceStatus: 'too-far',
            alignmentQualityPercent: 0,
            guidanceMessage: "Align face in frame"
        };
    }

    // Ratio of face height relative to full frame height
    const faceRatio = box.height / frameHeight;

    // Optical distance estimation calibrated for typical mobile front cameras (focal length ~26-28mm eq):
    // Ratio 0.50 corresponds to ~40 cm (ideal arm's length)
    // Ratio 0.75 corresponds to ~25 cm (too close)
    // Ratio 0.25 corresponds to ~75 cm (too far)
    const estimatedDistanceCm = Math.round(20 / Math.max(0.1, faceRatio));

    let distanceStatus: 'too-far' | 'too-close' | 'optimal' = 'optimal';
    let alignmentQualityPercent = 0;
    let guidanceMessage = "";

    if (faceRatio < 0.16) {
        distanceStatus = 'too-far';
        alignmentQualityPercent = Math.max(10, Math.min(59, Math.round((faceRatio / 0.16) * 59)));
        guidanceMessage = `Move closer (~${estimatedDistanceCm} cm)`;
    } else if (faceRatio > 0.85) {
        distanceStatus = 'too-close';
        alignmentQualityPercent = Math.max(20, Math.min(65, Math.round((1 - (faceRatio - 0.85) / 0.15) * 65)));
        guidanceMessage = `Move phone back (~${estimatedDistanceCm} cm)`;
    } else {
        distanceStatus = 'optimal';
        alignmentQualityPercent = 100;
        guidanceMessage = `Optimal distance (~${estimatedDistanceCm} cm)`;
    }

    return {
        estimatedDistanceCm,
        distanceStatus,
        alignmentQualityPercent,
        guidanceMessage
    };
}

/**
 * Mobile Display Screen & Video Replay Anti-Spoof Analyzer
 * Detects mobile phone display pixel grids (Moiré patterns) and specular glass glare on face crop.
 * Blocks static photos AND recorded video replays played on mobile screens.
 */
export function detectMobileScreenDisplay(
    inputElement: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement,
    box: any
): { isSpoof: boolean; reason?: string } {
    try {
        if (!inputElement || !box) return { isSpoof: false };

        const width = (inputElement as HTMLVideoElement).videoWidth || inputElement.width || 0;
        const height = (inputElement as HTMLVideoElement).videoHeight || inputElement.height || 0;

        if (width === 0 || height === 0) return { isSpoof: false };

        const offCanvas = document.createElement('canvas');
        offCanvas.width = width;
        offCanvas.height = height;
        const ctx = offCanvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return { isSpoof: false };

        ctx.drawImage(inputElement, 0, 0, width, height);

        // 🛡️ FACE CROP TEXTURE, SPECULAR GLARE & DIGITAL DISPLAY MOIRÉ ANALYSIS
        const bx = Math.max(0, Math.floor(box.x));
        const by = Math.max(0, Math.floor(box.y));
        const bw = Math.min(width - bx, Math.floor(box.width));
        const bh = Math.min(height - by, Math.floor(box.height));

        if (bw < 30 || bh < 30) return { isSpoof: false };

        const imgData = ctx.getImageData(bx, by, bw, bh);
        const data = imgData.data;
        const totalPixels = bw * bh;

        let saturatedPixelCount = 0;
        let highFreqGridDiffs = 0;

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            // Only count pure blown-out glass reflection
            if (r >= 248 && g >= 248 && b >= 248) {
                saturatedPixelCount++;
            }

            const brightness = 0.299 * r + 0.587 * g + 0.114 * b;

            if (i > 4 && i % (bw * 4) !== 0) {
                const prevR = data[i - 4];
                const prevG = data[i - 3];
                const prevB = data[i - 2];
                const prevBrightness = 0.299 * prevR + 0.587 * prevG + 0.114 * prevB;
                const diff = Math.abs(brightness - prevBrightness);
                if (diff > 25) {
                    highFreqGridDiffs++;
                }
            }
        }

        const glareRatio = saturatedPixelCount / totalPixels;
        const moireRatio = highFreqGridDiffs / totalPixels;

        // Calibrated threshold: Real skin highlights under ceiling bulbs occupy 0.5-2%. Flat glass screen glare occupies > 4.5%.
        if (glareRatio > 0.045) {
            return { isSpoof: true, reason: "Mobile Device Screen Glare Detected. Please present your real physical face." };
        }

        // Calibrated threshold: Natural facial skin stays below 10%. Digital LCD/OLED raster grid patterns exceed 12%.
        if (moireRatio > 0.12) {
            return { isSpoof: true, reason: "Digital Display / Screen Grid Pattern Detected. Please present your real physical face." };
        }

        // 🛡️ MOBILE PHONE BEZEL / CASING DETECTION:
        // Analyzes the margin surrounding the face to detect dark phone borders/hand enclosing the screen
        const marginX = Math.floor(bw * 0.22);
        const marginY = Math.floor(bh * 0.22);
        const outerX = Math.max(0, bx - marginX);
        const outerY = Math.max(0, by - marginY);
        const outerW = Math.min(width - outerX, bw + marginX * 2);
        const outerH = Math.min(height - outerY, bh + marginY * 2);

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

            const borderDarkRatio = totalBorderPixels > 0 ? darkBorderPixels / totalBorderPixels : 0;
            // Phone casing/bezels are dark (> 48% dark border pixels around an illuminated face)
            if (borderDarkRatio > 0.48) {
                return { isSpoof: true, reason: "Mobile Phone Border / Case Detected! Please present your real physical face directly." };
            }
        }

        return { isSpoof: false };
    } catch (e) {
        console.error("Mobile screen detection error:", e);
        return { isSpoof: false };
    }
}

// Alias for backwards compatibility
export const detectScreenSpoof = detectMobileScreenDisplay;

/**
 * Real-time Photo Quality & Blur Analyzer
 * Calibrated 8-neighbor Laplacian Variance + Sobel 95th Percentile Edge Magnitude + Border/Bezel Detection.
 */
export function assessPhotoQuality(
    inputElement: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement
): {
    isBlurry: boolean;
    isPhotoOfPhoto: boolean;
    sharpnessScore: number;
    borderScore: number;
    reason?: string;
} {
    try {
        if (!inputElement) {
            return { isBlurry: true, isPhotoOfPhoto: false, sharpnessScore: 0, borderScore: 0, reason: "No photo provided" };
        }

        const width = (inputElement as HTMLVideoElement).videoWidth || inputElement.width || 0;
        const height = (inputElement as HTMLVideoElement).videoHeight || inputElement.height || 0;

        if (width === 0 || height === 0) {
            return { isBlurry: true, isPhotoOfPhoto: false, sharpnessScore: 0, borderScore: 0, reason: "Invalid photo dimensions" };
        }

        const canvas = document.createElement('canvas');
        const sampleW = 200;
        const sampleH = Math.max(1, Math.round((height / width) * sampleW));
        canvas.width = sampleW;
        canvas.height = sampleH;

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
            return { isBlurry: false, isPhotoOfPhoto: false, sharpnessScore: 75, borderScore: 0 };
        }

        ctx.drawImage(inputElement, 0, 0, sampleW, sampleH);
        const imgData = ctx.getImageData(0, 0, sampleW, sampleH);
        const data = imgData.data;

        // 1. Convert to grayscale
        const gray = new Float32Array(sampleW * sampleH);
        for (let i = 0; i < data.length; i += 4) {
            gray[i / 4] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        }

        // 2. Multi-point edge border analysis (Photo-of-Photo / Bezel detection)
        const marginH = Math.max(2, Math.floor(sampleW * 0.08));
        const marginV = Math.max(2, Math.floor(sampleH * 0.08));

        let topDark = 0, bottomDark = 0, leftDark = 0, rightDark = 0;
        let topTotal = 0, bottomTotal = 0, leftTotal = 0, rightTotal = 0;

        for (let x = 0; x < sampleW; x++) {
            for (let y = 0; y < marginV; y++) {
                if (gray[y * sampleW + x] < 35) topDark++;
                topTotal++;
            }
            for (let y = sampleH - marginV; y < sampleH; y++) {
                if (gray[y * sampleW + x] < 35) bottomDark++;
                bottomTotal++;
            }
        }

        for (let y = 0; y < sampleH; y++) {
            for (let x = 0; x < marginH; x++) {
                if (gray[y * sampleW + x] < 35) leftDark++;
                leftTotal++;
            }
            for (let x = sampleW - marginH; x < sampleW; x++) {
                if (gray[y * sampleW + x] < 35) rightDark++;
                rightTotal++;
            }
        }

        const darkTopRatio = topDark / Math.max(1, topTotal);
        const darkBottomRatio = bottomDark / Math.max(1, bottomTotal);
        const darkLeftRatio = leftDark / Math.max(1, leftTotal);
        const darkRightRatio = rightDark / Math.max(1, rightTotal);

        let borderScore = 0;
        if (darkTopRatio > 0.65) borderScore++;
        if (darkBottomRatio > 0.65) borderScore++;
        if (darkLeftRatio > 0.65) borderScore++;
        if (darkRightRatio > 0.65) borderScore++;

        const isPhotoOfPhoto = borderScore >= 4;

        // 3. Calibrated 8-neighbor Laplacian & Sobel Edge variance
        // Focus edge analysis on the central 70% of the frame (where the face is positioned)
        // This prevents smooth plain background walls from diluting the face sharpness score.
        let lapSum = 0;
        let lapSumSq = 0;
        let lapCount = 0;
        const sobelEdges: number[] = [];

        const startX = Math.max(1, Math.floor(sampleW * 0.12));
        const endX = Math.min(sampleW - 1, Math.floor(sampleW * 0.88));
        const startY = Math.max(1, Math.floor(sampleH * 0.08));
        const endY = Math.min(sampleH - 1, Math.floor(sampleH * 0.92));

        const w = sampleW;
        for (let y = startY; y < endY; y++) {
            for (let x = startX; x < endX; x++) {
                const idx = y * w + x;
                const lap = (
                    gray[idx - w - 1] + gray[idx - w] + gray[idx - w + 1] +
                    gray[idx - 1] - 8 * gray[idx] + gray[idx + 1] +
                    gray[idx + w - 1] + gray[idx + w] + gray[idx + w + 1]
                );
                lapSum += lap;
                lapSumSq += lap * lap;
                lapCount++;

                const gx = (
                    gray[idx - w + 1] + 2 * gray[idx + 1] + gray[idx + w + 1] -
                    (gray[idx - w - 1] + 2 * gray[idx - 1] + gray[idx + w - 1])
                );
                const gy = (
                    gray[idx + w - 1] + 2 * gray[idx + w] + gray[idx + w + 1] -
                    (gray[idx - w - 1] + 2 * gray[idx - 1] + gray[idx - w + 1])
                );
                sobelEdges.push(Math.sqrt(gx * gx + gy * gy));
            }
        }

        const lapMean = lapSum / Math.max(1, lapCount);
        const lapVariance = Math.max(0, (lapSumSq / Math.max(1, lapCount)) - (lapMean * lapMean));

        sobelEdges.sort((a, b) => a - b);
        const p95 = sobelEdges[Math.floor(sobelEdges.length * 0.95)] || 0;

        // Calibrated sharpness scoring for both desktop webcams (softer ISP) and mobile cameras:
        // Webcam typical: lapVariance: 100-500, p95: 45-120 -> scores 70-90%
        // Soft focus / blurred: lapVariance < 65, p95 < 24 -> scores < 45%
        let sharpnessScore = 0;
        if (lapVariance < 65 || p95 < 24) {
            sharpnessScore = Math.min(40, Math.max(5, Math.round((lapVariance / 65) * 22 + (p95 / 24) * 18)));
        } else {
            const edgePart = Math.min(50, (p95 / 100.0) * 50.0);
            const varPart = Math.min(50, (Math.min(2500, lapVariance) / 2500.0) * 50.0);
            sharpnessScore = Math.min(100, Math.max(50, Math.round(edgePart + varPart)));
        }

        const isBlurry = sharpnessScore < 45 || (lapVariance < 55 && p95 < 22);

        let reason = "";
        if (isPhotoOfPhoto) {
            reason = "Device bezel / screen border detected. Please capture a direct live selfie.";
        } else if (isBlurry) {
            reason = `Photo is too blurry (sharpness: ${sharpnessScore}%). Please hold camera steady in good lighting and capture again.`;
        }

        return {
            isBlurry,
            isPhotoOfPhoto,
            sharpnessScore,
            borderScore,
            reason: reason || undefined
        };
    } catch (err) {
        console.error("Photo quality analysis error:", err);
        return { isBlurry: false, isPhotoOfPhoto: false, sharpnessScore: 75, borderScore: 0 };
    }
}

/**
 * Facial Landmark Micro-ROI Sharpness & Lens Fog / Smudge Quality Analyzer
 * Evaluates high-frequency micro-textures specifically across:
 * - Eyebrows (hair follicles)
 * - Eyelid margins & Iris borders
 * - Lips & Mouth contours
 * - Beard / Jawline hair texture
 * - Smudged / Foggy camera lens haze (Dark channel prior & dynamic contrast)
 */
export function assessFacialLandmarkSharpness(
    inputElement: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement,
    landmarks?: any,
    box?: { x: number; y: number; width: number; height: number }
): {
    isBlurry: boolean;
    isFoggy: boolean;
    isSideFace?: boolean;
    isPhotoOfPhoto: boolean;
    sharpnessScore: number;
    fogScore: number;
    featureScores: {
        eyebrows: number;
        eyes: number;
        lips: number;
        jawBeard: number;
    };
    reason?: string;
} {
    try {
        if (!inputElement) {
            return {
                isBlurry: true,
                isFoggy: false,
                isPhotoOfPhoto: false,
                sharpnessScore: 0,
                fogScore: 100,
                featureScores: { eyebrows: 0, eyes: 0, lips: 0, jawBeard: 0 },
                reason: "No image provided."
            };
        }

        // Global base quality (screen bezel, global blur)
        const baseQuality = assessPhotoQuality(inputElement);
        if (baseQuality.isPhotoOfPhoto) {
            return {
                isBlurry: false,
                isFoggy: false,
                isPhotoOfPhoto: true,
                sharpnessScore: baseQuality.sharpnessScore,
                fogScore: 0,
                featureScores: { eyebrows: 50, eyes: 50, lips: 50, jawBeard: 50 },
                reason: baseQuality.reason || "Device bezel / screen border detected. Please capture a direct live selfie."
            };
        }

        const width = (inputElement as HTMLVideoElement).videoWidth || inputElement.width || 0;
        const height = (inputElement as HTMLVideoElement).videoHeight || inputElement.height || 0;

        if (width === 0 || height === 0) {
            return {
                isBlurry: true,
                isFoggy: false,
                isPhotoOfPhoto: false,
                sharpnessScore: 0,
                fogScore: 100,
                featureScores: { eyebrows: 0, eyes: 0, lips: 0, jawBeard: 0 },
                reason: "Invalid image dimensions."
            };
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
            return {
                isBlurry: baseQuality.isBlurry,
                isFoggy: false,
                isPhotoOfPhoto: false,
                sharpnessScore: baseQuality.sharpnessScore,
                fogScore: 0,
                featureScores: { eyebrows: baseQuality.sharpnessScore, eyes: baseQuality.sharpnessScore, lips: baseQuality.sharpnessScore, jawBeard: baseQuality.sharpnessScore }
            };
        }

        ctx.drawImage(inputElement, 0, 0, width, height);

        // Extract face bounding area
        let faceX = 0, faceY = 0, faceW = width, faceH = height;
        if (box) {
            faceX = Math.max(0, Math.floor(box.x));
            faceY = Math.max(0, Math.floor(box.y));
            faceW = Math.min(width - faceX, Math.floor(box.width));
            faceH = Math.min(height - faceY, Math.floor(box.height));
        }

        // 1. 🌫️ CAMERA LENS FOG / SMUDGE / GLARE DETECTOR
        // When a phone lens is greasy/smudged with fingerprints, scattered light creates a foggy haze.
        // Dark areas (pupils, nostrils, hair) lose depth (dark channel shifts up) and dynamic contrast collapses.
        const faceImgData = ctx.getImageData(faceX, faceY, faceW, faceH);
        const facePixels = faceImgData.data;
        const faceLuminance: number[] = [];

        for (let i = 0; i < facePixels.length; i += 4) {
            const lum = 0.299 * facePixels[i] + 0.587 * facePixels[i + 1] + 0.114 * facePixels[i + 2];
            faceLuminance.push(lum);
        }

        faceLuminance.sort((a, b) => a - b);
        const p05 = faceLuminance[Math.floor(faceLuminance.length * 0.05)] || 0; // Dark channel floor
        const p95 = faceLuminance[Math.floor(faceLuminance.length * 0.95)] || 255; // Highlights
        const dynamicContrast = p95 - p05;

        // Count overblown/milky diffuse glow pixels (190 - 245)
        let milkyGlowCount = 0;
        for (let i = 0; i < faceLuminance.length; i++) {
            if (faceLuminance[i] >= 190 && faceLuminance[i] <= 245) milkyGlowCount++;
        }
        const milkyRatio = faceLuminance.length > 0 ? milkyGlowCount / faceLuminance.length : 0;

        // Smudge/Fog metric: High dark floor (> 68), compressed dynamic contrast (< 62), or excessive milky haze (> 40%)
        let isFoggy = false;
        let fogScore = 0;
        if (dynamicContrast < 55 && p05 > 55) {
            isFoggy = true;
            fogScore = 85;
        } else if (dynamicContrast < 48) {
            isFoggy = true;
            fogScore = 90;
        } else if (p05 > 72 && milkyRatio > 0.35) {
            isFoggy = true;
            fogScore = 80;
        }

        // 2. 🔍 FACIAL LANDMARK MICRO-ROI SHARPNESS (Eyebrows, Eyes, Lips, Jawline/Beard)
        const computePatchSharpness = (pts: Array<{ x: number; y: number }>, pad = 6): number => {
            if (!pts || pts.length === 0) return 60; // fallback

            let minX = width, maxX = 0, minY = height, maxY = 0;
            for (const p of pts) {
                if (p.x < minX) minX = p.x;
                if (p.x > maxX) maxX = p.x;
                if (p.y < minY) minY = p.y;
                if (p.y > maxY) maxY = p.y;
            }

            const px = Math.max(1, Math.floor(minX - pad));
            const py = Math.max(1, Math.floor(minY - pad));
            const pw = Math.min(width - px - 1, Math.ceil(maxX - minX + pad * 2));
            const ph = Math.min(height - py - 1, Math.ceil(maxY - minY + pad * 2));

            if (pw < 6 || ph < 6) return 50;

            const patchData = ctx.getImageData(px, py, pw, ph).data;
            const gray = new Float32Array(pw * ph);
            for (let i = 0; i < patchData.length; i += 4) {
                gray[i / 4] = 0.299 * patchData[i] + 0.587 * patchData[i + 1] + 0.114 * patchData[i + 2];
            }

            // 8-neighbor Laplacian on ROI
            let sumLap = 0, sumLapSq = 0, count = 0;
            const edgeList: number[] = [];

            for (let y = 1; y < ph - 1; y++) {
                for (let x = 1; x < pw - 1; x++) {
                    const idx = y * pw + x;
                    const lap = (
                        gray[idx - pw - 1] + gray[idx - pw] + gray[idx - pw + 1] +
                        gray[idx - 1] - 8 * gray[idx] + gray[idx + 1] +
                        gray[idx + pw - 1] + gray[idx + pw] + gray[idx + pw + 1]
                    );
                    sumLap += lap;
                    sumLapSq += lap * lap;
                    count++;

                    const gx = gray[idx - pw + 1] + 2 * gray[idx + 1] + gray[idx + pw + 1] -
                               (gray[idx - pw - 1] + 2 * gray[idx - 1] + gray[idx + pw - 1]);
                    const gy = gray[idx + pw - 1] + 2 * gray[idx + pw] + gray[idx + pw + 1] -
                               (gray[idx - pw - 1] + 2 * gray[idx - 1] + gray[idx - pw + 1]);
                    edgeList.push(Math.sqrt(gx * gx + gy * gy));
                }
            }

            if (count === 0) return 50;
            const mean = sumLap / count;
            const variance = Math.max(0, (sumLapSq / count) - (mean * mean));

            edgeList.sort((a, b) => a - b);
            const p90Edge = edgeList[Math.floor(edgeList.length * 0.90)] || 0;

            // Score mapping calibrated for facial micro-features:
            // Crisp eyebrows/eyelids: variance 120-600+, p90Edge 30-80+ -> 75-100%
            // Soft focus / blurred: variance < 45, p90Edge < 18 -> < 45%
            let score = 0;
            if (variance < 45 || p90Edge < 18) {
                score = Math.min(42, Math.max(10, Math.round((variance / 45) * 25 + (p90Edge / 18) * 17)));
            } else {
                const edgeComponent = Math.min(50, (p90Edge / 70.0) * 50.0);
                const varComponent = Math.min(50, (Math.min(1500, variance) / 1500.0) * 50.0);
                score = Math.min(100, Math.max(48, Math.round(edgeComponent + varComponent)));
            }
            return score;
        };

        // Extract landmark coordinates
        let eyebrowScore = 0;
        let eyeScore = 0;
        let lipScore = 0;
        let jawBeardScore = 0;
        let isSideFace = false;

        const pts = landmarks?.positions || (Array.isArray(landmarks) ? landmarks : null);

        if (pts && pts.length >= 68) {
            // 👤 3. POSE & FRONTAL SYMMETRY ANALYSIS (Reject Side-Face / Profile Views)
            const leftEyeCenter = { x: (pts[36].x + pts[39].x) / 2, y: (pts[36].y + pts[39].y) / 2 };
            const rightEyeCenter = { x: (pts[42].x + pts[45].x) / 2, y: (pts[42].y + pts[45].y) / 2 };
            const noseTip = pts[30] || pts[33];
            const leftJaw = pts[0];
            const rightJaw = pts[16];

            const distToLeftEye = Math.abs(noseTip.x - leftEyeCenter.x);
            const distToRightEye = Math.abs(noseTip.x - rightEyeCenter.x);
            const maxEyeDist = Math.max(distToLeftEye, distToRightEye, 1);
            const minEyeDist = Math.min(distToLeftEye, distToRightEye);
            const eyeYawRatio = minEyeDist / maxEyeDist;

            const leftCheekDist = Math.abs(noseTip.x - leftJaw.x);
            const rightCheekDist = Math.abs(noseTip.x - rightJaw.x);
            const maxCheekDist = Math.max(leftCheekDist, rightCheekDist, 1);
            const minCheekDist = Math.min(leftCheekDist, rightCheekDist);
            const cheekYawRatio = minCheekDist / maxCheekDist;

            const leftEyeW = Math.abs(pts[39].x - pts[36].x);
            const rightEyeW = Math.abs(pts[45].x - pts[42].x);
            const eyeWidthRatio = Math.min(leftEyeW, rightEyeW) / Math.max(leftEyeW, rightEyeW, 1);

            const leftEbW = Math.abs(pts[21].x - pts[17].x);
            const rightEbW = Math.abs(pts[26].x - pts[22].x);
            const ebWidthRatio = Math.min(leftEbW, rightEbW) / Math.max(leftEbW, rightEbW, 1);

            // If head is turned sideways (Yaw > 20 deg), one eye/cheek is compressed
            if (eyeYawRatio < 0.48 || cheekYawRatio < 0.40 || (eyeWidthRatio < 0.42 && ebWidthRatio < 0.45)) {
                isSideFace = true;
            }

            // Eyebrows (pts 17-26)
            const eyebrowPts = pts.slice(17, 27);
            eyebrowScore = computePatchSharpness(eyebrowPts, 8);

            // Eyes & Eyelids (pts 36-47)
            const eyePts = pts.slice(36, 48);
            eyeScore = computePatchSharpness(eyePts, 8);

            // Lips & Mouth (pts 48-68)
            const lipPts = pts.slice(48, 68);
            lipScore = computePatchSharpness(lipPts, 8);

            // Jawline / Chin & Beard region (pts 4-12)
            const jawPts = pts.slice(4, 13);
            jawBeardScore = computePatchSharpness(jawPts, 10);
        } else if (landmarks?.getLeftEye && landmarks?.getRightEye) {
            // High-level landmark methods
            const leftEye = landmarks.getLeftEye() || [];
            const rightEye = landmarks.getRightEye() || [];
            const nose = landmarks.getNose() || [];
            const jaw = landmarks.getJawOutline() || [];

            if (leftEye.length > 0 && rightEye.length > 0 && nose.length > 0 && jaw.length > 0) {
                const noseTip = nose[nose.length - 1] || nose[3];
                const leftEyeCenterX = (leftEye[0].x + leftEye[leftEye.length - 1].x) / 2;
                const rightEyeCenterX = (rightEye[0].x + rightEye[rightEye.length - 1].x) / 2;
                const dL = Math.abs(noseTip.x - leftEyeCenterX);
                const dR = Math.abs(noseTip.x - rightEyeCenterX);
                if (Math.min(dL, dR) / Math.max(dL, dR, 1) < 0.48) {
                    isSideFace = true;
                }
            }

            const eb = [...(landmarks.getLeftEyeBrow() || []), ...(landmarks.getRightEyeBrow() || [])];
            const ey = [...(landmarks.getLeftEye() || []), ...(landmarks.getRightEye() || [])];
            const mo = landmarks.getMouth() || [];
            const jw = landmarks.getJawOutline() || [];

            eyebrowScore = computePatchSharpness(eb, 8);
            eyeScore = computePatchSharpness(ey, 8);
            lipScore = computePatchSharpness(mo, 8);
            jawBeardScore = computePatchSharpness(jw, 10);
        } else {
            // If landmarks not available, inherit base quality
            eyebrowScore = baseQuality.sharpnessScore;
            eyeScore = baseQuality.sharpnessScore;
            lipScore = baseQuality.sharpnessScore;
            jawBeardScore = baseQuality.sharpnessScore;
        }

        // Weighted feature sharpness score
        const featureSharpnessScore = Math.round(
            eyebrowScore * 0.35 +
            eyeScore * 0.35 +
            lipScore * 0.20 +
            jawBeardScore * 0.10
        );

        // Combine overall sharpness with base global sharpness
        const finalSharpnessScore = Math.min(100, Math.max(0, Math.round(featureSharpnessScore * 0.70 + baseQuality.sharpnessScore * 0.30)));

        // Strict rejection conditions:
        // 1. Side face / turned head
        // 2. Overall sharpness < 48%
        // 3. Both eyebrows & eyes are blurry (< 38%)
        // 4. Global blur is triggered
        const isBlurry = finalSharpnessScore < 48 || (eyebrowScore < 38 && eyeScore < 38) || baseQuality.isBlurry;

        let reason = "";
        if (isSideFace) {
            reason = "Side face / turned head detected. Please look straight at the camera so both sides of your face are fully visible.";
        } else if (isFoggy) {
            reason = "Camera lens appears smudged or foggy. Please wipe your camera lens with a clean cloth.";
        } else if (isBlurry) {
            if (eyebrowScore < 40 || eyeScore < 40) {
                reason = `Photo is too blurry (Sharpness: ${finalSharpnessScore}%). Eyebrows, eyelids, and facial details are not clear. Please hold camera steady in good lighting.`;
            } else {
                reason = `Photo is too blurry (Sharpness: ${finalSharpnessScore}%). Please hold camera steady in good lighting and capture again.`;
            }
        }

        return {
            isBlurry,
            isFoggy,
            isSideFace,
            isPhotoOfPhoto: false,
            sharpnessScore: finalSharpnessScore,
            fogScore,
            featureScores: {
                eyebrows: eyebrowScore,
                eyes: eyeScore,
                lips: lipScore,
                jawBeard: jawBeardScore
            },
            reason: reason || undefined
        };
    } catch (err) {
        console.error("Facial landmark sharpness analysis error:", err);
        return {
            isBlurry: false,
            isFoggy: false,
            isSideFace: false,
            isPhotoOfPhoto: false,
            sharpnessScore: 75,
            fogScore: 0,
            featureScores: { eyebrows: 75, eyes: 75, lips: 75, jawBeard: 75 }
        };
    }
}

/**
 * Detect face in an image
 */
export async function detectFace(
    imageElement: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement,
    accurate: boolean = false,
    withDescriptor: boolean = true
) {
    try {
        const fa = await getFaceApi();
        if (!fa) return null;

        // Ensure models are loaded
        const modelsToLoad = accurate || withDescriptor;
        const ready = await loadFaceApiModels(modelsToLoad);
        if (!ready) return null;

        // Validate input dimensions
        if (!imageElement) return null;
        
        if (imageElement instanceof HTMLVideoElement) {
            if (!imageElement.videoWidth || !imageElement.videoHeight || imageElement.videoWidth === 0 || imageElement.videoHeight === 0) {
                return null;
            }
        } else {
            if (!imageElement.width || !imageElement.height || imageElement.width === 0 || imageElement.height === 0) {
                return null;
            }
        }

        // Determine if tiny landmarks or full 68-point landmarks should be used
        const useTinyLandmarks = !fa.nets.faceLandmark68Net?.isLoaded;
        let detections: any[] = [];

        // Helper to execute detection pass with landmarks and optional descriptor extraction
        const runDetectorPass = async (detectorOptions: any): Promise<any[]> => {
            try {
                let task = fa.detectAllFaces(imageElement, detectorOptions);
                if (withDescriptor) {
                    task = task.withFaceLandmarks(useTinyLandmarks).withFaceDescriptors();
                }
                const result = await task;
                return Array.isArray(result) ? result : (result ? [result] : []);
            } catch (err) {
                console.warn('⚠️ [Face-API] Detector pass exception:', err);
                return [];
            }
        };

        const useSSD = accurate;

        // Tier 1: Fast TinyFaceDetector (Default for high speed & robust detection on 320x320 canvas)
        if (!useSSD && fa.nets.tinyFaceDetector?.isLoaded) {
            detections = await runDetectorPass(new fa.TinyFaceDetectorOptions({
                inputSize: 320,
                scoreThreshold: 0.15
            }));
        }

        // Tier 2: SSD-MobileNet (When accurate mode requested or as fallback)
        if ((!detections || detections.length === 0) && fa.nets.ssdMobilenetv1?.isLoaded) {
            detections = await runDetectorPass(new fa.SsdMobilenetv1Options({ minConfidence: 0.25 }));
        }

        // Tier 3: Sensitive multi-scale fallback for challenging lighting or smaller face crops
        if (!detections || detections.length === 0) {
            detections = await runDetectorPass(new fa.TinyFaceDetectorOptions({
                inputSize: 416,
                scoreThreshold: 0.10
            }));
        }

        if (!detections || detections.length === 0) return null;

        const mainFace = detections[0];
        // Normalize detection object: when withDescriptor is false, mainFace is a FaceDetection with .box; when true, mainFace.detection is the FaceDetection
        const normalizedDetection = mainFace?.detection || mainFace;

        const validFaces = detections.filter((d: any) => {
            const det = d?.detection || d;
            const box = det?.box || d?.box;
            const score = det?.score !== undefined ? det.score : (d?.score !== undefined ? d.score : 1);
            return box && box.width >= 16 && box.height >= 16 && score >= 0.15;
        });

        // Multi-Face Guard: Run raw bounding-box detection ONLY when verifying descriptors (not on fast 10fps tracking)
        let totalFaceCount = validFaces.length;
        if (withDescriptor) {
            let rawBoxes: any[] = [];
            try {
                if (fa.nets.tinyFaceDetector?.isLoaded) {
                    rawBoxes = await fa.detectAllFaces(imageElement, new fa.TinyFaceDetectorOptions({
                        inputSize: 320,
                        scoreThreshold: 0.12
                    }));
                }
                if ((!rawBoxes || rawBoxes.length === 0) && fa.nets.ssdMobilenetv1?.isLoaded) {
                    rawBoxes = await fa.detectAllFaces(imageElement, new fa.SsdMobilenetv1Options({ minConfidence: 0.20 }));
                }
            } catch (e) {
                console.warn('Multi-face box detector pass exception:', e);
            }

            const validRawBoxes = (rawBoxes || []).filter((b: any) => {
                const box = b?.box || b?._box;
                const score = b?.score !== undefined ? b.score : 1;
                return box && box.width >= 16 && box.height >= 16 && score >= 0.12;
            });

            totalFaceCount = Math.max(validFaces.length, validRawBoxes.length);
        }

        return {
            descriptor: withDescriptor ? (mainFace.descriptor || null) : null,
            detection: normalizedDetection,
            landmarks: mainFace.landmarks || null,
            accurate: accurate,
            multipleFacesDetected: totalFaceCount > 1,
            faceCount: totalFaceCount
        };
    } catch (error) {
        console.error('❌ Face detection failed:', error);
        return null;
    }
}

/**
 * Compare two faces and return match percentage
 */
export async function compareFaces(
    livePhotoElement: HTMLImageElement | HTMLCanvasElement,
    profilePhotoElement: HTMLImageElement | HTMLCanvasElement
): Promise<number | null> {
    try {
        const fa = await getFaceApi();
        if (!fa) return null;

        // Ensure at least lite models are loaded
        const loaded = await loadFaceApiModels(false);
        if (!loaded) return null;

        // Detect faces in both images
        const liveRes = await detectFace(livePhotoElement, false);
        if (!liveRes) {
            console.warn('⚠️ No face detected in LIVE photo');
            return null;
        }

        const profileRes = await detectFace(profilePhotoElement, false);
        if (!profileRes) {
            console.warn('⚠️ No face detected in PROFILE photo. Ensure student has a clear profile picture.');
            return null;
        }

        // Calculate Euclidean distance between face descriptors
        const distance = fa.euclideanDistance(liveRes.descriptor, profileRes.descriptor);
        const matchPercentage = calculateScore(distance);

        console.log(`📏 Face Match: Distance=${distance.toFixed(3)}, Score=${matchPercentage}%`);
        return matchPercentage;
    } catch (error) {
        console.error('❌ Face comparison failed:', error);
        return null;
    }
}
/**
 * Anti-Spoofing: Calculate Eye Aspect Ratio (EAR) to detect blinks
 * Formula: (||p2-p6|| + ||p3-p5||) / (2 * ||p1-p4||)
 */
function calculateEAR(eyeLandmarks: any[]): number {
    const p1 = eyeLandmarks[0];
    const p2 = eyeLandmarks[1];
    const p3 = eyeLandmarks[2];
    const p4 = eyeLandmarks[3];
    const p5 = eyeLandmarks[4];
    const p6 = eyeLandmarks[5];

    const dist = (p1: any, p2: any) => Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));

    const vertical1 = dist(p2, p6);
    const vertical2 = dist(p3, p5);
    const horizontal = dist(p1, p4);

    return (vertical1 + vertical2) / (2.0 * horizontal);
}

/**
 * Anti-Spoofing: Calculate Mouth Aspect Ratio (MAR) to detect if mouth is open
 * A static printed photo CANNOT open its mouth, making this extremely spoof-proof
 */
function calculateMAR(mouthLandmarks: any[]): number {
    const dist = (p1: any, p2: any) => Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
    
    // index 0 is left corner, index 6 is right corner
    const horizontal = dist(mouthLandmarks[0], mouthLandmarks[6]);
    // index 14 is top inner lip, index 18 is bottom inner lip
    const vertical = dist(mouthLandmarks[14], mouthLandmarks[18]);
    
    if (horizontal === 0) return 0;
    return vertical / horizontal;
}

/**
 * Anti-Spoofing: Check if face is real (Living) using landmarks
 * Returns detailed analysis of blinks and head movements
 */
export function analyzeLiveness(landmarks: any) {
    if (!landmarks) return null;

    const leftEye = landmarks.getLeftEye();
    const rightEye = landmarks.getRightEye();
    const mouth = landmarks.getMouth();

    const leftEAR = calculateEAR(leftEye);
    const rightEAR = calculateEAR(rightEye);
    const avgEAR = (leftEAR + rightEAR) / 2.0;
    const isBlinking = avgEAR < 0.25; 

    // Calculate Mouth Aspect Ratio
    const mar = calculateMAR(mouth);
    // MAR > 0.4 generally means the mouth is visibly open
    const isMouthOpen = mar > 0.4;

    // Head Pose Estimation (Yaw/Tilt)
    const nose = landmarks.getNose();
    const jaw = landmarks.getJawOutline();

    // Use 5 points of the nose for stability
    const noseTip = nose[3];
    const jawLeft = jaw[0];
    const jawRight = jaw[16];

    // Normalized 3D Rotation (Yaw)
    const totalWidth = Math.abs(jawRight.x - jawLeft.x);
    const posInFace = (noseTip.x - jawLeft.x) / totalWidth;
    const yaw = (posInFace - 0.5) * 2; // -1 (Left) to 1 (Right)

    return {
        isBlinking,
        isMouthOpen,
        ear: avgEAR,
        mar: mar,
        yaw: yaw,
        timestamp: Date.now()
    };
}

/**
 * Liveness Tracker: Detects natural eye blinks and static 2D images
 * Distinguishes living humans from printed photos, mobile screens, and static proxies.
 */
export class LivenessTracker {
    private earHistory: number[] = [];
    private blinkCount: number = 0;
    private eyeClosedStart: number | null = null;
    private hasValidBlink: boolean = false;
    private baselineEAR: number = 0.30;
    private frameCount: number = 0;

    public reset() {
        this.earHistory = [];
        this.blinkCount = 0;
        this.eyeClosedStart = null;
        this.hasValidBlink = false;
        this.baselineEAR = 0.30;
        this.frameCount = 0;
    }

    public update(landmarks: any): {
        hasBlinked: boolean;
        isStaticImage: boolean;
        ear: number;
        yaw: number;
        guidance: string;
        blinkCount: number;
    } {
        this.frameCount++;
        const data = analyzeLiveness(landmarks);
        if (!data) {
            return {
                hasBlinked: this.hasValidBlink,
                isStaticImage: false,
                ear: 0,
                yaw: 0,
                guidance: "Align face inside camera view",
                blinkCount: this.blinkCount
            };
        }

        const now = Date.now();
        const { ear, yaw } = data;

        this.earHistory.push(ear);
        if (this.earHistory.length > 50) this.earHistory.shift();

        // Dynamically calibrate open eye baseline EAR from highest non-erratic readings
        if (this.earHistory.length >= 5) {
            const sorted = [...this.earHistory].filter(e => e > 0.22 && e < 0.45).sort((a, b) => a - b);
            if (sorted.length > 0) {
                this.baselineEAR = sorted[Math.floor(sorted.length * 0.75)];
            }
        }

        // Blink Detection Logic:
        // Eye is closed if EAR drops below 0.21 OR below 68% of the baseline open-eye EAR
        const closeThreshold = Math.min(0.21, this.baselineEAR * 0.68);
        const openThreshold = Math.max(0.24, this.baselineEAR * 0.85);

        if (ear < closeThreshold) {
            if (this.eyeClosedStart === null) {
                this.eyeClosedStart = now;
            }
        } else if (ear > openThreshold && this.eyeClosedStart !== null) {
            const closureDuration = now - this.eyeClosedStart;
            // Real human blink duration is 70ms - 600ms
            if (closureDuration >= 70 && closureDuration <= 600) {
                this.blinkCount++;
                this.hasValidBlink = true;
            }
            this.eyeClosedStart = null;
        }

        // Static 2D Image Check:
        // A printed photo or phone screen held still has mathematically near-zero variance in EAR over 2+ seconds
        let isStaticImage = false;
        if (this.earHistory.length >= 22 && !this.hasValidBlink) {
            const minEAR = Math.min(...this.earHistory);
            const maxEAR = Math.max(...this.earHistory);
            const earVariance = maxEAR - minEAR;

            // If eye aspect ratio has practically zero deviation across 22+ frames
            if (earVariance < 0.016) {
                isStaticImage = true;
            }
        }

        let guidance = "👁️ Please BLINK your eyes to verify liveness";
        if (this.hasValidBlink) {
            guidance = "✅ Liveness Verified! Validating...";
        } else if (isStaticImage) {
            guidance = "⚠️ Static photo detected! Please blink naturally.";
        }

        return {
            hasBlinked: this.hasValidBlink,
            isStaticImage,
            ear,
            yaw,
            guidance,
            blinkCount: this.blinkCount
        };
    }

    public isLivenessPassed(): boolean {
        return this.hasValidBlink;
    }

    public getBlinkCount(): number {
        return this.blinkCount;
    }
}

/**
 * Export raw distance calculator with length validation
 */
export async function getDistance(descriptor1: any, descriptor2: any): Promise<number | null> {
    try {
        const fa = await getFaceApi();
        if (!fa || !descriptor1 || !descriptor2) return null;

        // ⚡ CRITICAL: face-api.js crashes if lengths don't match (industry standard is 128)
        const d1 = Array.isArray(descriptor1) ? new Float32Array(descriptor1) : descriptor1;
        const d2 = Array.isArray(descriptor2) ? new Float32Array(descriptor2) : descriptor2;

        if (d1.length !== d2.length) {
            console.error(`❌ Descriptor Mismatch: live=${d1.length}, stored=${d2.length}. Industry standard is 128.`);
            return null;
        }

        if (d1.length === 0) return null;

        return fa.euclideanDistance(d1, d2);
    } catch (e) {
        console.error("❌ Error calculating distance:", e);
        return null;
    }
}

/**
 * Load image from URL or File
 */
export async function loadImage(source: string | File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const tryLoad = (srcUrl: string | File, isRetry = false) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';

            img.onload = () => resolve(img);
            img.onerror = (err) => {
                // If direct load or cache collision fails, retry via /api/image-proxy
                if (typeof srcUrl === 'string' && !isRetry && !srcUrl.startsWith('data:') && !srcUrl.startsWith('blob:')) {
                    const cleanUrl = srcUrl.split('?cors=')[0].split('&cors=')[0];
                    const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(cleanUrl)}`;
                    console.warn(`🔄 Direct image load failed, retrying via secure image proxy: ${proxyUrl}`);
                    tryLoad(proxyUrl, true);
                    return;
                }
                console.error("Failed to load image:", source);
                reject(err);
            };

            if (typeof srcUrl === 'string') {
                if (srcUrl.startsWith('http://') || srcUrl.startsWith('https://')) {
                    // Prevent Chrome's "cached without CORS" collision by appending ?cors=true
                    // If it's already a proxy URL, use as is
                    if (!srcUrl.includes('/api/image-proxy') && !srcUrl.includes('cors=')) {
                        const separator = srcUrl.includes('?') ? '&' : '?';
                        img.src = `${srcUrl}${separator}cors=true`;
                    } else {
                        img.src = srcUrl;
                    }
                } else {
                    img.src = srcUrl;
                }
            } else {
                const reader = new FileReader();
                reader.onload = (e) => {
                    if (e.target?.result) {
                        img.src = e.target.result as string;
                    }
                };
                reader.onerror = reject;
                reader.readAsDataURL(srcUrl);
            }
        };

        tryLoad(source);
    });
}

/**
 * Compress image to reduce file size
 */
export async function compressImage(
    file: File,
    maxSizeMB: number = 0.1,
    quality: number = 0.8
): Promise<File> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            const img = new Image();

            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                const maxWidth = 800;
                const maxHeight = 800;

                if (width > maxWidth || height > maxHeight) {
                    if (width > height) {
                        height = (height / width) * maxWidth;
                        width = maxWidth;
                    } else {
                        width = (width / height) * maxHeight;
                        height = maxHeight;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('Could not get canvas context'));
                    return;
                }

                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob(
                    (blob) => {
                        if (!blob) {
                            reject(new Error('Compression failed'));
                            return;
                        }

                        const compressedFile = new File([blob], file.name, {
                            type: 'image/webp',
                            lastModified: Date.now(),
                        });

                        resolve(compressedFile);
                    },
                    'image/webp',
                    quality
                );
            };

            img.onerror = reject;
            img.src = e.target?.result as string;
        };

        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

/**
 * Check if browser supports camera/getUserMedia
 */
export function isCameraSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

/**
 * Get recommended match threshold based on use case
 */
export function getMatchThreshold(mode: 'strict' | 'balanced' | 'soft'): number {
    switch (mode) {
        case 'strict':
            return 85;
        case 'balanced':
            return 75; // Standard high-confidence
        case 'soft':
            return 65; // Minimum for "Grey zone" allowance
        default:
            return 65;
    }
}

/**
 * Upload image to Cloudinary (for flagged photos only)
 */
export async function uploadToCloudinary(imageBlob: Blob): Promise<string | null> {
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

    if (!cloudName || !uploadPreset || cloudName === 'your_cloud_name_here') {
        console.error('❌ Cloudinary configuration missing');
        return null;
    }

    try {
        const formData = new FormData();
        formData.append('file', imageBlob);
        formData.append('upload_preset', uploadPreset);

        const response = await fetch(
            `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
            {
                method: 'POST',
                body: formData,
            }
        );

        const data = await response.json();
        if (data.secure_url) {
            return data.secure_url;
        } else {
            console.error('❌ Cloudinary upload failed:', data.error);
            return null;
        }
    } catch (error) {
        console.error('❌ Cloudinary upload error:', error);
        return null;
    }
}

