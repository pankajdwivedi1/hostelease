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

export async function getFaceApi() {
    if (!faceapi) {
        if (typeof window === 'undefined') return null;
        faceapi = await import('@vladmandic/face-api');
    }
    return faceapi;
}

/**
 * Load face-api.js models with industrial-grade locking
 */
export async function loadFaceApiModels(accurate: boolean = false) {
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
            if (!fa) return false;

            const MODEL_URL = '/models';
            const promises = [];

            // Always ensure basic models are there
            if (!liteModelsLoaded) {
                promises.push(fa.nets.tinyFaceDetector.loadFromUri(MODEL_URL));
                promises.push(fa.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL));
                promises.push(fa.nets.faceRecognitionNet.loadFromUri(MODEL_URL));
            }

            if (accurate && !proModelsLoaded) {
                console.log('💎 Loading High-Accuracy (Pro) Models...');
                promises.push(fa.nets.ssdMobilenetv1.loadFromUri(MODEL_URL));
                promises.push(fa.nets.faceLandmark68Net.loadFromUri(MODEL_URL));
            }

            await Promise.all(promises);

            if (accurate) proModelsLoaded = true;
            liteModelsLoaded = true;

            console.log(`✅ Face-api models ready (${accurate ? 'PRO' : 'LITE'})`);
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
 */
export function calculateScore(distance: number): number {
    // Distance 0.0 -> 100%
    // Distance 0.5 -> 80%
    // Distance 0.6 -> 70% (Standard cutoff)
    // Distance 0.7 -> 40% (Aggressive drop to prevent false positives)
    // Distance 1.0 -> 0%

    let score;
    if (distance <= 0.6) {
        score = 100 - (distance * 50); // Linear high-confidence (0.6 -> 70)
    } else {
        score = 70 - ((distance - 0.6) * 175); // Steep drop for uncertainty
    }

    const matchPercentage = Math.round(Math.max(0, Math.min(100, score)));
    console.log(`📏 Face Match: Distance=${distance.toFixed(3)}, Score=${matchPercentage}%`);
    return matchPercentage;
}

/**
 * Detect face in an image
 */
export async function detectFace(
    imageElement: HTMLImageElement | HTMLCanvasElement,
    accurate: boolean = false
) {
    try {
        const fa = await getFaceApi();
        if (!fa) return null;

        // ⚡ ENSURE MODELS ARE READY (Prevents inference errors)
        const ready = await loadFaceApiModels(accurate);
        if (!ready) return null;

        // ⚡ CRITICAL: Validate input dimensions to prevent constructor errors
        if (imageElement instanceof HTMLImageElement) {
            if (!imageElement.width || !imageElement.height || imageElement.width === 0 || imageElement.height === 0) {
                console.warn("⚠️ DetectFace skipped: Invalid image dimensions", imageElement.width, imageElement.height);
                return null;
            }
        } else if (imageElement instanceof HTMLCanvasElement) {
            if (!imageElement.width || !imageElement.height || imageElement.width === 0 || imageElement.height === 0) {
                console.warn("⚠️ DetectFace skipped: Invalid canvas dimensions", imageElement.width, imageElement.height);
                return null;
            }
        }

        let detection;
        if (accurate) {
            // 💎 PRO DETECTION: High accuracy (SSD Mobilenet)
            detection = await fa
                .detectSingleFace(imageElement, new fa.SsdMobilenetv1Options({ minConfidence: 0.5 }))
                .withFaceLandmarks(true) // ⚡ ENABLE LANDMARKS FOR LIVENESS
                .withFaceDescriptor();
        } else {
            // ⚡ LITE DETECTION: High speed (Tiny)
            const options = new fa.TinyFaceDetectorOptions({
                inputSize: 512,
                scoreThreshold: 0.1
            });

            detection = await fa
                .detectSingleFace(imageElement, options)
                .withFaceLandmarks(true)
                .withFaceDescriptor();
        }

        if (!detection) return null;

        return {
            descriptor: detection.descriptor,
            detection: detection.detection, // Contains box
            landmarks: detection.landmarks, // ⚡ NEW: Full 68-point landmarks
            accurate: accurate
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
 * Anti-Spoofing: Check if face is real (Living) using landmarks
 * Returns detailed analysis of blinks and head movements
 */
export function analyzeLiveness(landmarks: any) {
    if (!landmarks) return null;

    const leftEye = landmarks.getLeftEye();
    const rightEye = landmarks.getRightEye();

    // Industrial standard: EAR < 0.18 is a definitive blink
    const leftEAR = calculateEAR(leftEye);
    const rightEAR = calculateEAR(rightEye);
    const avgEAR = (leftEAR + rightEAR) / 2.0;

    const isBlinking = avgEAR < 0.18; // ⚡ Hardened: More strict to prevent false triggers

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
        ear: avgEAR,
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

