/**
 * statement-export.ts — builds the downloadable sheets for the month-wise
 * Payment Received / Payment Due / Statement reports, laid out like the
 * reference files: title row with the date range, a tip line, a header row,
 * numbered rows, and a totals row. Projected dues are highlighted in yellow.
 */
import ExcelJS from "exceljs";
import type { Cell, ExportColumn, ExportTable } from "./export-types";
import { paiseToRupeeString } from "./money";
import { formatReportDate, sumComponents } from "./statement";
import type { Components } from "./statement";
import type { DueReport, ReceivedReport, Statement } from "./statement-data";

export interface StatementSheet extends ExportTable {
  tip: string;
  highlight?: boolean[]; // per data row: fill yellow
}

const money = (header: string): ExportColumn => ({ header, money: true });
const text = (header: string): ExportColumn => ({ header });
const num = (header: string): ExportColumn => ({ header, align: "right" });

export function receivedSheet(r: ReceivedReport): StatementSheet {
  const columns: ExportColumn[] = [
    num("No."), text("Payment Date"), text("Unit Name"), text("Client"), text("Mobile No."),
    text("Payment Type"), text("Payment Received From"), text("Payment Mode"),
    text("Receipt No. / Reference No."), text("Bank"),
    money("Basic Amount (Rs)"), money("CGST Received (Rs)"), money("SGST Received (Rs)"),
    money("Maintenance / Other Charges (Rs)"), money("Total Received (Rs)"),
    text("Payment For"), text("Narration"),
  ];
  const rows: Cell[][] = r.rows.map((x) => [
    x.no, formatReportDate(x.date), x.unit, x.customer, x.mobile, x.paymentType,
    x.paidBy, x.mode, x.reference, x.bank, x.basic, x.cgst, x.sgst, x.maintenance,
    x.total, x.paymentFor, x.narration,
  ]);
  const footer: Cell[] = Array(columns.length).fill("");
  footer[1] = "Total";
  footer[10] = r.totals.basic;
  footer[11] = r.totals.cgst;
  footer[12] = r.totals.sgst;
  footer[13] = r.totals.maintenance;
  footer[14] = r.totals.total;
  return {
    title: `Payment Received Report From ${formatReportDate(r.from)} To ${formatReportDate(r.to)}`,
    tip: "Total received = basic + GST (CGST + SGST) + maintenance / other charges.",
    landscape: true,
    columns,
    rows,
    footer,
  };
}

export function dueSheet(r: DueReport): StatementSheet {
  const columns: ExportColumn[] = [
    num("No."), text("Due Date"), text("Unit Name"), text("Client"), text("Mobile No."),
    text("Payment Type"), text("Installment / Other Charge"), num("Installment Percentage (%)"),
    money("Installment Due (Rs)"), money("CGST Due (Rs)"), money("SGST Due (Rs)"),
    money("Other Charge Due (Rs)"), money("Total Due (Rs)"), num("Due Since (Days)"),
    text("Bank Name (Loan Processing)"),
  ];
  const rows: Cell[][] = r.rows.map((x) => [
    x.no, formatReportDate(x.dueDate), x.unit, x.customer, x.mobile, x.paymentType,
    x.instalment, x.percentage ?? "—", x.basic, x.cgst, x.sgst, x.other, x.total,
    x.projected ? "—" : x.daysOverdue, x.loanBank,
  ]);
  const footer: Cell[] = Array(columns.length).fill("");
  footer[1] = "Total";
  footer[8] = r.totals.basic;
  footer[9] = r.totals.cgst;
  footer[10] = r.totals.sgst;
  footer[11] = r.totals.other;
  footer[12] = r.totals.total;
  return {
    title: `Payment Due Report From ${formatReportDate(r.from)} To ${formatReportDate(r.to)}`,
    tip: "[Tip: Projected Dues are highlighted in Yellow]",
    landscape: true,
    columns,
    rows,
    footer,
    highlight: r.rows.map((x) => x.projected),
  };
}

