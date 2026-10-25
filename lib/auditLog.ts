/**
 * Shared Admin Audit Log Utility
 * Writes action records directly to the `admin_audit_logs` table via Prisma
 * 
 * Usage: await writeAdminAuditLog({ action, entityType, entityId, details, performedBy })
 */

import prisma from "@/lib/prisma";

export interface AuditLogEntry {
  action: string;            // e.g. "STUDENT_DELETED", "STUDENT_EDITED", "GATEPASS_APPROVED"
  entityType: string;        // e.g. "student", "gatepass", "payment"
  entityId?: string;         // ID of the affected record
  entityName?: string;       // Human-readable name (e.g. student name)
  details?: Record<string, any>; // Additional context
  performedBy?: string;      // Admin email or UID
  tenantSlug?: string;       // Tenant identifier
}

export async function writeAdminAuditLog(entry: AuditLogEntry): Promise<void> {
  try {
    await (prisma as any).adminAuditLog.create({
      data: {
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId || null,
        entityName: entry.entityName || null,
        details: entry.details || {},
        performedBy: entry.performedBy || "admin",
        tenantSlug: entry.tenantSlug || null,
        createdAt: new Date(),
      }
    });
  } catch (err) {
    // Never throw — audit log failure should never block the main action
    console.error("[AUDIT LOG] Failed to write audit entry:", err);
  }
}

export async function writeHostelActivityLog({
  hostelName,
  actionType,
  studentName,
  erpId,
  operator,
  changeSummary
}: {
  hostelName: string;
  actionType: 'ADD' | 'DELETE' | 'UPDATE' | 'ONBOARD';
  studentName: string;
  erpId: string;
  operator: string;
  changeSummary?: string;
}): Promise<void> {
  try {
    const action = actionType === 'ONBOARD' ? 'STUDENT_ONBOARDED' : actionType === 'ADD' ? 'STUDENT_CREATED' : actionType === 'DELETE' ? 'STUDENT_DELETED' : 'STUDENT_EDITED';
    const cleanSummary = changeSummary || "";
    const details = {
      hostelName,
      studentName,
      erpId,
      operator,
      actionType,
      changeSummary: cleanSummary,
      timestamp: new Date().toISOString(),
      isHostelActivity: true
    };

    await (prisma as any).adminAuditLog.create({
      data: {
        action,
        entityType: 'student',
        entityName: studentName,
        details,
        performedBy: operator,
        createdAt: new Date(),
      }
    });

    // ⚡ Real-Time Push: Broadcast immediately to connected admin & warden screens via SSE
    try {
      const { broadcastHostelActivity } = await import("@/lib/eventEmitter");
      broadcastHostelActivity({
        hostelName,
        actionType,
        studentName,
        erpId,
        operator,
        changeSummary: cleanSummary
      });
    } catch (sseErr) {
      console.warn("⚠️ Failed to broadcast SSE hostel activity:", sseErr);
    }
  } catch (err) {
    console.error("[AUDIT LOG] writeHostelActivityLog failed:", err);
  }
}
