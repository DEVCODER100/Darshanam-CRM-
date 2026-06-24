import { stageDisbursement, stageLadder, type StageStatus } from "@/lib/stage-ladder";
import { stageLabel, CONSTRUCTION_STAGES } from "@/lib/stage";
import type { ConstructionStage } from "@/lib/stage";
import { formatINR } from "@/lib/money";

const SHORT: Record<string, string> = {
  plinth: "Plinth",
  ground_floor: "Ground",
  first_floor: "First",
  second_floor: "Second",
  outside_plaster: "Plaster",
  flooring: "Flooring",
  finishing: "Finishing",
};

/**
 * Stage Payment section — summary fields, the "you can collect now" prompt, and
 * the per-stage history table. Recomputed on every render from live payments,
 * so it updates automatically after a payment or a stage change.
 */
export function StagePanel({
  totalCost,
  currentStage,
  received,
  lastPaymentDate,
  compact = false,
}: {
  totalCost: bigint;
  currentStage: ConstructionStage | null;
  received: bigint;
  lastPaymentDate: string | null;
  compact?: boolean;
}) {
  const d = stageDisbursement(totalCost, currentStage, received);
  const ladder = stageLadder(totalCost, currentStage, received);
  const currentIndex = currentStage
    ? CONSTRUCTION_STAGES.findIndex((s) => s.value === currentStage)
    : -1;

  return (
    <div className="space-y-4">
      {/* Collect-now prompt */}
      {currentStage && d.pendingRelease > 0n ? (
        <p className="rounded-md border border-due/30 bg-due-bg px-3 py-2 text-sm text-due">
          You can now collect{" "}
          <span className="money font-medium">{formatINR(d.pendingRelease)}</span>{" "}
          based on the current construction stage ({d.currentPercentBps / 100}%).
        </p>
      ) : currentStage ? (
        <p className="rounded-md border border-paid/30 bg-paid-bg px-3 py-2 text-sm text-paid">
          Current stage fully collected.
        </p>
      ) : (
        <p className="rounded-md bg-inkbg px-3 py-2 text-sm text-slate2">
          No construction stage set for this booking.
        </p>
      )}

      {/* Summary fields */}
      <dl className={`grid gap-3 text-sm ${compact ? "sm:grid-cols-3" : "sm:grid-cols-4"}`}>
        <Field label="Total property cost" value={formatINR(totalCost)} />
        <Field label="Current stage" value={stageLabel(currentStage)} plain />
        <Field label="Stage %" value={`${d.currentPercentBps / 100}%`} plain />
        <Field label="Eligible amount" value={formatINR(d.eligible)} />
        <Field label="Total received" value={formatINR(d.received)} tone="paid" />
        <Field label="Current amount due" value={formatINR(d.pendingRelease)} tone="due" />
        <Field label="Remaining balance" value={formatINR(d.remaining)} />
        <Field label="Last payment date" value={lastPaymentDate ?? "—"} plain />
        <Field label="Next stage" value={d.nextStage ? d.nextStage.label : "—"} plain />
        <Field
          label="Payment status"
          value={d.fullyPaid ? "Paid" : "Due"}
          plain
        />
      </dl>

      {/* Construction stage progress tracker */}
      <div className="rounded-md border border-hairline p-4">
        <div className="overflow-x-auto">
          <div className="flex min-w-[600px] items-start">
            {CONSTRUCTION_STAGES.map((s, i) => {
              const state =
                currentIndex < 0
                  ? "upcoming"
                  : i < currentIndex
                    ? "done"
                    : i === currentIndex
                      ? "current"
                      : "upcoming";
              const dot =
                state === "done"
                  ? "bg-paid"
                  : state === "current"
                    ? "bg-brass ring-4 ring-brass/20"
                    : "bg-hairline";
              return (
                <div key={s.value} className="flex flex-1 flex-col items-center">
                  <div className="flex w-full items-center">
                    <span className={`h-0.5 flex-1 ${i === 0 ? "bg-transparent" : i <= currentIndex ? "bg-paid" : "bg-hairline"}`} />
                    <span className={`h-3 w-3 flex-shrink-0 rounded-full ${dot}`} />
                    <span className={`h-0.5 flex-1 ${i === CONSTRUCTION_STAGES.length - 1 ? "bg-transparent" : i < currentIndex ? "bg-paid" : "bg-hairline"}`} />
                  </div>
                  <span className={`mt-1.5 text-xs font-medium ${state === "current" ? "text-brass-dark" : state === "done" ? "text-paid" : "text-muted"}`}>
                    {s.percentBps / 100}%
                  </span>
                  <span className="text-center text-[11px] text-muted">{SHORT[s.value]}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted">
          <Legend dot="bg-paid" label="Completed" />
          <Legend dot="bg-brass" label="Current stage" />
          <Legend dot="bg-hairline" label="Upcoming" />
        </div>
      </div>

      {/* Stage history table */}
      <div className="overflow-hidden rounded-md border border-hairline">
        <table className="data-table">
          <thead>
            <tr>
              <th>Stage</th>
              <th>%</th>
              <th className="text-right">Eligible</th>
              <th className="text-right">Received</th>
              <th className="text-right">Due</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {ladder.map((r) => (
              <tr key={r.value}>
                <td>{r.label}</td>
                <td>{r.percentBps / 100}%</td>
                <td className="money text-right">{formatINR(r.eligibleAmount)}</td>
                <td className="money text-right">{r.received === null ? "—" : formatINR(r.received)}</td>
                <td className="money text-right">{r.due === null ? "—" : formatINR(r.due)}</td>
                <td><StageStatusPill status={r.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Legend({ dot, label }: { dot: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

function StageStatusPill({ status }: { status: StageStatus }) {
  const map = {
    completed: { cls: "pill-paid", text: "Paid" },
    active: { cls: "pill bg-inkbg text-ink", text: "Current" },
    pending: { cls: "pill-due", text: "Pending" },
    locked: { cls: "pill-neutral", text: "Locked" },
  } as const;
  const { cls, text } = map[status];
  return <span className={cls}>{text}</span>;
}

function Field({
  label,
  value,
  tone,
  plain,
}: {
  label: string;
  value: string;
  tone?: "paid" | "due";
  plain?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd
        className={`${plain ? "" : "money"} ${
          tone === "paid" ? "text-paid" : tone === "due" ? "text-due" : "text-ink"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
