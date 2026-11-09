let cocoModel: any = null;
let handposeModel: any = null;
let isLoading = false;

/**
 * Load the Mobile Phone Detector and Hand Detector models
 */
export async function loadPhoneDetector() {
    if (cocoModel) return true;
    if (isLoading) {
        while (isLoading) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        return !!cocoModel;
    }

    isLoading = true;
    try {
        console.log("📱 Dynamically importing TFJS & Object Detectors...");
        const tf = await import('@tensorflow/tfjs');
        await tf.ready();
        await new Promise(resolve => setTimeout(resolve, 30));

        const cocoSsd = await import('@tensorflow-models/coco-ssd');
        const hpModule = await import('@tensorflow-models/handpose');

        const [loadedCoco, loadedHand] = await Promise.allSettled([
            cocoSsd.load({ base: 'lite_mobilenet_v2' }),
            hpModule.load()
        ]);

        if (loadedCoco.status === 'fulfilled') {
            cocoModel = loadedCoco.value;
            console.log("✅ Mobile Phone Detector (COCO-SSD Lite) Loaded Successfully");
        }
        if (loadedHand.status === 'fulfilled') {
            handposeModel = loadedHand.value;
            console.log("✅ Hand Detector (Handpose) Loaded Successfully");
        }

        return !!cocoModel;
    } catch (error) {
        console.error("❌ Failed to load Object Detectors:", error);
        return false;
    } finally {
        isLoading = false;
    }
}

/**
 * Scan the camera feed for cell phones and HANDS!
 * @param imageElement The video or canvas element
 * @returns true if a cell phone or hand is detected, false otherwise
 */
export async function detectMobilePhone(imageElement: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement | null): Promise<{isSpoofing: boolean, message: string}> {
    if (!cocoModel) {
        return { isSpoofing: false, message: "" };
    }
    
    if (!imageElement) return { isSpoofing: false, message: "" };
    
    if (imageElement instanceof HTMLVideoElement) {
        if (!imageElement.videoWidth || !imageElement.videoHeight || imageElement.videoWidth === 0 || imageElement.videoHeight === 0) {
            return { isSpoofing: false, message: "" };
        }
    } else {
        if (!imageElement.width || !imageElement.height || imageElement.width === 0 || imageElement.height === 0) {
            return { isSpoofing: false, message: "" };
        }
    }

    try {
        // Run detection sequentially to prevent blocking the main thread for too long
        const predictions = await cocoModel.detect(imageElement);
        // Yield to event loop to prevent "Page Unresponsive" popup
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // ⚡ CRITICAL FIX: The component may have unmounted or camera stopped during the async pause.
        // We MUST re-validate the dimensions before hitting WebGL again.
        if (imageElement instanceof HTMLVideoElement) {
            if (!imageElement.videoWidth || !imageElement.videoHeight || imageElement.videoWidth === 0 || imageElement.videoHeight === 0) {
                return { isSpoofing: false, message: "" };
            }
        } else {
            if (!imageElement.width || !imageElement.height || imageElement.width === 0 || imageElement.height === 0) {
                return { isSpoofing: false, message: "" };
            }
        }

        // 1. Check for Phone/Device Spoofing (COCO-SSD)
        const spoofClasses = ['cell phone', 'book', 'laptop', 'tv', 'monitor', 'tablet', 'paper', 'keyboard', 'mouse'];
        for (const prediction of predictions) {
            if (spoofClasses.includes(prediction.class) && prediction.score > 0.22) {
                console.warn(`🛑 SPOOF ATTEMPT DETECTED! Found a ${prediction.class} (${Math.round(prediction.score * 100)}% confidence)`);
                return { isSpoofing: true, message: `SECONDARY DEVICE DETECTED (${prediction.class.toUpperCase()})` }; 
            }
        }

        // 2. Check for Hand Spoofing (holding a photo/device in front of camera)
        if (handposeModel) {
            const hands = await handposeModel.estimateHands(imageElement);
            if (hands && hands.length > 0) {
                const handConfidence = hands[0].handInViewConfidence || (hands[0] as any).score || 0.8;
                if (handConfidence > 0.30) {
                    console.warn(`🛑 SPOOF ATTEMPT DETECTED! Found a Hand (${Math.round(handConfidence * 100)}%)`);
                    return { isSpoofing: true, message: "HOLDING HAND / FINGERS DETECTED! PLEASE DROP PHONE / PHOTO" };
                }
            }
        }
        
        return { isSpoofing: false, message: "" }; // No spoof object found
    } catch (error) {
        console.error("❌ Error running phone detection:", error);
        return { isSpoofing: false, message: "" };
    }
}
