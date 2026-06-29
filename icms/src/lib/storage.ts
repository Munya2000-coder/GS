import { mkdir, writeFile, readFile } from "fs/promises";
import path from "path";

/**
 * Pluggable evidence storage (PRD §7.5).
 *
 * STORAGE_MODE=local      — writes to disk under STORAGE_LOCAL_DIR.
 * STORAGE_MODE=azure-blob — Azure Blob Storage with soft-delete + versioning
 *                           and Azure Defender virus scanning (boundary stubbed).
 *
 * The PRD requires: 25 MB max per file, an allow-list of formats, virus scanning
 * before acceptance, and version control. Size/format checks live here; the
 * virus-scan hook is a no-op in local mode and would call Defender in blob mode.
 */

export const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB (PRD §7.5)
export const ACCEPTED_MIME = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // docx
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // xlsx
  "image/jpeg",
  "image/png",
  "image/heic",
]);

export type StoredFile = { storagePath: string; sizeBytes: number };

export function validateUpload(name: string, mime: string, size: number): string | null {
  if (size > MAX_FILE_BYTES) {
    return `File exceeds 25 MB limit (${(size / 1024 / 1024).toFixed(1)} MB). Compress or split the file.`;
  }
  if (!ACCEPTED_MIME.has(mime)) {
    return "Unsupported file type. Accepted: PDF, DOCX, XLSX, JPG, PNG, HEIC.";
  }
  return null;
}

const localDir = () => process.env.STORAGE_LOCAL_DIR ?? "./storage";

export async function putFile(key: string, data: Buffer, _mime: string): Promise<StoredFile> {
  const mode = process.env.STORAGE_MODE ?? "local";
  await scanForViruses(data); // PRD §7.5 — Azure Defender boundary

  if (mode === "azure-blob") {
    // Boundary: upload to Azure Blob, enable soft-delete + versioning, return blob URL/key.
    throw new Error("azure-blob storage adapter not configured in reference build");
  }

  const safeKey = key.replace(/[^a-zA-Z0-9._/-]/g, "_");
  const full = path.join(localDir(), safeKey);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, data);
  return { storagePath: safeKey, sizeBytes: data.length };
}

export async function getFile(storagePath: string): Promise<Buffer> {
  const full = path.join(localDir(), storagePath);
  return readFile(full);
}

async function scanForViruses(_data: Buffer): Promise<void> {
  // No-op in local mode. In azure-blob mode, gate acceptance on Defender scan result.
  return;
}
