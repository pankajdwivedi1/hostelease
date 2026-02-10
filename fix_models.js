const fs = require('fs');
const path = require('path');
const https = require('https');

const modelsDir = path.join(__dirname, 'public', 'models');
if (!fs.existsSync(modelsDir)) {
    fs.mkdirSync(modelsDir, { recursive: true });
}

// Full set of models needed for industry-grade face logic
const baseUrl = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/';

const models = [
    // SSD Mobilenet V1 (Accurate Detector)
    'ssd_mobilenetv1_model-weights_manifest.json',
    'ssd_mobilenetv1_model-shard1',
    'ssd_mobilenetv1_model-shard2',

    // Face Landmark 68 (Full resolution)
    'face_landmark_68_model-weights_manifest.json',
    'face_landmark_68_model-shard1',

    // Face Recognition (Universal)
    'face_recognition_model-weights_manifest.json',
    'face_recognition_model-shard1',

    // Tiny Detector (Fast fallback)
    'tiny_face_detector_model-weights_manifest.json',
    'tiny_face_detector_model-shard1',

    // Face Landmark 68 Tiny (Fast fallback)
    'face_landmark_68_tiny_model-weights_manifest.json',
    'face_landmark_68_tiny_model-shard1'
];

async function download(file) {
    const dest = path.join(modelsDir, file);
    const tempDest = dest + '.tmp';

    console.log(`⏳ Downloading ${file}...`);

    return new Promise((resolve, reject) => {
        const fileStream = fs.createWriteStream(tempDest);
        https.get(baseUrl + file, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download ${file}: ${response.statusCode}`));
                return;
            }

            response.pipe(fileStream);

            fileStream.on('finish', () => {
                fileStream.close();
                // Basic check: if less than 1KB and not a manifest, it's likely broken
                const stats = fs.statSync(tempDest);
                if (stats.size < 500 && !file.includes('manifest')) {
                    fs.unlinkSync(tempDest);
                    reject(new Error(`File ${file} is suspiciously small (${stats.size} bytes)`));
                } else {
                    if (fs.existsSync(dest)) fs.unlinkSync(dest);
                    fs.renameSync(tempDest, dest);
                    console.log(`✅ Verified and Saved ${file} (${stats.size} bytes)`);
                    resolve();
                }
            });
        }).on('error', (err) => {
            if (fs.existsSync(tempDest)) fs.unlinkSync(tempDest);
            console.error(`❌ Error downloading ${file}:`, err.message);
            reject(err);
        });
    });
}

async function main() {
    console.log("🚀 Starting Model Verification & Repair...");
    for (const model of models) {
        try {
            await download(model);
        } catch (e) {
            console.error(`⚠️ Failed to download/verify ${model}: ${e.message}`);
        }
    }
    console.log("✨ All models verified!");
}

main();
