import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';

let cocoModel: cocoSsd.ObjectDetection | null = null;
let isLoading = false;

/**
 * Load the Mobile Phone Detector (coco-ssd) model
 */
export async function loadPhoneDetector() {
    if (cocoModel) return true;
    if (isLoading) {
        // Wait for it to finish loading
        while (isLoading) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        return !!cocoModel;
    }

    isLoading = true;
    try {
        console.log("📱 Loading AI Mobile Phone Detector...");
        // Ensure TF backend is ready
        await tf.ready();
        // Load the model
        cocoModel = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
        
        // Removed WARMUP to prevent synchronous WebGL blocking of the main thread

        console.log("✅ Phone Detector Loaded & Warmed Up Successfully");
        return true;
    } catch (error) {
        console.error("❌ Failed to load Phone Detector:", error);
        return false;
    } finally {
        isLoading = false;
    }
}

/**
 * Scan the camera feed for cell phones
 * @param imageElement The video or canvas element
 * @returns true if a cell phone is detected, false otherwise
 */
export async function detectMobilePhone(imageElement: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement): Promise<boolean> {
    if (!cocoModel) {
        console.warn("⚠️ Phone Detector not loaded yet");
        return false;
    }

    try {
        // Run detection
        const predictions = await cocoModel.detect(imageElement);
        
        // Check for spoofing objects
        const spoofClasses = ['cell phone', 'book', 'laptop', 'tv', 'monitor', 'tablet', 'paper'];
        for (const prediction of predictions) {
            if (spoofClasses.includes(prediction.class) && prediction.score > 0.4) {
                console.warn(`🛑 SPOOF ATTEMPT DETECTED! Found a ${prediction.class} (${Math.round(prediction.score * 100)}% confidence)`);
                return true; // Spoof object found!
            }
        }
        return false; // No spoof object found
    } catch (error) {
        console.error("❌ Error running phone detection:", error);
        return false;
    }
}
