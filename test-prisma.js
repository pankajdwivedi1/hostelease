const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

// Manually load DATABASE_URL from .env.local for local script execution
const envContent = fs.readFileSync(path.resolve(__dirname, '.env.local'), 'utf8');
const match = envContent.match(/^\s*DATABASE_URL\s*=\s*(.*)?$/m);
if (match && match[1]) {
  process.env.DATABASE_URL = match[1].trim().replace(/^"|"$/g, '');
}

const prisma = new PrismaClient();

async function test() {
  console.log('🔌 Connecting to Railway PostgreSQL database via Prisma...');
  try {
    await prisma.$executeRawUnsafe('ALTER TABLE "hostels" ADD COLUMN IF NOT EXISTS "allow_warden_notification" BOOLEAN DEFAULT true;');
    await prisma.$executeRawUnsafe('ALTER TABLE "hostels" ADD COLUMN IF NOT EXISTS "allow_student_notification" BOOLEAN DEFAULT true;');
    await prisma.$executeRawUnsafe('ALTER TABLE "hostels" ADD COLUMN IF NOT EXISTS "registration_format" TEXT DEFAULT \'\';');
    console.log('✅ Added missing columns to hostels table in Railway PostgreSQL!');

    const students = await prisma.student.findMany({
      where: {
        name: { in: ['AAYUSH RAI SINDHIYA', 'ABHAY KUMAR', 'ABHAY TIWARI'] }
      },
      select: {
        id: true,
        name: true,
        firebaseUid: true,
        faceDescriptor: true,
        dynamicFields: true,
        profilePicture: true,
        updatedAt: true
      }
    });
    console.log(JSON.stringify(students.map(s => ({
      id: s.id,
      name: s.name,
      firebaseUID: s.firebaseUID,
      hasVector: Array.isArray(s.faceDescriptor) && s.faceDescriptor.length > 0,
      vectorLength: Array.isArray(s.faceDescriptor) ? s.faceDescriptor.length : 0,
      dynamicFields: s.dynamicFields,
      hasPic: !!s.profilePicture,
      picLength: s.profilePicture ? s.profilePicture.length : 0,
      updatedAt: s.updatedAt
    })), null, 2));

  } catch (err) {
    console.error('\n❌ Connection Failed:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

test();
