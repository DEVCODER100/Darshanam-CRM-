import { createElement as h } from "react";
import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { ExportTable, Cell } from "./export-types";
import { formatINR } from "./money";

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 9, fontFamily: "Helvetica" },
  title: { fontSize: 14, marginBottom: 4, fontFamily: "Helvetica-Bold" },
  meta: { fontSize: 8, color: "#666", marginBottom: 12 },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#ddd" },
  headerRow: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    borderBottomWidth: 1,
    borderBottomColor: "#cbd5e1",
  },
  cell: { padding: 4 },
  headerCell: { padding: 4, fontFamily: "Helvetica-Bold" },
  footerRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#cbd5e1",
  },
});

function fmt(cell: Cell, money?: boolean): string {
  if (money) {
    const big = typeof cell === "bigint" ? cell : BigInt(cell);
    return formatINR(big);
  }
  return String(cell ?? "");
}

export async function buildPdf(table: ExportTable): Promise<Buffer> {
  const cols = table.columns;
  const colStyle = (money?: boolean) => ({
    flex: 1,
    textAlign: (money ? "right" : "left") as "right" | "left",
  });

  const header = h(
    View,
    { style: styles.headerRow, key: "h" },
    cols.map((c, i) =>
      h(Text, { key: i, style: [styles.headerCell, colStyle(c.money)] }, c.header),
    ),
  );

  const body = table.rows.map((row, ri) =>
    h(
      View,
      { style: styles.row, key: ri, wrap: false },
      row.map((cell, ci) =>
        h(
          Text,
          { key: ci, style: [styles.cell, colStyle(cols[ci]?.money)] },
          fmt(cell, cols[ci]?.money),
        ),
      ),
    ),
  );

  const footer = table.footer
    ? h(
        View,
        { style: styles.footerRow, key: "f" },
        table.footer.map((cell, ci) =>
          h(
            Text,
            { key: ci, style: [styles.headerCell, colStyle(cols[ci]?.money)] },
            cell === "" ? "" : fmt(cell, cols[ci]?.money),
          ),
        ),
      )
    : null;

  const doc = h(
    Document,
    null,
    h(
      Page,
      { size: "A4", style: styles.page },
      h(Text, { style: styles.title }, table.title),
      h(
        Text,
        { style: styles.meta },
        `Darshanam CRM · generated ${new Date().toLocaleString("en-IN")}`,
      ),
      header,
      ...body,
      ...(footer ? [footer] : []),
    ),
  );

  return renderToBuffer(doc);
}
