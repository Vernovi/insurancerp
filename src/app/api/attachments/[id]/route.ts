import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { jsonError, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { uploadDir } from "@/lib/uploads";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const { id } = await context.params;
  const attachment = await prisma.attachment.findUnique({ where: { id } });
  if (!attachment) return jsonError("File not found.", 404);
  const bytes = await readFile(path.join(uploadDir(), attachment.storageKey));
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "content-type": attachment.mimeType,
      "content-disposition": `attachment; filename="${attachment.fileName}"`,
    },
  });
}
