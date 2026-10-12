import { NextResponse } from "next/server";
import { recordAudit } from "@/lib/audit";
import { jsonError, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { safeFileName, saveUpload } from "@/lib/uploads";

const TYPES = new Set(["RISK", "POLICY", "CONTROL", "ACTION"]);

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  if (auth.session.role === "BOARD_VIEWER") return jsonError("Board viewers cannot attach files.", 403);
  const form = await request.formData();
  const entityType = String(form.get("entityType") ?? "");
  const entityId = String(form.get("entityId") ?? "");
  const note = String(form.get("note") ?? "");
  const file = form.get("file");
  if (!TYPES.has(entityType) || !entityId) return jsonError("Say which record this file belongs to.");
  if (!(file instanceof File) || file.size === 0) return jsonError("Choose a file.");
  if (file.size > 5_000_000) return jsonError("Files must be 5 MB or smaller.");
  const id = `file-${Date.now()}`;
  const fileName = safeFileName(file.name);
  const storageKey = `${id}-${fileName}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  await saveUpload(storageKey, bytes);
  await prisma.attachment.create({
    data: {
      id,
      entityType,
      entityId,
      fileName,
      mimeType: file.type || "application/octet-stream",
      sizeBytes: bytes.length,
      storageKey,
      uploadedById: auth.session.id,
      note: note || null,
    },
  });
  await recordAudit({
    actor: auth.session,
    action: "UPLOAD",
    entityType,
    entityId,
    summary: `Attached ${fileName}.`,
  });
  return NextResponse.json({ id });
}
