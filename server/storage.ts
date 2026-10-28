import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

// Complaint attachments are stored on local disk (UPLOAD_DIR, default ./uploads) and served through /files/<key>,
// which checks that the viewer owns the complaint or is staff.

export const uploadDir = () => path.resolve(process.env.UPLOAD_DIR ?? "uploads");

/** Resolve a storage key to a file path, refusing anything that escapes the upload directory. */
export function localPathForKey(key: string): string | null {
  const root = uploadDir();
  const full = path.resolve(root, key);
  return full.startsWith(root + path.sep) ? full : null;
}

const normalizeKey = (relKey: string) => relKey.replace(/^\/+/, "");

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

export async function storagePut(relKey: string, data: Buffer | Uint8Array | string): Promise<{ key: string; url: string }> {
  const key = appendHashSuffix(normalizeKey(relKey));
  const target = localPathForKey(key);
  if (!target) throw new Error("Invalid storage key");
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, typeof data === "string" ? Buffer.from(data) : data);
  return { key, url: `/files/${key}` };
}
