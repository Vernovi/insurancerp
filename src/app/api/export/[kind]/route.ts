import { NextResponse } from "next/server";
import { recordAudit } from "@/lib/audit";
import { jsonError, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { labelize } from "@/lib/domain";
import { buildBoardPdf, buildBoardXlsx, toCsv } from "@/lib/exports";
import { formatDate } from "@/lib/format";
import { canExportBoard } from "@/lib/permissions";
import { isOverdue } from "@/lib/scoring";
import { getBoardPack } from "@/server/board";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ kind: string }> }) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const { kind } = await context.params;

  if (kind === "risks.csv" || kind === "actions.csv" || kind === "declarations.csv") {
    const csv = await buildCsv(kind);
    await recordAudit({
      actor: auth.session,
      action: "EXPORT",
      entityType: "EXPORT",
      summary: `Exported ${kind}.`,
    });
    return new NextResponse(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${kind}"`,
      },
    });
  }

  if (kind !== "board.pdf" && kind !== "board.xlsx") return jsonError("Unknown export.", 404);
  if (!canExportBoard(auth.session.role)) return jsonError("Staff accounts cannot export the board pack.", 403);
  const pack = await getBoardPack();
  await recordAudit({
    actor: auth.session,
    action: "EXPORT",
    entityType: "BOARD_PACK",
    summary: `Exported the Risk Committee pack (${kind}).`,
  });
  if (kind === "board.pdf") {
    const pdf = await buildBoardPdf(pack);
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": "attachment; filename=harbourline-risk-committee.pdf",
      },
    });
  }
  const xlsx = await buildBoardXlsx(pack);
  return new NextResponse(new Uint8Array(xlsx), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": "attachment; filename=harbourline-risk-committee.xlsx",
    },
  });
}

async function buildCsv(kind: string): Promise<string> {
  if (kind === "risks.csv") {
    const risks = await prisma.risk.findMany({ include: { owner: true, department: true }, orderBy: { code: "asc" } });
    return toCsv([
      ["Code", "Title", "Line", "Category", "Owner", "Department", "Inherent", "Residual", "Status"],
      ...risks.map((risk) => [
        risk.code,
        risk.title,
        risk.lineOfBusiness,
        risk.category,
        risk.owner.name,
        risk.department.name,
        String(risk.inherentScore),
        String(risk.residualScore),
        risk.status,
      ]),
    ]);
  }
  if (kind === "actions.csv") {
    const actions = await prisma.actionItem.findMany({ include: { owner: true }, orderBy: { code: "asc" } });
    return toCsv([
      ["Code", "Title", "Owner", "Due", "Status", "Overdue", "Priority"],
      ...actions.map((action) => [
        action.code,
        action.title,
        action.owner.name,
        formatDate(action.dueDate),
        action.status,
        isOverdue(action.dueDate, action.status) ? "YES" : "NO",
        action.priority,
      ]),
    ]);
  }
  const declarations = await prisma.declaration.findMany({ include: { user: true, campaign: true }, orderBy: { id: "asc" } });
  return toCsv([
    ["Campaign", "Person", "Type", "Status", "Submitted"],
    ...declarations.map((row) => [
      row.campaign.name,
      row.user.name,
      labelize(row.type),
      row.status,
      formatDate(row.submittedAt),
    ]),
  ]);
}
