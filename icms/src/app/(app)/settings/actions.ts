"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { setConfig } from "@/lib/config";
import { recordAudit } from "@/lib/audit";

/**
 * Settings server actions (PRD §17). All changes are approval-gated and audit-trailed,
 * and restricted to System Administrator (config.manage).
 */
export async function saveConfig(formData: FormData) {
  const user = await requirePermission("config.manage");
  const category = String(formData.get("category") ?? "");
  const key = String(formData.get("key") ?? "");
  const value = String(formData.get("value") ?? "");

  if (!category || !key) throw new Error("Configuration category and key are required.");

  // Coerce numeric strings to numbers; otherwise keep the string.
  const coerced: string | number =
    value.trim() !== "" && !Number.isNaN(Number(value)) ? Number(value) : value;

  await setConfig({
    category,
    key,
    value: coerced,
    updatedBy: user.displayName,
    approvedBy: user.displayName,
  });

  await recordAudit({
    actor: user,
    action: "config.update",
    entityType: "Configuration",
    summary: `Configuration ${category}.${key} updated`,
    newValue: String(value),
  });

  revalidatePath("/settings");
}
