import { requireAuth } from "@/lib/rbac";
import { jsonError } from "@/lib/api";
import { getBoard } from "@/lib/unit-board";
import { matchesUnit, parseUnitFilters, segmentOf } from "@/lib/unit-filters";
import { panQueryHash, ACCOUNT_STATUS_LABELS } from "@/lib/report-filters";
import { hashPan } from "@/lib/pan";
import { PAYMENT_TYPES, stageLabel } from "@/lib/stage";
import { buildXlsx } from "@/lib/export-xlsx";
import { getActiveProject } from "@/lib/project-scope";
import { projectSlug } from "@/lib/project-label";
import type { Cell } from "@/lib/export-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/units/export?<same filters as the Dashboard> — the filtered units as Excel.
export async function GET(req: Request) {
  const gate = await requireAuth();
  if (!gate.ok) return gate.response;

  const sp = Object.fromEntries(new URL(req.url).searchParams.entries());
  const filters = parseUnitFilters(sp);
  let clientPanHash: string | null = null;
  try {
    clientPanHash = panQueryHash(filters.client, hashPan);
  } catch {}

  const board = await getBoard();
  const units = board.units.filter((u) => matchesUnit(u, filters, { clientPanHash }));
  const label = (await getActiveProject())?.label ?? "All projects";
  const dash = "—";

  try {
    const buf = await buildXlsx({
      title: `Units — ${label} (${units.length} found)`,
      landscape: true,
      columns: [
        { header: "Unit" }, { header: "Type" }, { header: "Sub type" }, { header: "Segment" }, { header: "Floor" },
        { header: "Area (sq ft)", align: "right" }, { header: "Status" }, { header: "Owner" }, { header: "Mobile" },
        { header: "Booking ID" }, { header: "Payment method" }, { header: "Scheme" }, { header: "Stage" },
        { header: "Total cost (Rs)", money: true }, { header: "Account status" }, { header: "Loan bank" },
        { header: "Booked by" }, { header: "Agreement signed" },
      ],
      rows: units.map((u): Cell[] => {
        const b = u.booking;
        return [
          u.name, u.unitType, u.subType ?? dash, segmentOf(u.unitType), u.floor ?? dash,
          u.areaSqft ? Number(u.areaSqft) : dash, u.status, u.owner ?? dash, b?.mobile ?? dash,
          b?.code ?? dash, b ? PAYMENT_TYPES[b.paymentType] : dash, b ? (b.stageBased ? "Stage-based" : "Schedule-based") : dash,
          b?.stage ? stageLabel(b.stage) : dash, b?.totalCost ?? "", b ? ACCOUNT_STATUS_LABELS[b.accountStatus] : dash,
          b?.loanBank ?? dash, b?.bookedBy ?? dash, b ? (b.hasAgreement ? "Yes" : "No") : dash,
        ];
      }),
    });
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="Units-${projectSlug(label)}.xlsx"`,
      },
    });
  } catch (err) {
    console.error(err);
    return jsonError("Export failed", 500);
  }
}
