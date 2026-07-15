/**
 * Shared Admin Audit Log Utility
 * Writes action records to the `admin_audit_logs` Supabase table
 * (same table already used by the Super Admin dashboard).
 * 
 * Usage: await writeAdminAuditLog({ action, entityType, entityId, details, performedBy })
 */

import { getSupabaseAdmin } from "@/lib/supabaseServer";
import connectDB from "@/lib/mongodb";

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
    const supabase = getSupabaseAdmin();
    if (!supabase) return;

    await supabase.from("admin_audit_logs").insert({
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId || null,
      entity_name: entry.entityName || null,
      details: entry.details || {},
      performed_by: entry.performedBy || "admin",
      tenant_slug: entry.tenantSlug || null,
      created_at: new Date().toISOString(),
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
  operator
}: {
  hostelName: string;
  actionType: 'ADD' | 'DELETE' | 'UPDATE';
  studentName: string;
  erpId: string;
  operator: string;
}): Promise<void> {
  // 1. Supabase insert (if active)
  try {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const action = actionType === 'ADD' ? 'STUDENT_CREATED' : actionType === 'DELETE' ? 'STUDENT_DELETED' : 'STUDENT_EDITED';
      await supabase.from("admin_audit_logs").insert({
        action,
        entity_type: 'student',
        entity_name: studentName,
        details: {
          hostelName,
          studentName,
          erpId,
          operator,
          timestamp: new Date().toISOString(),
          isHostelActivity: true
        },
        performed_by: operator,
        created_at: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.error("[AUDIT LOG] Supabase writeHostelActivityLog failed:", err);
  }

  // 2. MongoDB insert (if active or backup)
  try {
    const { db } = await import("@/lib/dbAdapter");
    const source = await db.getSource();
    if (source !== 'SUPABASE') {
      const HostelLog = (await import("@/models/HostelLog")).default;
      await connectDB();
      await HostelLog.create({
        hostelName,
        actionType,
        studentName,
        erpId,
        operator,
      });
    }
  } catch (err) {
    console.error("[AUDIT LOG] MongoDB writeHostelActivityLog failed:", err);
  }
}
