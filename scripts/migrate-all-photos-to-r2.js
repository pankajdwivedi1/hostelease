const { Client } = require("pg");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const fs = require("fs");
const path = require("path");

const DATABASE_URL = "postgresql://postgres:PiUUSLCdzQvIPfhQEggGBwSrNwOzTdVl@thomas.proxy.rlwy.net:25119/railway";
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

async function uploadBufferToR2(buffer, key, contentType) {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    })
  );
  return `${R2_PUBLIC_URL.replace(/\/$/, "")}/${key}`;
}

async function runMigration() {
  console.log("==================================================");
  console.log("🚀 STARTING FAST PARALLEL MIGRATION TO CLOUDFLARE R2");
  console.log("Bucket:", R2_BUCKET_NAME);
  console.log("Public Base URL:", R2_PUBLIC_URL);
  console.log("==================================================");

  const pgClient = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  await pgClient.connect();
  console.log("Connected to Railway PostgreSQL successfully.");

  try {
    const res = await pgClient.query(`
      SELECT _id, name, erp_id, registration_id, tenant_id, profile_picture
      FROM students
      ORDER BY name ASC;
    `);

    const students = res.rows;
    console.log(`\nFound total ${students.length} students in database.`);

    let base64Migrated = 0;
    let localFilesMigrated = 0;
    let alreadyOnR2 = 0;
    let noPhotoCount = 0;
    let failedCount = 0;
    let missingLocalFileCount = 0;

    const CONCURRENCY = 15;
    let currentIndex = 0;

    async function processStudent(student, index) {
      const pic = student.profile_picture;
      const studentIdentifier = `${student.name || 'Unnamed'} (ID: ${student._id}, Reg: ${student.registration_id || student.erp_id || 'N/A'})`;

      if (!pic || pic.trim() === "") {
        noPhotoCount++;
        return;
      }

      if (pic.startsWith(R2_PUBLIC_URL) || pic.includes(".r2.dev") || pic.includes(".r2.cloudflarestorage.com")) {
        alreadyOnR2++;
        return;
      }

      try {
        // Case 1: Base64 data
        if (pic.startsWith("data:") || pic.length > 500) {
          let buffer;
          let contentType = "image/jpeg";
          let ext = "jpg";

          if (pic.startsWith("data:image/")) {
            const match = pic.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
            if (match) {
              const rawExt = match[1].toLowerCase();
              ext = rawExt === "jpeg" ? "jpg" : rawExt;
              contentType = `image/${rawExt}`;
              buffer = Buffer.from(match[2], "base64");
            } else {
              const parts = pic.split("base64,");
              buffer = Buffer.from(parts[1] || parts[0], "base64");
            }
          } else {
            buffer = Buffer.from(pic, "base64");
          }

          const tenantFolder = student.tenant_id || "default";
          const r2Key = `profile-pictures/${tenantFolder}/${student._id}_${Date.now()}.${ext}`;
          const r2Url = await uploadBufferToR2(buffer, r2Key, contentType);

          await pgClient.query(
            `UPDATE students SET profile_picture = $1, updated_at = NOW() WHERE _id = $2`,
            [r2Url, student._id]
          );

          base64Migrated++;
          console.log(`[${index + 1}/${students.length}] [Base64 -> R2] ${studentIdentifier}`);
          return;
        }

        // Case 2: Local file URL (/api/uploads/... or /uploads/...)
        if (pic.startsWith("/api/uploads/") || pic.startsWith("/uploads/") || pic.startsWith("uploads/")) {
          const cleanRelPath = pic
            .replace(/^\/api\/uploads\//, "")
            .replace(/^\/uploads\//, "")
            .replace(/^uploads\//, "");

          const candidatePaths = [
            path.join(process.cwd(), "public", "uploads", cleanRelPath),
            path.join(process.cwd(), "uploads", cleanRelPath),
            path.join(process.cwd(), "public", cleanRelPath),
          ];

          let foundPath = null;
          for (const cp of candidatePaths) {
            if (fs.existsSync(cp)) {
              foundPath = cp;
              break;
            }
          }

          if (foundPath) {
            const buffer = await fs.promises.readFile(foundPath);
            const extName = path.extname(foundPath).toLowerCase();
            const mimeMap = {
              ".jpg": "image/jpeg",
              ".jpeg": "image/jpeg",
              ".png": "image/png",
              ".webp": "image/webp",
              ".gif": "image/gif",
            };
            const contentType = mimeMap[extName] || "image/jpeg";
            const r2Key = `profile-pictures/${cleanRelPath.replace(/\\/g, "/")}`;
            const r2Url = await uploadBufferToR2(buffer, r2Key, contentType);

            await pgClient.query(
              `UPDATE students SET profile_picture = $1, updated_at = NOW() WHERE _id = $2`,
              [r2Url, student._id]
            );

            localFilesMigrated++;
            console.log(`[${index + 1}/${students.length}] [LocalFile -> R2] ${studentIdentifier}`);
            return;
          } else {
            missingLocalFileCount++;
            console.warn(`[${index + 1}/${students.length}] [LocalFile MISSING] ${studentIdentifier}: ${pic}`);
            return;
          }
        }

        console.log(`[${index + 1}/${students.length}] [Skipped] ${studentIdentifier}`);

      } catch (itemErr) {
        failedCount++;
        console.error(`[${index + 1}/${students.length}] [FAILED] ${studentIdentifier}:`, itemErr.message);
      }
    }

    // Process with pool of workers
    async function worker() {
      while (currentIndex < students.length) {
        const idx = currentIndex++;
        await processStudent(students[idx], idx);
      }
    }

    const workers = Array.from({ length: CONCURRENCY }, () => worker());
    await Promise.all(workers);

    console.log("\n==================================================");
    console.log("🎉 MIGRATION COMPLETE");
    console.log("==================================================");
    console.log(`Total students inspected: ${students.length}`);
    console.log(`✅ Base64 photos migrated to R2: ${base64Migrated}`);
    console.log(`✅ Local file photos migrated to R2: ${localFilesMigrated}`);
    console.log(`ℹ️ Already on R2: ${alreadyOnR2}`);
    console.log(`ℹ️ No photo: ${noPhotoCount}`);
    console.log(`⚠️ Missing local disk files: ${missingLocalFileCount}`);
    console.log(`❌ Failed uploads: ${failedCount}`);
    console.log("==================================================");

  } catch (err) {
    console.error("Critical migration error:", err);
  } finally {
    await pgClient.end();
  }
}

runMigration();
