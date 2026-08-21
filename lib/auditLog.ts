/**
 * Shared Admin Audit Log Utility
 * Writes action records to the `admin_audit_logs` Supabase table
 * (same table already used by the Super Admin dashboard).
 * 
 * Usage: await writeAdminAuditLog({ action, entityType, entityId, details, performedBy })
 */

import prisma from "@/lib/prisma";
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
    const { db } = await import("@/lib/dbAdapter");
    const source = await db.getSource ? await db.getSource() : 'PRISMA';

    if (source === 'PRISMA') {
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
      return;
    }

    if (source === 'SUPABASE') {
      const supabase = getSupabaseAdmin();
      if (supabase) {
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
      }
    }
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
  try {
    const { db } = await import("@/lib/dbAdapter");
    const source = await db.getSource();

    const action = actionType === 'ADD' ? 'STUDENT_CREATED' : actionType === 'DELETE' ? 'STUDENT_DELETED' : 'STUDENT_EDITED';
    const details = {
      hostelName,
      studentName,
      erpId,
      operator,
      timestamp: new Date().toISOString(),
      isHostelActivity: true
    };

    if (source === 'PRISMA') {
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
      return;
    }

    if (source === 'SUPABASE') {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        await supabase.from("admin_audit_logs").insert({
          action,
          entity_type: 'student',
          entity_name: studentName,
          details,
          performed_by: operator,
          created_at: new Date().toISOString(),
        });
        return; // ✅ Successfully written to Supabase
      }
      // Supabase client unavailable — fall through to MongoDB
    }

    // MongoDB fallback (when source is not PRISMA or not SUPABASE, or Supabase client is null)
    const HostelLog = (await import("@/models/HostelLog")).default;
    await connectDB();
    await HostelLog.create({
      hostelName,
      actionType,
      studentName,
      erpId,
      operator,
    });
  } catch (err) {
    console.error("[AUDIT LOG] writeHostelActivityLog failed:", err);
  }
}
