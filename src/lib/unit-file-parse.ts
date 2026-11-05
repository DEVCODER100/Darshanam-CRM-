/** Server-side: read an uploaded spreadsheet (xlsx or csv) into a grid of strings. */
import { Readable } from "node:stream";
import ExcelJS from "exceljs";

export const MAX_ROWS = 5000;

/** The old .xls format, through SheetJS (parse only; the file comes from a signed-in admin). */
async function readXls(buffer: Buffer): Promise<string[][]> {
  const XLSX = await import("xlsx");
  const book = XLSX.read(buffer, { type: "buffer" });
  const grid = XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[book.SheetNames[0]], { header: 1, raw: false, defval: "", blankrows: true });
  return grid.slice(0, MAX_ROWS).map((r) => r.map((c) => String(c ?? "").trim()));
}

export async function readTable(buffer: Buffer, fileName: string): Promise<string[][]> {
  if (/\.xls$/i.test(fileName)) return readXls(buffer);
  const wb = new ExcelJS.Workbook();
  const ws = /\.csv$/i.test(fileName)
    ? await wb.csv.read(Readable.from(buffer))
    : (await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer), wb.worksheets[0]);
  if (!ws) return [];
  const rows: string[][] = [];
  ws.eachRow({ includeEmpty: true }, (row) => {
    if (rows.length >= MAX_ROWS) return;
    const cells: string[] = [];
    for (let c = 1; c <= ws.columnCount; c++) cells.push(row.getCell(c).text.trim());
    rows.push(cells);
  });
  return rows;
}
