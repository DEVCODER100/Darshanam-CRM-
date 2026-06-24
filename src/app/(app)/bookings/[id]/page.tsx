import Link from "next/link";
import { notFound } from "next/navigation";
import { loadBookingDetail, todayISO } from "@/lib/booking-detail";
import { getCurrentUser } from "@/lib/rbac";
import { can } from "@/lib/permissions";
import { formatINR, paiseToRupeeString, bpsToPercentString } from "@/lib/money";
import { allocatePayments, type CoverageStatus } from "@/lib/allocation";
import { computeGstStatus } from "@/lib/gst-calc";
import { StagePanel } from "@/components/StagePanel";
import { ScheduleEditor } from "@/components/ScheduleEditor";
import { PaymentEntry, DeletePaymentButton } from "@/components/PaymentEntry";
import { LoanPanel } from "@/components/LoanPanel";

export const dynamic = "force-dynamic";

const MODE_LABELS: Record<string, string> = {
  bank_transfer: "Bank transfer",
  cheque: "Cheque",
  cash: "Cash",
  upi: "UPI",
  card: "Card",
  other: "Other",
};

export default async function BookingDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await getCurrentUser();
  const d = await loadBookingDetail(params.id);
  if (!d) notFound();

  const {
    booking,
    customer,
    cost,
    schedule,
    payments,
    loan,
    outstanding,
    receivableSummary,
  } = d;
  const o = outstanding;

  // GST owed proportional to basic collected (basic = amount − gstAmount per payment).
  const basicCollected = payments.reduce((s, p) => s + (p.amount - p.gstAmount), 0n);
  const gstCollected = payments.reduce((s, p) => s + p.gstAmount, 0n);
  const gstStatus = cost
    ? computeGstStatus({
        gstRateBps: cost.gstPercentBps,
        basicCollected,
        gstCollected,
      })
    : null;

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
       <div>
        {customer && (
          <Link href={`/customers/${customer.id}`} className="text-sm text-brass-dark hover:underline">
            ← {customer.fullName}
          </Link>
        )}
        <h1 className="mt-2 text-2xl font-medium text-ink">
          {booking.propertyType} {booking.propertyNumber ?? ""}
        </h1>
        <p className="mt-1 flex items-center gap-2 text-sm text-muted">
          <span>Booked {booking.bookingDate}</span>
          <span className="pill-neutral">
            {booking.paymentType === "bank_loan"
              ? "Bank loan"
              : booking.paymentType === "installment"
                ? "Installment"
                : "Self finance"}
          </span>
          {booking.stageBased && (
            <span className="pill-neutral">
              {receivableSummary.stageLabel} (
              {receivableSummary.stagePercentBps / 100}%)
            </span>
          )}
        </p>
       </div>
       {user && can(user.role, "booking:edit") && (
         <Link href={`/bookings/${booking.id}/edit`} className="btn-secondary">
           Edit booking
         </Link>
       )}
      </div>

      {/* Three headline numbers — Outstanding, Total amount, GST. */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Outstanding — what's overdue as of today */}
        <div
          className={`border border-hairline bg-surface p-5 shadow-card ${
            o.isAdvance
              ? "border-l-[3px] border-l-paid"
              : o.outstanding > 0n
                ? "border-l-[3px] border-l-due"
                : "rounded-lg"
          }`}
        >
          <p className="text-xs tracking-wide text-muted">
            Outstanding amount · as of {todayISO()}
          </p>
          {o.isAdvance ? (
            <p className="money mt-2 text-3xl font-medium text-paid">
              Advance: {formatINR(o.advanceAmount)}
            </p>
          ) : (
            <p className="money mt-2 text-3xl font-medium text-ink">
              {formatINR(o.outstanding)}
            </p>
          )}
          <p className="money mt-1.5 text-xs text-muted">
            Due till date {formatINR(o.dueTillDate)} − Paid {formatINR(o.totalPaid)}
          </p>
        </div>

        {/* Total amount to pay — the gross total cost (whole plan) */}
        <div className="rounded-lg border border-hairline bg-surface p-5 shadow-card">
          <p className="text-xs tracking-wide text-muted">
            Total amount to pay · whole plan
          </p>
          <p className="money mt-2 text-3xl font-medium text-ink">
            {cost ? formatINR(cost.totalCost) : "—"}
          </p>
          <p className="money mt-1.5 text-xs text-muted">
            Paid {formatINR(o.totalPaid)} · Balance {formatINR(o.balancePropertyValue)}
          </p>
        </div>

        {/* GST — shortfall = GST due on collection (5% × basic paid) − GST paid */}
        {gstStatus && (
          <div
            className={`border border-hairline bg-surface p-5 shadow-card ${
              gstStatus.gstShortfall > 0n
                ? "border-l-[3px] border-l-due"
                : "rounded-lg"
            }`}
          >
            <p className="text-xs tracking-wide text-muted">
              GST payable now (shortfall)
            </p>
            <p className="money mt-2 text-3xl font-medium text-ink">
              {formatINR(gstStatus.gstShortfall)}
            </p>
            <p className="money mt-1.5 text-xs text-muted">
              Collected {formatINR(gstStatus.gstCollected)} of{" "}
              {formatINR(gstStatus.gstDueOnCollection)} due on collection
            </p>
          </div>
        )}
      </section>

      {/* Stage-wise bank disbursement panel */}
      {booking.stageBased && cost && (
        <section>
          <h2 className="mb-3 text-lg font-medium text-ink">Stage payment</h2>
          <div className="card border-l-[3px] border-l-brass p-5">
            <StagePanel
              totalCost={cost.totalCost}
              currentStage={booking.currentStage}
              received={o.totalPaid}
              lastPaymentDate={payments[0]?.paymentDate ?? null}
            />
          </div>
        </section>
      )}

      {o.overpaidWholePlan && (
        <p className="rounded-md border border-danger/30 bg-danger-bg px-3 py-2 text-sm text-danger">
          Total paid exceeds total property cost — please check for a data-entry error.
        </p>
      )}

      {/* Cost breakdown */}
      <section>
        <h2 className="mb-3 text-lg font-medium text-ink">Cost breakdown</h2>
        {cost ? (
          <dl className="card grid gap-3 p-4 text-sm sm:grid-cols-2">
            <Line label="Base cost" value={formatINR(cost.baseCost)} />
            <Line label="Extra charges" value={formatINR(cost.extraCharges)} />
            <Line label="Discount" value={`− ${formatINR(cost.discount)}`} />
            <Line label="Agreement value" value={formatINR(cost.agreementValue)} />
            <Line label={`GST (${bpsToPercentString(BigInt(cost.gstPercentBps))}%)`} value={formatINR(cost.gstAmount)} />
            <Line label="Maintenance" value={formatINR(cost.maintenanceCharge)} />
            <Line label={`Documentation (${bpsToPercentString(BigInt(cost.documentationPercentBps))}%)`} value={formatINR(cost.documentationAmount)} />
            <Line label="Total cost" value={formatINR(cost.totalCost)} strong />
          </dl>
        ) : (
          <p className="text-sm text-muted">No cost structure.</p>
        )}
      </section>

      {/* Payment allocation — which cost components the money received covers */}
      {cost && (
        <section>
          <h2 className="mb-1 text-lg font-medium text-ink">Payment allocation</h2>
          <p className="mb-3 text-xs text-muted">
            How {formatINR(o.totalPaid)} received so far covers each component
            (applied Base → GST → Maintenance → Documentation).
          </p>
          <div className="card overflow-hidden">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Component</th>
                  <th className="text-right">Amount</th>
                  <th className="text-right">Covered</th>
                  <th className="text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {allocatePayments(
                  {
                    baseCost: cost.baseCost,
                    gstAmount: cost.gstAmount,
                    maintenanceCharge: cost.maintenanceCharge,
                    documentationAmount: cost.documentationAmount,
                  },
                  o.totalPaid,
                ).map((c) => (
                  <tr key={c.key}>
                    <td className={c.key === "gst" ? "font-medium text-ink" : ""}>
                      {c.label}
                    </td>
                    <td className="money text-right">{formatINR(c.amount)}</td>
                    <td className="money text-right text-muted">{formatINR(c.covered)}</td>
                    <td className="text-right">
                      <CoveragePill status={c.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Payment schedule */}
      <section>
        <h2 className="mb-3 text-lg font-medium text-ink">Payment schedule</h2>
        <div className="card p-4">
          <ScheduleEditor
            bookingId={booking.id}
            canEdit={!!user && can(user.role, "schedule:edit")}
            gstBps={cost?.gstPercentBps ?? 0}
            totalPaid={o.totalPaid}
            initial={schedule.map((s) => ({
              dueDate: s.dueDate,
              amount: paiseToRupeeString(s.amount),
              label: s.label ?? "",
            }))}
          />
        </div>
      </section>

      {/* Payments */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-medium text-ink">Payments received</h2>
          <PaymentEntry bookingId={booking.id} canAdd={!!user && can(user.role, "payment:create")} gstBps={cost?.gstPercentBps ?? 0} />
        </div>
        {payments.length === 0 ? (
          <p className="text-sm text-muted">No payments recorded.</p>
        ) : (
          <div className="card overflow-hidden">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th className="text-right">Basic</th>
                  <th className="text-right">GST</th>
                  <th className="text-right">Total</th>
                  <th>Mode</th>
                  <th>Source</th>
                  <th>Reference</th>
                  <th>Receipt</th>
                  {user && can(user.role, "payment:delete") && <th />}
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td>{p.paymentDate}</td>
                    <td className="money text-right">{formatINR(p.amount - p.gstAmount)}</td>
                    <td className="money text-right text-muted">{formatINR(p.gstAmount)}</td>
                    <td className="money text-right font-medium text-paid">{formatINR(p.amount)}</td>
                    <td><span className="pill-neutral">{MODE_LABELS[p.mode] ?? p.mode}</span></td>
                    <td>{p.source === "bank" ? "Bank release" : "Customer"}</td>
                    <td className="text-muted">{p.referenceNumber ?? "—"}</td>
                    <td>
                      {p.attachmentUrl ? (
                        <a href={p.attachmentUrl} target="_blank" rel="noopener noreferrer" className="text-brass-dark hover:underline">
                          View
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    {user && can(user.role, "payment:delete") && (
                      <td className="text-right">
                        <DeletePaymentButton bookingId={booking.id} paymentId={p.id} />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Loan */}
      <section>
        <h2 className="mb-3 text-lg font-medium text-ink">Loan</h2>
        <LoanPanel
          bookingId={booking.id}
          canEdit={!!user && can(user.role, "loan:edit")}
          loan={
            loan
              ? {
                  status: loan.status,
                  loanAmount: loan.loanAmount?.toString() ?? null,
                  customerContribution:
                    loan.customerContribution?.toString() ?? null,
                  amountReleased: loan.amountReleased.toString(),
                  bankName: loan.bankName,
                  referenceNumber: loan.referenceNumber,
                  sanctionDate: loan.sanctionDate,
                  approvalDate: loan.approvalDate,
                  disbursementDate: loan.disbursementDate,
                }
              : null
          }
        />
      </section>
    </div>
  );
}

function CoveragePill({ status }: { status: CoverageStatus }) {
  const map = {
    paid: { cls: "pill-paid", text: "Paid" },
    partial: { cls: "pill-due", text: "Partial" },
    pending: { cls: "pill-danger", text: "Pending" },
    na: { cls: "pill-neutral", text: "—" },
  } as const;
  const { cls, text } = map[status];
  return <span className={cls}>{text}</span>;
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? "sm:col-span-2 border-t border-hairline pt-2 font-medium" : ""}`}>
      <dt className="text-muted">{label}</dt>
      <dd className="money text-ink">{value}</dd>
    </div>
  );
}
