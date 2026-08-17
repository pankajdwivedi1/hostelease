require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');

async function test() {
  const prisma = new PrismaClient();
  try {
    console.log("Testing prisma.student.findMany...");
    const tenantId = '26739d24-0214-409b-aa81-42e628e88c2b';
    const students = await prisma.student.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
      take: 1000
    });
    console.log(`✅ Success! Prisma fetched ${students.length} students.`);
    if (students.length > 0) {
      console.log("Sample student from Prisma:", {
        id: students[0]._id || students[0].id,
        name: students[0].name,
        hostelName: students[0].hostelName,
        roomNumber: students[0].roomNumber,
        tenantId: students[0].tenantId
      });
    }
  } catch (err) {
    console.error("❌ Prisma Exception:", err);
  } finally {
    await prisma.$disconnect();
  }
}

test();
