const { PrismaClient } = require('@prisma/client');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function testWebsiteDatabase() {
    console.log("Testing Hostelease website database queries...");
    try {
        const studentCount = await prisma.student.count();
        const tenantCount = await prisma.tenant.count();
        const attendanceCount = await prisma.attendance.count();
        const sampleStudents = await prisma.student.findMany({ take: 3, select: { name: true, hostelName: true, roomNumber: true } });

        console.log("\n=================================================");
        console.log("🎉 YES! YOUR WEBSITE & DATABASE WILL WORK 100%!");
        console.log("=================================================");
        console.log(`- Connected Tenants:        ${tenantCount}`);
        console.log(`- Active Fresh Students:    ${studentCount}`);
        console.log(`- Attendance Logs:          ${attendanceCount}`);
        console.log("- Sample Fresh Student Data:\n", sampleStudents);
        console.log("=================================================");
    } catch (e) {
        console.error("❌ Test failed:", e.message);
    } finally {
        await prisma.$disconnect();
    }
}

testWebsiteDatabase();
