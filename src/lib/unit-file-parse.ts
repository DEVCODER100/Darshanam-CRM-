/** Server-side: read an uploaded spreadsheet (xlsx or csv) into a grid of strings. */
import { Readable } from "node:stream";
import ExcelJS from "exceljs";

export const MAX_ROWS = 5000;

export async function readTable(buffer: Buffer, fileName: string): Promise<string[][]> {
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
