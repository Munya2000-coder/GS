import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { toCsv } from "@/lib/csv";
import { recordAudit } from "@/lib/audit";
import { getReportRows, reportTitle } from "../reports";

/**
 * Report CSV export (PRD Module 31).
 * Route handler — auth enforced inline.
 */
export async function GET(req: Request) {
  const user = await requirePermission("reports.export");
  const type = new URL(req.url).searchParams.get("type") ?? "";

  const rows = await getReportRows(type);
  if (rows === null) {
    return new NextResponse("Unknown report type", { status: 400 });
  }

  const csv = toCsv(rows);

  await recordAudit({
    actor: user,
    action: "report.export",
    entityType: "Report",
    summary: `Report "${reportTitle(type)}" exported as CSV`,
  });

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${type}.csv"`,
    },
  });
}
