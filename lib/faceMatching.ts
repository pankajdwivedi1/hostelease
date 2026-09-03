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

/**
 * Load face-api.js models with industrial-grade locking
 */
export async function loadFaceApiModels(accurate: boolean = false): Promise<boolean> {
    // 1. Check if already loaded
    if (accurate && proModelsLoaded) return true;
    if (!accurate && liteModelsLoaded) return true;

    // 2. If already loading, wait for it
    if (loadingPromise) {
        await loadingPromise;
        // Re-check after waiting
        return loadFaceApiModels(accurate);
    }

    // 3. Start loading
    loadingPromise = (async () => {
        try {
            const fa = await getFaceApi();
            if (!fa) {
                console.warn('⚠️ [Face-API] Cannot load models: face-api module is not available.');
                return false;
            }

            const MODEL_URL = '/models';

            // Always ensure basic models are there
            if (!liteModelsLoaded) {
                await fa.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
                await new Promise(resolve => setTimeout(resolve, 50));
                await fa.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL);
                await new Promise(resolve => setTimeout(resolve, 50));
                await fa.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
                await new Promise(resolve => setTimeout(resolve, 50));
                liteModelsLoaded = true;
            }

            if (accurate && !proModelsLoaded) {
                console.log('💎 Loading High-Accuracy (Pro) Models...');
                await fa.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
                await new Promise(resolve => setTimeout(resolve, 50));
                await fa.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
                await new Promise(resolve => setTimeout(resolve, 50));
                proModelsLoaded = true;
            }

            // Removed WARMUP to prevent synchronous WebGL blocking of the main thread

            console.log(`✅ Face-api models ready and warmed up (${accurate ? 'PRO' : 'LITE'})`);
            return true;
        } catch (error) {
            console.error('❌ Failed to load face-api models.', error);
            return false;
        } finally {
            loadingPromise = null;
        }
    })();

    return loadingPromise;
}

/**
 * Calculate match score based on distance
 * Uses an industrial-grade exponential weight to reduce false positives
 * Distance <= 0.32 maps to Score >= 90% (SSD-MobileNet PRO High Confidence)
 */
export function calculateScore(distance: number): number {
    let score;
    if (distance <= 0.32) {
        score = 100 - (distance * 31.25); // Distance 0.0 -> 100%, 0.32 -> 90%
    } else if (distance <= 0.45) {
        score = 90 - ((distance - 0.32) * 230.7); // Steep drop: 0.32 -> 90%, 0.45 -> 60%
    } else {
        score = Math.max(0, 60 - ((distance - 0.45) * 120)); // 0.45+ drops quickly to 0%
    }

    const matchPercentage = Math.round(Math.max(0, Math.min(100, score)));
    console.log(`📏 Face Match: Distance=${distance.toFixed(3)}, Score=${matchPercentage}%`);
    return matchPercentage;
}

