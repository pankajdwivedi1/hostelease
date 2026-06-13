import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';

import * as handpose from '@tensorflow-models/handpose';

let cocoModel: cocoSsd.ObjectDetection | null = null;
let handposeModel: handpose.HandPose | null = null;
let isLoading = false;

/**
 * Load the Mobile Phone Detector and Hand Detector models
 */
export async function loadPhoneDetector() {
    if (cocoModel && handposeModel) return true;
    if (isLoading) {
        // Wait for it to finish loading
        while (isLoading) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        return !!cocoModel && !!handposeModel;
    }

    isLoading = true;
    try {
        console.log("📱 Loading AI Object Detectors (Phone & Hand)...");
        // Ensure TF backend is ready
        await tf.ready();
        
        // Load the models in parallel
        const [coco, hand] = await Promise.all([
            cocoSsd.load({ base: 'lite_mobilenet_v2' }),
            handpose.load()
        ]);
        
        cocoModel = coco;
        handposeModel = hand;

        console.log("✅ Phone & Hand Detectors Loaded Successfully");
        return true;
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
export async function detectMobilePhone(imageElement: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement): Promise<{isSpoofing: boolean, message: string}> {
    if (!cocoModel || !handposeModel) {
        console.warn("⚠️ Detectors not loaded yet");
        return { isSpoofing: false, message: "" };
    }

    try {
        // Run detection in parallel
        const [predictions, hands] = await Promise.all([
            cocoModel.detect(imageElement),
            handposeModel.estimateHands(imageElement)
        ]);
        
        // 1. Check for Hand Spoofing (holding a photo)
        if (hands && hands.length > 0) {
            const handConfidence = hands[0].handInViewConfidence;
            if (handConfidence > 0.8) {
                console.warn(`🛑 SPOOF ATTEMPT DETECTED! Found a Hand (${Math.round(handConfidence * 100)}%)`);
                return { isSpoofing: true, message: "HAND DETECTED! DROP PHOTO" };
            }
        }

        // 2. Check for Phone/Device Spoofing
        const spoofClasses = ['cell phone', 'book', 'laptop', 'tv', 'monitor', 'tablet', 'paper'];
        for (const prediction of predictions) {
            if (spoofClasses.includes(prediction.class) && prediction.score > 0.4) {
                console.warn(`🛑 SPOOF ATTEMPT DETECTED! Found a ${prediction.class} (${Math.round(prediction.score * 100)}% confidence)`);
                return { isSpoofing: true, message: "PHONE/SCREEN DETECTED!" }; 
            }
        }
        
        return { isSpoofing: false, message: "" }; // No spoof object found
    } catch (error) {
        console.error("❌ Error running phone detection:", error);
        return { isSpoofing: false, message: "" };
    }
}