export function statementSheet(s: Statement): StatementSheet {
  const columns: ExportColumn[] = [
    text("Period"), text("Category"),
    money("Receivable (Rs)"), money("Received (Rs)"), money("Due (Rs)"),
  ];
  const block = (label: string, line: Statement["thisMonth"]): Cell[][] => {
    const cats: [string, keyof Components][] = [
      ["Installment (basic)", "basic"],
      ["GST (CGST + SGST)", "gst"],
      ["Other charges (maintenance)", "other"],
    ];
    const out: Cell[][] = cats.map(([name, k]) => [
      label, name, line.receivable[k], line.received[k], line.due[k],
    ]);
    out.push([
      label, "Total",
      sumComponents(line.receivable), sumComponents(line.received), sumComponents(line.due),
    ]);
    return out;
  };
  const monthLabel = `${formatReportDate(s.from)} to ${formatReportDate(s.to)}`;
  return {
    title: `Statement ${monthLabel}`,
    tip: "Receivable = scheduled instalments. Due = unpaid and already due as of the report date. Stage-based units are on the Stages page.",
    columns,
    rows: [...block(monthLabel, s.thisMonth), ...block("All time", s.allTime)],
  };
}

// --- writers ----------------------------------------------------------------

const RUPEE_FMT = '"₹"#,##0.00';

function moneyToRupees(v: Cell): Cell {
  if (v === "" || v === null || v === undefined) return v;
  const big = typeof v === "bigint" ? v : BigInt(v);
  return Number(big) / 100; // display scale only; fits well within 2^53
}

export async function buildStatementXlsx(sheet: StatementSheet): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Darshanam CRM";
  wb.created = new Date();
  const ws = wb.addWorksheet(sheet.title.slice(0, 31));
  const cols = sheet.columns.length;

  // Title and tip rows, merged across the table like the reference files.
  ws.mergeCells(1, 1, 1, cols);
  ws.getCell(1, 1).value = sheet.title;
  ws.getCell(1, 1).font = { bold: true, size: 13 };
  ws.mergeCells(2, 1, 2, cols);
  ws.getCell(2, 1).value = sheet.tip;
  ws.getCell(2, 1).font = { italic: true, color: { argb: "FF64748B" }, size: 10 };

  const header = ws.getRow(4);
  sheet.columns.forEach((c, i) => {
    const cell = header.getCell(i + 1);
    cell.value = c.header;
    cell.font = { bold: true };
    cell.alignment = { wrapText: true, vertical: "middle", horizontal: c.money || c.align === "right" ? "right" : "left" };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
    cell.border = { bottom: { style: "thin", color: { argb: "FFCBD5E1" } } };
  });
  header.height = 34;

  const writeRow = (r: number, values: Cell[], opts: { bold?: boolean; yellow?: boolean }) => {
    const row = ws.getRow(r);
    values.forEach((v, i) => {
      const col = sheet.columns[i];
      const cell = row.getCell(i + 1);
      cell.value = col?.money ? (moneyToRupees(v) as ExcelJS.CellValue) : (v as ExcelJS.CellValue);
      if (col?.money) cell.numFmt = RUPEE_FMT;
      cell.alignment = { horizontal: col?.money || col?.align === "right" ? "right" : "left" };
      if (opts.bold) cell.font = { bold: true };
      if (opts.yellow)
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF9C3" } };
    });
  };

  sheet.rows.forEach((values, i) =>
    writeRow(5 + i, values, { yellow: sheet.highlight?.[i] }),
  );
  if (sheet.footer) {
    writeRow(5 + sheet.rows.length, sheet.footer, { bold: true });
    ws.getRow(5 + sheet.rows.length).border = {
      top: { style: "thin", color: { argb: "FF94A3B8" } },
    };
  }

  sheet.columns.forEach((c, i) => {
    ws.getColumn(i + 1).width = Math.max(12, Math.min(34, c.header.length + 2));
  });
  ws.views = [{ state: "frozen", ySplit: 4 }];

  return Buffer.from(await wb.xlsx.writeBuffer());
}

const csvCell = (v: Cell | undefined, isMoney: boolean): string => {
  if (v === undefined || v === null || v === "") return "";
  const raw = isMoney
    ? paiseToRupeeString(typeof v === "bigint" ? v : BigInt(v))
    : String(v);
  return /[",\n]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
};

export function buildStatementCsv(sheet: StatementSheet): string {
  const lines = [
    sheet.columns.map((c) => csvCell(c.header, false)).join(","),
    ...sheet.rows.map((r) => r.map((v, i) => csvCell(v, !!sheet.columns[i]?.money)).join(",")),
  ];
  if (sheet.footer)
    lines.push(sheet.footer.map((v, i) => csvCell(v, !!sheet.columns[i]?.money)).join(","));
  return lines.join("\r\n");
}
