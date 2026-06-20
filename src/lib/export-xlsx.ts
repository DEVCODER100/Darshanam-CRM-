import ExcelJS from "exceljs";
import type { ExportTable, Cell } from "./export-types";

const RUPEE_FMT = '"₹"#,##0.00';

function moneyToRupees(paise: Cell): number {
  const big = typeof paise === "bigint" ? paise : BigInt(paise);
  // Number is safe here for display-scale crore values (< 2^53 paise).
  return Number(big) / 100;
}

/** Convert a money cell, but leave blank cells (e.g. spanning footer labels) as-is. */
function conv(cell: Cell, money?: boolean): Cell {
  if (!money || cell === "" || cell === null || cell === undefined) return cell;
  return moneyToRupees(cell);
}

export async function buildXlsx(table: ExportTable): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Darshanam CRM";
  wb.created = new Date();
  const ws = wb.addWorksheet(table.title.slice(0, 31));

  const headerRow = ws.addRow(table.columns.map((c) => c.header));
  headerRow.font = { bold: true };
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF1F5F9" },
    };
  });

  for (const row of table.rows) {
    const out = row.map((cell, i) => conv(cell, table.columns[i]?.money));
    const r = ws.addRow(out);
    table.columns.forEach((c, i) => {
      if (c.money) r.getCell(i + 1).numFmt = RUPEE_FMT;
      r.getCell(i + 1).alignment = {
        horizontal: c.align ?? (c.money ? "right" : "left"),
      };
    });
  }

  if (table.footer) {
    const out = table.footer.map((cell, i) => conv(cell, table.columns[i]?.money));
    const r = ws.addRow(out);
    r.font = { bold: true };
    table.columns.forEach((c, i) => {
      if (c.money) r.getCell(i + 1).numFmt = RUPEE_FMT;
    });
  }

  table.columns.forEach((c, i) => {
    const col = ws.getColumn(i + 1);
    col.width = Math.max(c.header.length + 2, c.money ? 16 : 18);
  });

  const arrayBuffer = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
