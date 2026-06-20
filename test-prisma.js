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
    const studentCount = await prisma.student.count();
    const attendanceCount = await prisma.attendance.count();
    const tenantCount = await prisma.tenant.count();

    console.log('\n✅ Connection Successful!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🏢 Tenants in Railway:    ${tenantCount}`);
    console.log(`🎓 Students in Railway:   ${studentCount}`);
    console.log(`📝 Attendance in Railway: ${attendanceCount}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (err) {
    console.error('\n❌ Connection Failed:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

test();
