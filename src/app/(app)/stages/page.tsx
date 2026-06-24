import Link from "next/link";
import { getStageDisbursementList, getStageMetrics } from "@/lib/stage-tracking";
import { formatINR } from "@/lib/money";
import { CONSTRUCTION_STAGES } from "@/lib/stage";

export const dynamic = "force-dynamic";

export default async function StagePaymentsPage({
  searchParams,
}: {
  searchParams: { q?: string; stage?: string; status?: string; type?: string };
}) {
  const [all, metrics] = await Promise.all([
    getStageDisbursementList(),
    getStageMetrics(),
  ]);

  const q = searchParams.q?.trim().toLowerCase();
  const rows = all.filter((r) => {
    if (q) {
      const hay = `${r.customerName} ${r.propertyNumber ?? ""} ${r.mobile}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (searchParams.stage && r.currentStage !== searchParams.stage) return false;
    if (searchParams.type && r.propertyType !== searchParams.type) return false;
    if (searchParams.status === "paid" && !r.fullyPaid) return false;
    if (searchParams.status === "due" && r.fullyPaid) return false;
    return true;
  });

  const propertyTypes = [...new Set(all.map((r) => r.propertyType))];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-medium">Stage Payments</h1>
        <p className="mt-1 text-sm text-muted">
          Customers paying through the construction-stage payment system.
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Stage customers" value={String(metrics.customers)} />
        <Stat label="Total eligible" value={formatINR(metrics.eligible, { paise2dp: false })} />
        <Stat label="Total received" value={formatINR(metrics.released, { paise2dp: false })} tone="paid" />
        <Stat label="Total outstanding" value={formatINR(metrics.pendingRelease, { paise2dp: false })} tone="due" />
        <Stat label="Remaining balance" value={formatINR(metrics.remaining, { paise2dp: false })} />
      </section>

      <form className="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
        <input name="q" className="field" placeholder="Name, unit no. or phone" defaultValue={searchParams.q} />
        <select name="stage" className="field" defaultValue={searchParams.stage}>
          <option value="">All stages</option>
          {CONSTRUCTION_STAGES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <select name="status" className="field" defaultValue={searchParams.status}>
          <option value="">All statuses</option>
          <option value="due">Due</option>
          <option value="paid">Paid</option>
        </select>
        <select name="type" className="field" defaultValue={searchParams.type}>
          <option value="">All property types</option>
          {propertyTypes.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <button className="btn-primary">Apply</button>
      </form>

      {rows.length === 0 ? (
        <p className="text-sm text-muted">
          {all.length === 0
            ? 'No stage-payment bookings. Turn on "Stage-based collection" on a booking and set its current stage.'
            : "No stage customers match these filters."}
        </p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Type</th>
                <th>Unit</th>
                <th className="text-right">Total</th>
                <th>Current stage</th>
                <th className="text-right">Eligible</th>
                <th className="text-right">Received</th>
                <th className="text-right">Due</th>
                <th className="text-right">Balance</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.bookingId}>
                  <td>{r.customerName}</td>
                  <td>{r.propertyType}</td>
                  <td>{r.propertyNumber ?? "—"}</td>
                  <td className="money text-right">{formatINR(r.totalCost)}</td>
                  <td>
                    {r.stageLabel}
                    {r.currentStage && (
                      <span className="text-muted"> ({r.currentPercentBps / 100}%)</span>
                    )}
                  </td>
                  <td className="money text-right">{formatINR(r.eligible)}</td>
                  <td className="money text-right text-paid">{formatINR(r.received)}</td>
                  <td className="money text-right font-medium text-due">{formatINR(r.pendingRelease)}</td>
                  <td className="money text-right">{formatINR(r.remaining)}</td>
                  <td>
                    <span className={r.fullyPaid ? "pill-paid" : "pill-due"}>
                      {r.fullyPaid ? "Paid" : "Due"}
                    </span>
                  </td>
                  <td className="text-right">
                    <Link href={`/stages/${r.bookingId}`} className="btn-secondary px-2.5 py-1 text-xs">
                      View Details
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "paid" | "due";
}) {
  return (
    <div className="card p-4">
      <p className="text-xs tracking-wide text-muted">{label}</p>
      <p
        className={`money mt-1 text-lg font-medium ${
          tone === "paid" ? "text-paid" : tone === "due" ? "text-due" : "text-ink"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
