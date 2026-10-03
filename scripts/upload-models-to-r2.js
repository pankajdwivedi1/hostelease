const { S3Client, PutObjectCommand, HeadObjectCommand } = require("@aws-sdk/client-s3");
const fs = require("fs");
const path = require("path");

const R2_ACCOUNT_ID = "a9ae2d32d680701b543584167b43aa44";
const R2_ACCESS_KEY_ID = "1c9011d11cb2cd98d9fdd7834da38324";
const R2_SECRET_ACCESS_KEY = "b359c3fc5b0bf1d23027286e1a6726d48d3752f4cdf7ea1e66096e22f7c68ff0";
const R2_BUCKET_NAME = "hosteleaze-student-photos";
const R2_PUBLIC_URL = "https://pub-754ab0d29b3a43b69d79a461c85d3056.r2.dev";

const s3Client = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

async function main() {
  const modelsDir = path.join(__dirname, "..", "public", "models");
  const files = fs.readdirSync(modelsDir);

  console.log(`📦 Found ${files.length} model files to verify/upload to Cloudflare R2...`);

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const fullPath = path.join(modelsDir, file);
    if (!fs.statSync(fullPath).isFile()) continue;

    const key = `models/${file}`;
    const contentType = file.endsWith(".json") ? "application/json" : "application/octet-stream";

    // Check if already on R2
    let alreadyExists = false;
    try {
      await s3Client.send(new HeadObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }));
      alreadyExists = true;
    } catch (e) {
      // Doesn't exist, proceed to upload
    }

    if (alreadyExists) {
      console.log(`[${i + 1}/${files.length}] ⏩ Already uploaded: ${key}`);
      continue;
    }

    const buf = fs.readFileSync(fullPath);
    const start = Date.now();
    await s3Client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
        Body: buf,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000, immutable",
      })
    );
    const dur = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`[${i + 1}/${files.length}] ✅ Uploaded ${key} (${(buf.length / 1024).toFixed(1)} KB) in ${dur}s`);
  }

  console.log(`\n🎉 All AI Model weights are live on Cloudflare R2!`);
  console.log(`🔗 Public URL: ${R2_PUBLIC_URL}/models/`);
}

main().catch((err) => {
  console.error("❌ Migration error:", err);
  process.exit(1);
});
