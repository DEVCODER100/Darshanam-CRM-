import Link from "next/link";
import { formatINR } from "@/lib/money";
import { todayISO } from "@/lib/dates";
import { formatReportDate } from "@/lib/statement";
import { queryString } from "@/lib/query-string";
import { resolvePeriod, type Params } from "@/lib/report-filters";
import { periodPresets, shapeTable } from "@/lib/report-period";
import { ledgerClients } from "@/lib/report-sales";
import { loadTable, type Tab } from "@/lib/report-hub";
import { getBoard } from "@/lib/unit-board";
import { filterOptions } from "@/lib/unit-table";
import { activeCount, parseUnitFilters } from "@/lib/unit-filters";
import { UnitFilterPanel } from "@/components/UnitFilterPanel";
import type { Cell, ExportColumn } from "@/lib/export-types";

const SIZES = [25, 50, 100, 0]; // 0 = all rows

const show = (v: Cell | undefined, c: ExportColumn) =>
  v === undefined || v === "" ? "" : c.money && typeof v === "bigint" ? formatINR(v) : String(v);

/** A report tab drawn from an ExportTable: date filter, order, paging, totals and downloads. */
export async function ReportTableTab({ tab, sp }: { tab: Tab; sp: Params }) {
  const period = resolvePeriod(sp);
  const table = await loadTable(tab.key, sp);
  const get = (k: string) => (Array.isArray(sp[k]) ? sp[k]![0] : sp[k]) ?? "";
  const size = SIZES.includes(Number(get("size"))) && get("size") !== "" ? Number(get("size")) : 50;
  const order = get("order") !== "" && Number.isInteger(Number(get("order"))) ? Number(get("order")) : undefined;
  const dir = get("dir") === "desc" ? "desc" : "asc";
  const shaped = shapeTable(table, { order, dir, page: Number(get("page")) || 1, size });
  const clients = tab.key === "ledger" ? await ledgerClients() : [];
  const board = tab.key === "unit" ? await getBoard() : null;
  const unitFilters = board ? parseUnitFilters(sp) : null;
  const download = (format: string) => `/api/reports/hub/export?${queryString(sp, { r: tab.key, format, page: null })}`;
  const here = (o: Record<string, string | null>) => `/reports?${queryString(sp, { r: tab.key, ...o })}`;
  const lab = "text-xs text-muted";

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-medium">{table.title}</h1>

      {board && unitFilters ? (
        <UnitFilterPanel
          values={Object.fromEntries(Object.entries(sp).filter(([, v]) => v) as [string, string][])}
          active={activeCount(unitFilters)}
          found={table.rows.length}
          total={board.units.length}
          options={filterOptions(board.units, board.types)}
          keep={{ r: tab.key }}
          resetHref="/reports?r=unit"
          downloadHref={download("xlsx")}
        />
      ) : (
        <form method="get" className="card space-y-3 p-3">
          <input type="hidden" name="r" value={tab.key} />
          {tab.period && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted">Period:</span>
              {periodPresets(todayISO()).map((p) => (
                <Link key={p.key} href={here({ from: p.from, to: p.to, month: null, page: null })} className="rounded-md border border-hairline px-2.5 py-1 hover:bg-canvas">
                  {p.label}
                </Link>
              ))}
              <span className="ml-auto text-muted">{formatReportDate(period.from)} to {formatReportDate(period.to)}</span>
            </div>
          )}
          <div className="flex flex-wrap items-end gap-3">
            {tab.period && (
              <>
                <label className={lab}>From<input type="date" name="from" defaultValue={period.from} className="field mt-1" /></label>
                <label className={lab}>To<input type="date" name="to" defaultValue={period.to} className="field mt-1" /></label>
              </>
            )}
            {tab.key === "ledger" && (
              <label className={lab}>
                Client
                <select name="client" defaultValue={get("client")} className="field mt-1 w-64">
                  <option value="">—Select a client—</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name}{c.code ? ` · ${c.code}` : ""}</option>)}
                </select>
              </label>
            )}
            <label className={lab}>
              Order by
              <span className="mt-1 flex gap-2">
                <select name="order" defaultValue={get("order")} className="field">
                  <option value="">Default</option>
                  {table.columns.map((c, i) => <option key={i} value={i}>{c.header}</option>)}
                </select>
                <select name="dir" defaultValue={dir} className="field w-32">
                  <option value="asc">Ascend</option>
                  <option value="desc">Descend</option>
                </select>
              </span>
            </label>
            <label className={lab}>
              Show
              <select name="size" defaultValue={String(size)} className="field mt-1">
                {SIZES.map((n) => <option key={n} value={n}>{n || "All"} rows</option>)}
              </select>
            </label>
            <button className="btn-primary px-4 py-2">Generate Report</button>
            <Link href={`/reports?r=${tab.key}`} className="btn-secondary px-4 py-2">Reset</Link>
            <span className="ml-auto flex gap-2">
              <a href={download("xlsx")} className="btn-secondary px-3 py-2">Excel</a>
              <a href={download("csv")} className="btn-secondary px-3 py-2">CSV</a>
              <a href={download("pdf")} className="btn-secondary px-3 py-2">PDF</a>
            </span>
          </div>
        </form>
      )}

      {table.rows.length === 0 ? (
        <p className="text-sm text-muted">{tab.key === "ledger" && !get("client") ? "Choose a client to see the ledger." : "Nothing found for these filters."}</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                {table.columns.map((c, i) => (
                  <th key={i} className={c.money || c.align === "right" ? "text-right" : ""}>{c.header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shaped.rows.map((r, i) => (
                <tr key={i}>
                  {table.columns.map((c, j) => (
                    <td key={j} className={c.money || c.align === "right" ? "money text-right" : ""}>{show(r[j], c)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
            {table.footer && (
              <tfoot>
                <tr className="border-t border-hairline bg-canvas font-medium">
                  {table.columns.map((c, j) => (
                    <td key={j} className={c.money || c.align === "right" ? "money text-right" : ""}>{show(table.footer![j], c)}</td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {shaped.pages > 1 && (
        <div className="flex items-center gap-3 text-sm text-muted">
          {shaped.page > 1 && <Link href={here({ page: String(shaped.page - 1) })} className="btn-secondary px-3 py-1">← Prev</Link>}
          <span>Page {shaped.page} of {shaped.pages} · {shaped.total} rows</span>
          {shaped.page < shaped.pages && <Link href={here({ page: String(shaped.page + 1) })} className="btn-secondary px-3 py-1">Next →</Link>}
        </div>
      )}
    </div>
  );
}
