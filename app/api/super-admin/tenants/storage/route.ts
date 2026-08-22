import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import fs from "fs";
import path from "path";

export async function POST(request: NextRequest) {
    try {
        const { tenantId } = await request.json();
        if (!tenantId) return NextResponse.json({ success: false, error: "Missing tenantId" }, { status: 400 });

        // 1. Exact Database Storage for this Tenant
        const dbSizeQuery: any[] = await prisma.$queryRaw`
            SELECT (
                COALESCE((SELECT SUM(pg_column_size(s.*)) FROM "students" s WHERE s."tenant_id"::text = ${tenantId}::text), 0) +
                COALESCE((SELECT SUM(pg_column_size(gp.*)) FROM "gate_passes" gp WHERE gp."tenant_id"::text = ${tenantId}::text), 0) +
                COALESCE((SELECT SUM(pg_column_size(a.*)) FROM "attendance" a WHERE a."tenant_id"::text = ${tenantId}::text), 0) +
                COALESCE((SELECT SUM(pg_column_size(sfp.*)) FROM "student_field_progress" sfp WHERE sfp."student_id" IN (SELECT s2."_id" FROM "students" s2 WHERE s2."tenant_id"::text = ${tenantId}::text)), 0) +
                COALESCE((SELECT SUM(pg_column_size(p.*)) FROM "permissions" p WHERE p."student_id" IN (SELECT s4."_id" FROM "students" s4 WHERE s4."tenant_id"::text = ${tenantId}::text)), 0) +
                COALESCE((SELECT SUM(pg_column_size(ss.*)) FROM "student_security" ss WHERE ss."student_id" IN (SELECT s3."_id" FROM "students" s3 WHERE s3."tenant_id"::text = ${tenantId}::text)), 0) +
                COALESCE((SELECT SUM(pg_column_size(ast.*)) FROM "admin_settings" ast WHERE ast."tenant_id"::text = ${tenantId}::text), 0)
            ) as total_bytes
        `;
        const rawDbBytes = Number(dbSizeQuery[0]?.total_bytes || 0);
        // Add PostgreSQL index & page allocation overhead factor (~1.4x)
        const dbBytes = Math.round(rawDbBytes * 1.4);

        // 2. Real Uploaded Photos & Files on Disk for this Tenant
        const students = await prisma.student.findMany({
            where: { tenantId },
            select: { profilePicture: true }
        });

        const storageDir = process.env.STORAGE_DIR || path.join(process.cwd(), 'public', 'uploads');
        const publicDir = path.join(process.cwd(), 'public');

        let photoBytes = 0;
        for (const s of students) {
            if (s.profilePicture && typeof s.profilePicture === 'string') {
                const relativePath = s.profilePicture.replace(/^\/api\/uploads\//, '').replace(/^\/uploads\//, '').replace(/^\/+/, '').split('?')[0];
                const fullPathInStorage = path.join(storageDir, relativePath);
                const fullPathInPublic = path.join(publicDir, s.profilePicture.replace(/^\/api\//, '').replace(/^\/+/, '').split('?')[0]);

                let targetFile = fs.existsSync(fullPathInStorage) ? fullPathInStorage : (fs.existsSync(fullPathInPublic) ? fullPathInPublic : null);
                if (targetFile) {
                    try {
                        const stat = fs.statSync(targetFile);
                        if (stat.isFile()) {
                            photoBytes += stat.size;
                        }
                    } catch (e) {}
                }
            }
        }

        const totalRealStorageBytes = dbBytes + photoBytes;

        // 3. Persist to settings for instant display on next load
        const setting = await prisma.adminSettings.findFirst({
            where: { tenantId }
        });

        if (setting) {
            const bankDetails = (setting.universityBankDetails as any) || {};
            bankDetails.lastStorageBytes = totalRealStorageBytes;

            await prisma.adminSettings.update({
                where: { id: setting.id },
                data: { universityBankDetails: bankDetails }
            });
        }

        return NextResponse.json({ 
            success: true, 
            storageBytes: totalRealStorageBytes,
            dbBytes,
            photoBytes
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
