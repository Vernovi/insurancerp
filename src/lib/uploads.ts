import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export function uploadDir(): string {
  return path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), "data", "uploads"));
}

export async function saveUpload(storageKey: string, bytes: Buffer): Promise<void> {
  const dir = uploadDir();
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, storageKey), bytes);
}

export function safeFileName(name: string): string {
  const base = path.basename(name).replace(/[^a-zA-Z0-9._-]+/g, "_");
  return base.slice(0, 120) || "attachment";
}
