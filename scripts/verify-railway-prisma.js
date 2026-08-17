const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
    datasources: {
        db: {
            url: "postgresql://postgres:PiUUSLCdzQvIPfhQEggGBwSrNwOzTdVl@thomas.proxy.rlwy.net:25119/railway?sslmode=no-verify"
        }
    }
});

async function verify() {
    console.log("Verifying Prisma connectivity with Railway PostgreSQL...");
    try {
        const studentCount = await prisma.student.count();
        const attendanceCount = await prisma.attendance.count();
        const tenantCount = await prisma.tenant.count();
        const hostelCount = await prisma.hostel.count();

        console.log("✅ Prisma Verification Successful!");
        console.log(`- Tenants: ${tenantCount}`);
        console.log(`- Hostels: ${hostelCount}`);
        console.log(`- Total Students: ${studentCount}`);
        console.log(`- Total Attendance Records: ${attendanceCount}`);
    } catch (e) {
        console.error("❌ Prisma Verification Failed:", e.message);
    } finally {
        await prisma.$disconnect();
    }
}

verify();
