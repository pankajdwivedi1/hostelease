import { db } from "@/lib/dbAdapter";
import ParentConsentClient from "./ParentConsentClient";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

interface PageProps {
    params: Promise<{ leaveId: string }>;
}

export default async function ParentConsentPage({ params }: PageProps) {
    const { leaveId } = await params;
    
    // Parse the actual permission ID from the slug
    let permissionId = leaveId;
    if (leaveId.includes("--")) {
        const parts = leaveId.split("--");
        permissionId = parts[parts.length - 1];
    }
    
    // Fetch leave/permission request from database (populated with student data)
    const permission = await db.permissions.getById(permissionId, { populate: true });
    
    if (!permission) {
        return notFound();
    }
    
    // Extract student details
    const student = typeof permission.studentId === 'object' ? permission.studentId : null;
    const studentName = student?.name || "Student";
    const parentName = student?.fatherName || student?.motherName || "Parent";
    
    // Format dates to readable Indian format (e.g. 25-06-2026)
    const formatDate = (dateStr: string) => {
        try {
            const date = new Date(dateStr);
            return date.toLocaleDateString("en-IN", {
                timeZone: "Asia/Kolkata",
                day: "2-digit",
                month: "2-digit",
                year: "numeric"
            });
        } catch (e) {
            return dateStr;
        }
    };
    
    const startDate = formatDate(permission.fromDateTime);
    const endDate = formatDate(permission.toDateTime);
    
    const parentUserId = student?.fatherNumber || ((student?.id || student?._id || "").toString() + "_parent");
    
    return (
        <ParentConsentClient
            leaveId={permissionId}
            studentName={studentName}
            parentName={parentName}
            startDate={startDate}
            endDate={endDate}
            parentConsentUrl={permission.parentConsentUrl}
            parentUserId={parentUserId}
        />
    );
}
