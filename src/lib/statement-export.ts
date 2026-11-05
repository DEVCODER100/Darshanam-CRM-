/**
 * statement-export.ts — builds the downloadable sheets for the month-wise
 * Payment Received / Payment Due / Statement reports, laid out like the
 * reference files: title row with the date range, a tip line, a header row,
 * numbered rows, and a totals row. Projected dues are highlighted in yellow.
 * The Received and Due sheets keep the reference column order and add PAN.
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
  /** Column indexes kept for the PDF (the full sheet is too wide for a page). */
  pdfKeep?: number[];
}

const money = (header: string): ExportColumn => ({ header, money: true });
const text = (header: string): ExportColumn => ({ header });
const num = (header: string): ExportColumn => ({ header, align: "right" });

const dateOrDash = (iso: string | null) => (iso ? formatReportDate(iso) : "-");
const panCell = (pan: string, missing: boolean) => (missing ? "MISSING" : pan || "-");
const withNote = (tip: string, note: string) => (note ? `${tip}  Filters: ${note}.` : tip);

export function receivedSheet(r: ReceivedReport, note = ""): StatementSheet {
  const columns: ExportColumn[] = [
    num("No."), // 0
    text("Payment Date"), // 1
    text("Unit Name"), // 2
    text("Client (Main Applicant)"), // 3
    text("PAN No. (Main Applicant)"), // 4
    text("All Joint Applicants"), // 5
    text("Receipt No. / Reference No."), // 6
    text("Payment No."), // 7
    text("Payment Received From"), // 8
    text("Payment Mode"), // 9
    text("Instrument Date"), // 10
    text("Bank Name"), // 11
    text("Instrument No."), // 12
    money("Amount Received [Excl. TDS & Incl. GST] (Rs)"), // 13
    text("TDS Percentage (%)"), // 14
    money("TDS Amount (Rs)"), // 15
    money("Amount Received [Incl. TDS & Incl. GST] (Rs)"), // 16
    money("CGST Received (Rs)"), // 17
    money("SGST Received (Rs)"), // 18
    money("Service Tax Received (Rs)"), // 19
    text("Payment For"), // 20
    money("Amount Refunded (Rs)"), // 21
    text("Received from Bank (Loan Processing)"), // 22
    text("Received from Branch (Loan Processing)"), // 23
    text("Deposited In"), // 24
    text("Client ID"), // 25
    text("Booking ID"), // 26
    text("Booked By"), // 27
    text("Booked By ID"), // 28
    text("Relationship Manager"), // 29
    text("Relationship Manager ID"), // 30
    text("Payment Received By"), // 31
    text("Payment Received By ID"), // 32
    text("Narration"), // 33
    money("Basic Amount (Rs)"), // 34
    money("Maintenance / Other Charges (Rs)"), // 35
    money("Document Charges (Rs)"), // 36
  ];
  const rows: Cell[][] = r.rows.map((x) => [
    x.no, formatReportDate(x.date), x.unit, x.customer, panCell(x.pan, x.panMissing), x.joint || "-",
    x.receiptNo, x.paymentNumber, x.paidBy, x.mode, dateOrDash(x.instrumentDate), x.bank,
    x.instrumentNumber, x.total, "", 0n, x.total, x.cgst, x.sgst, 0n, x.paymentFor, 0n,
    x.loanBank, x.loanBranch, "-", x.clientCode, x.bookingCode, x.bookedBy, "-", "-", "-",
    x.receivedBy, "-", x.narration, x.basic, x.maintenance, x.documentation,
  ]);
  const footer: Cell[] = Array(columns.length).fill("");
  footer[1] = "Total";
  footer[13] = r.totals.total;
  footer[16] = r.totals.total;
  footer[17] = r.totals.cgst;
  footer[18] = r.totals.sgst;
  footer[34] = r.totals.basic;
  footer[35] = r.totals.maintenance;
  footer[36] = r.totals.documentation;
  return {
    title: `Payment Received Report From ${formatReportDate(r.from)} To ${formatReportDate(r.to)}`,
    tip: withNote(
      "Total received = basic + GST (CGST + SGST) + maintenance / other charges + document charges.",
      note,
    ),
    landscape: true,
    columns,
    rows,
    footer,
    pdfKeep: [0, 1, 2, 3, 4, 7, 8, 9, 10, 11, 13, 17, 18],
  };
}

