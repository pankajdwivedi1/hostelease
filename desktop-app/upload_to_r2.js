/**
 * HOSTELEAZE Desktop App — Cloudflare R2 Upload Script
 * Uploads dist/HostelEaze-Setup.exe to Cloudflare R2 downloads/HostelEaze-Setup.exe
 */

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const s3 = new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});

async function upload() {
    const filePath = path.join(__dirname, 'dist', 'HostelEaze-Setup.exe');
    if (!fs.existsSync(filePath)) {
        console.error('File not found:', filePath);
        process.exit(1);
    }
    const fileBuffer = fs.readFileSync(filePath);
    const fileSizeMB = (fileBuffer.length / (1024 * 1024)).toFixed(2);
    const bucket = process.env.R2_PHOTOS_BUCKET_NAME || 'hosteleaze-student-photos';
    const key = 'downloads/HostelEaze-Setup.exe';

    console.log(`============================================================`);
    console.log(`Uploading ${fileSizeMB} MB to Cloudflare R2...`);
    console.log(`Bucket: ${bucket}`);
    console.log(`Key:    ${key}`);
    console.log(`============================================================`);

    await s3.send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: fileBuffer,
        ContentType: 'application/vnd.microsoft.portable-executable',
    }));

    console.log('\n============================================================');
    console.log('UPLOAD SUCCESSFUL TO CLOUDFLARE R2!');
    console.log(`Direct Download URL: https://pub-754ab0d29b3a43b69d79a461c85d3056.r2.dev/${key}`);
    console.log(`Website Download API: https://www.hosteleaze.com/api/download/windows`);
    console.log('============================================================\n');
}

upload().catch((err) => {
    console.error('Upload failed:', err);
    process.exit(1);
});
