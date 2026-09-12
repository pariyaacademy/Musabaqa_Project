/**
 * lib/audit/log.ts
 *
 * Single shared writer for musabaqa.audit_logs (spec section 29). Anything
 * that changes state in a way worth being able to reconstruct later should
 * call this rather than inserting into audit_logs directly, so the shape
 * stays consistent.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export interface AuditEntry {
  userId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string | null;
  deviceMetadata?: string | null;
}

export async function writeAuditLog(db: SupabaseClient, entry: AuditEntry): Promise<void> {
  const { error } = await db
    .schema("musabaqa")
    .from("audit_logs")
    .insert({
      user_id: entry.userId,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId ?? null,
      old_value: entry.oldValue ?? null,
      new_value: entry.newValue ?? null,
      ip_address: entry.ipAddress ?? null,
      device_metadata: entry.deviceMetadata ?? null,
    });

  // Deliberately non-fatal: a failed audit write should be logged server-side
  // (e.g. to your process logs) but should not block the underlying action,
  // or a logging outage would become an availability outage too.
  if (error) {
    console.error("Failed to write audit log:", entry.action, entry.entityType, error.message);
  }
}