/**
 * Mobile Display Screen & Video Replay Anti-Spoof Analyzer
 * Detects mobile phone display pixel grids (Moiré patterns) and specular glass glare.
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
        const ctx = offCanvas.getContext('2d');
        if (!ctx) return { isSpoof: false };

        ctx.drawImage(inputElement, 0, 0, width, height);

        // 🛡️ CHECK 1: FULL-FRAME DEVICE BEZEL & RECTANGULAR SCREEN BORDER DETECTION
        // When someone holds a phone/tablet, the frame contains dark vertical bezels flanking the face.
        const fullImgData = ctx.getImageData(0, 0, width, height);
        const fullPixels = fullImgData.data;

        // Calculate average column brightness across the entire width
        const colBrightness = new Float32Array(width);
        for (let x = 0; x < width; x++) {
            let colSum = 0;
            for (let y = 0; y < height; y++) {
                const idx = (y * width + x) * 4;
                colSum += 0.299 * fullPixels[idx] + 0.587 * fullPixels[idx + 1] + 0.114 * fullPixels[idx + 2];
            }
            colBrightness[x] = colSum / height;
        }

        // Check for sharp dark bezel drops in the left third and right third of the frame
        const leftThirdEnd = Math.floor(width * 0.35);
        const rightThirdStart = Math.floor(width * 0.65);
        let leftMinBrightness = 255;
        let rightMinBrightness = 255;
        let centerSum = 0;
        let centerCount = 0;

        for (let x = 0; x < width; x++) {
            const b = colBrightness[x];
            if (x < leftThirdEnd && b < leftMinBrightness) leftMinBrightness = b;
            if (x >= rightThirdStart && b < rightMinBrightness) rightMinBrightness = b;
            if (x >= leftThirdEnd && x < rightThirdStart) {
                centerSum += b;
                centerCount++;
            }
        }

        const centerAvg = centerCount > 0 ? centerSum / centerCount : 128;
        const leftDrop = centerAvg - leftMinBrightness;
        const rightDrop = centerAvg - rightMinBrightness;

        // Check for vertical bezel edges (sharp gradient changes)
        let maxLeftGradient = 0;
        let maxRightGradient = 0;
        for (let x = 1; x < width; x++) {
            const grad = Math.abs(colBrightness[x] - colBrightness[x - 1]);
            if (x < leftThirdEnd && grad > maxLeftGradient) maxLeftGradient = grad;
            if (x >= rightThirdStart && grad > maxRightGradient) maxRightGradient = grad;
        }

        const hasFlankingBezels = (leftDrop > 30 && rightDrop > 30) || (maxLeftGradient > 18 && maxRightGradient > 18);
        if (hasFlankingBezels) {
            console.warn(`🛡️ Phone Bezel Detected: leftDrop=${leftDrop.toFixed(1)}, rightDrop=${rightDrop.toFixed(1)}, leftGrad=${maxLeftGradient.toFixed(1)}, rightGrad=${maxRightGradient.toFixed(1)}`);
            return {
                isSpoof: true,
                reason: "Mobile Device Screen / Frame Detected! Photos shown on mobile screens are strictly prohibited."
            };
        }

        // 🛡️ CHECK 2: FACE CROP TEXTURE & SPECULAR GLARE
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

            if (r >= 235 && g >= 235 && b >= 235) {
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

        console.log(`🛡️ Mobile Screen Detector: GlareRatio=${(glareRatio * 100).toFixed(2)}%, MoireRatio=${(moireRatio * 100).toFixed(2)}%`);

        if (glareRatio > 0.020) {
            return { isSpoof: true, reason: "Mobile Device Screen Glare Detected. Please present your real physical face." };
        }

        if (moireRatio > 0.09) {
            return { isSpoof: true, reason: "Digital Display / Screen Grid Pattern Detected. Please present your real physical face." };
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

        // ⚠️ CRITICAL: If we need a descriptor, load SSD models (not just lite/TinyFace models)
        const modelsToLoad = accurate || withDescriptor;
        const ready = await loadFaceApiModels(modelsToLoad);
        if (!ready) return null;

        // ⚡ CRITICAL: Validate input dimensions
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

        let task: any;
        // ⚠️ CRITICAL: When extracting a face descriptor (128-D vector), we MUST use SSD-MobileNet.
        // TinyFaceDetector and SSD produce incompatible vector spaces — comparing them gives wrong distances.
        // Rule: descriptor extraction → ALWAYS SSD. Bare detection (no descriptor) → TinyFace is fine for speed.
        const useSSD = accurate || withDescriptor;
        let detections: any[] = [];

        if (useSSD) {
            // First pass: standard confidence (0.5)
            task = fa.detectAllFaces(imageElement, new fa.SsdMobilenetv1Options({ minConfidence: 0.5 }))
                .withFaceLandmarks(true);
            if (withDescriptor) task = task.withFaceDescriptors();
            detections = await task;

            // Second pass fallback: lower confidence (0.35) for mobile front cameras in soft/varied lighting
            if (!detections || detections.length === 0) {
                const fallbackTask = fa.detectAllFaces(imageElement, new fa.SsdMobilenetv1Options({ minConfidence: 0.35 }))
                    .withFaceLandmarks(true);
                detections = await (withDescriptor ? fallbackTask.withFaceDescriptors() : fallbackTask);
            }
        } else {
            const options = new fa.TinyFaceDetectorOptions({
                inputSize: 320, // Optimized size for speed
                scoreThreshold: 0.4
            });
            task = fa.detectAllFaces(imageElement, options)
                .withFaceLandmarks(true);
            if (withDescriptor) task = task.withFaceDescriptors();
            detections = await task;
        }

        if (!detections || detections.length === 0) return null;

        const mainFace = detections[0];

        return {
            descriptor: withDescriptor ? mainFace.descriptor : null,
            detection: mainFace.detection,
            landmarks: mainFace.landmarks,
            accurate: accurate,
            multipleFacesDetected: detections.length > 1
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
        const img = new Image();
        img.crossOrigin = 'anonymous';

        img.onload = () => resolve(img);
        img.onerror = (err) => {
            console.error("Failed to load image:", source);
            reject(err);
        };

        if (typeof source === 'string') {
            img.src = source;
        } else {
            const reader = new FileReader();
            reader.onload = (e) => {
                if (e.target?.result) {
                    img.src = e.target.result as string;
                }
            };
            reader.onerror = reject;
            reader.readAsDataURL(source);
        }
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

