/** Generic, serialisable report table used by both the Excel and PDF exporters. */
export type Cell = string | number | bigint;

export interface ExportColumn {
  header: string;
  money?: boolean; // cell values are bigint paise -> formatted/numeric
  align?: "left" | "right";
}

export interface ExportTable {
  title: string;
  columns: ExportColumn[];
  rows: Cell[][];
  footer?: Cell[];
}
