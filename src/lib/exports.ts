import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { formatDate } from "./format";
import { labelize } from "./domain";
import { categoryName, type BoardPack } from "@/server/board";

/** Helvetica in pdf-lib is WinAnsi. Map the marks the pack actually uses, then drop the rest. */
export function winAnsiText(value: string): string {
  const replaced = value
    .replaceAll("₦", "NGN")
    .replaceAll("—", "-")
    .replaceAll("–", "-")
    .replaceAll("·", "|")
    .replaceAll("×", "x")
    .replaceAll("’", "'")
    .replaceAll("‘", "'")
    .replaceAll("“", '"')
    .replaceAll("”", '"')
    .replaceAll("…", "...");
  return replaced.replace(/[^\x09\x0a\x0d\x20-\x7e]/g, "");
}

function linesOf(pack: BoardPack): string[] {
  const lines = [
    "InsuranceRP  ·  Vernovi",
    `${pack.company}`,
    pack.profile,
    `Risk Committee pack  ·  ${formatDate(pack.generatedAt)}`,
    `Compliance score: ${pack.complianceScore === null ? "not assessed" : `${pack.complianceScore}%`}`,
    `Risks above appetite: ${pack.aboveAppetite.length}`,
    `Open actions: ${pack.openActions.length} (${pack.overdueCount} overdue)`,
    `Open findings: ${pack.findings.length}`,
    "",
    "Top 10 risks by residual score",
  ];
  pack.topRisks.forEach((risk, index) => {
    lines.push(
      `${index + 1}. ${risk.code}  ${risk.title}  [${risk.lineOfBusiness}]  residual ${risk.residualScore}  ${categoryName(pack, risk.category)}  ${risk.appetite}  owner ${risk.owner.name}`,
    );
  });
  lines.push("", "Risks above appetite");
  if (pack.aboveAppetite.length === 0) lines.push("None.");
  pack.aboveAppetite.forEach((risk) => {
    lines.push(
      `${risk.code}  ${risk.title}  residual ${risk.residualScore} / limit ${risk.appetiteLimit}  escalation ${labelize(risk.escalationStatus)}  ${risk.owner.name}`,
    );
  });
  lines.push("", "Open actions");
  pack.openActions.forEach((action) => {
    lines.push(
      `${action.code}  ${action.title}  due ${formatDate(action.dueDate)}  ${action.overdue ? "OVERDUE" : action.status}  ${action.owner.name}`,
    );
  });
  lines.push("", "Compliance");
  pack.frameworkScores.forEach((framework) => {
    lines.push(
      `${framework.name}: ${framework.percent === null ? "not assessed" : `${framework.percent}%`} (${framework.assessed}/${framework.total} assessed)`,
    );
  });
  lines.push("", "Audit findings still open");
  pack.findings.forEach((finding) => {
    lines.push(`${finding.code}  ${finding.severity}  ${finding.title}  ${finding.owner.name}`);
  });
  lines.push("", "Key risk indicators");
  pack.kris.forEach((kri) => {
    lines.push(`${kri.code}  ${kri.name}  ${kri.currentValue} ${kri.unit}  ${kri.rag}`);
  });
  lines.push("", "Fictional trial data for Harbourline Assurance Plc. Not a regulatory filing.");
  return lines;
}

export async function buildBoardPdf(pack: BoardPack): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const lines = linesOf(pack);
  let page = doc.addPage([595, 842]);
  let y = 800;
  const drawHeader = () => {
    page.drawRectangle({ x: 0, y: 800, width: 595, height: 42, color: rgb(0.08, 0.15, 0.12) });
    page.drawText("InsuranceRP board pack", { x: 40, y: 816, size: 14, font: bold, color: rgb(0.96, 0.94, 0.9) });
    y = 780;
  };
  drawHeader();
  for (const line of lines) {
    if (y < 48) {
      page = doc.addPage([595, 842]);
      drawHeader();
    }
    const heading = /^(Top 10|Risks above|Open actions|Compliance|Audit findings|Key risk)/.test(line);
    page.drawText(winAnsiText(line).slice(0, 110), {
      x: 40,
      y,
      size: heading ? 12 : 9,
      font: heading ? bold : font,
      color: rgb(0.1, 0.1, 0.1),
    });
    y -= heading ? 18 : 13;
  }
  return doc.save();
}

export async function buildBoardXlsx(pack: BoardPack): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "InsuranceRP";
  const cover = workbook.addWorksheet("Cover");
  cover.addRows([
    ["InsuranceRP", "Vernovi"],
    ["Company", pack.company],
    ["Profile", pack.profile],
    ["Generated", formatDate(pack.generatedAt)],
    ["Compliance score", pack.complianceScore ?? "Not assessed"],
    ["Risks above appetite", pack.aboveAppetite.length],
    ["Open actions", pack.openActions.length],
    ["Overdue actions", pack.overdueCount],
    ["Open findings", pack.findings.length],
  ]);
  cover.getColumn(1).width = 28;
  cover.getColumn(2).width = 72;

  const top = workbook.addWorksheet("Top 10 risks");
  top.addRow(["Code", "Title", "Line", "Category", "Residual", "Band", "Appetite", "Owner"]);
  pack.topRisks.forEach((risk) => {
    top.addRow([risk.code, risk.title, risk.lineOfBusiness, categoryName(pack, risk.category), risk.residualScore, risk.band, risk.appetite, risk.owner.name]);
  });

  const above = workbook.addWorksheet("Above appetite");
  above.addRow(["Code", "Title", "Line", "Category", "Residual", "Limit", "Escalation", "Note", "Owner"]);
  pack.aboveAppetite.forEach((risk) => {
    above.addRow([
      risk.code,
      risk.title,
      risk.lineOfBusiness,
      categoryName(pack, risk.category),
      risk.residualScore,
      risk.appetiteLimit,
      risk.escalationStatus,
      risk.escalationNote ?? "",
      risk.owner.name,
    ]);
  });

  const actionSheet = workbook.addWorksheet("Open actions");
  actionSheet.addRow(["Code", "Title", "Source", "Due", "Status", "Overdue", "Priority", "Owner", "Risk"]);
  pack.openActions.forEach((action) => {
    actionSheet.addRow([
      action.code,
      action.title,
      action.sourceType,
      formatDate(action.dueDate),
      action.status,
      action.overdue ? "YES" : "NO",
      action.priority,
      action.owner.name,
      action.risk?.code ?? "",
    ]);
  });

  const compliance = workbook.addWorksheet("Compliance");
  compliance.addRow(["Framework", "Score", "Assessed", "Elements"]);
  pack.frameworkScores.forEach((framework) => {
    compliance.addRow([framework.name, framework.percent ?? "Not assessed", framework.assessed, framework.total]);
  });

  const findingSheet = workbook.addWorksheet("Audit findings");
  findingSheet.addRow(["Code", "Severity", "Status", "Title", "Source", "Owner"]);
  pack.findings.forEach((finding) => {
    findingSheet.addRow([finding.code, finding.severity, finding.status, finding.title, finding.source, finding.owner.name]);
  });

  const kriSheet = workbook.addWorksheet("KRIs");
  kriSheet.addRow(["Code", "Name", "Value", "Unit", "Status", "Risk", "Owner"]);
  pack.kris.forEach((kri) => {
    kriSheet.addRow([kri.code, kri.name, kri.currentValue, kri.unit, kri.rag, kri.risk?.code ?? "", kri.owner.name]);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export function toCsv(rows: string[][]): string {
  return rows
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
    .join("\n");
}