export function dueSheet(r: DueReport, note = ""): StatementSheet {
  const columns: ExportColumn[] = [
    num("No."), // 0
    text("Due Date"), // 1
    text("Unit Name"), // 2
    text("Installment / Other Charge"), // 3
    money("Installment Due (Rs)"), // 4
    money("Installment CGST Due (Rs)"), // 5
    money("Installment SGST Due (Rs)"), // 6
    money("Installment Service Tax Due (Rs)"), // 7
    money("Other Charge Due (Rs)"), // 8
    money("Other Charge CGST Due (Rs)"), // 9
    money("Other Charge SGST Due (Rs)"), // 10
    money("Other Charge Service Tax Due (Rs)"), // 11
    money("Total Due (Rs)"), // 12
    num("Due Since (Days)"), // 13
    text("Main Applicant Name"), // 14
    text("PAN No. (Main Applicant)"), // 15
    text("Joint Applicant Name(s)"), // 16
    text("Mobile No. (Main Applicant)"), // 17
    text("Phone No. (Main Applicant)"), // 18
    text("Bank Name (Loan Processing)"), // 19
    text("Branch Name (Loan Processing)"), // 20
    text("Branch Contact No. (Loan Processing)"), // 21
    num("Installment Percentage (%)"), // 22
    text("Booking ID"), // 23
    text("Booked By"), // 24
    text("Staff Representative"), // 25
    text("Relationship Manager"), // 26
    text("Client ID"), // 27
    money("Maintenance Due (Rs)"), // 28
    money("Document Charges Due (Rs)"), // 29
  ];
  const rows: Cell[][] = r.rows.map((x) => [
    x.no, formatReportDate(x.dueDate), x.unit, x.instalment, x.basic, x.cgst, x.sgst, 0n,
    x.other + x.doc, 0n, 0n, 0n, x.total, x.projected ? "-" : x.daysOverdue, x.customer,
    panCell(x.pan, x.panMissing), x.joint || "-", x.mobile, x.phone || "-", x.loanBank, x.loanBranch,
    x.loanBranchContact, x.percentage ?? "-", x.bookingCode, x.bookedBy, "-", "-",
    x.clientCode, x.other, x.doc,
  ]);
  const footer: Cell[] = Array(columns.length).fill("");
  footer[1] = "Total";
  footer[4] = r.totals.basic;
  footer[5] = r.totals.cgst;
  footer[6] = r.totals.sgst;
  footer[8] = r.totals.other + r.totals.doc;
  footer[12] = r.totals.total;
  footer[28] = r.totals.other;
  footer[29] = r.totals.doc;
  return {
    title: `Payment Due Report From ${formatReportDate(r.from)} To ${formatReportDate(r.to)}`,
    tip: withNote("[Tip: Projected Dues are highlighted in Yellow]", note),
    landscape: true,
    columns,
    rows,
    footer,
    highlight: r.rows.map((x) => x.projected),
    pdfKeep: [0, 1, 2, 3, 4, 5, 6, 12, 13, 14, 15, 17],
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
      ["Document charges", "doc"],
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

/** The PDF cannot fit 30+ columns, so it keeps a readable subset. */
export function pdfTable(sheet: StatementSheet): ExportTable {
  if (!sheet.pdfKeep) return sheet;
  const keep = sheet.pdfKeep;
  const pick = <T,>(xs: T[]) => keep.map((i) => xs[i]);
  return {
    title: sheet.title,
    landscape: sheet.landscape,
    columns: pick(sheet.columns),
    rows: sheet.rows.map((r) => pick(r)),
    footer: sheet.footer ? pick(sheet.footer) : undefined,
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
  const ws = wb.addWorksheet(sheet.title.replace(/[\/?*[\]:]/g, "-").slice(0, 31));
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
