import Link from "next/link";
import type { UnitPanelData } from "@/lib/unit-board";
import { formatINR } from "@/lib/money";
import { stageDisbursement } from "@/lib/stage-ladder";
import { PAYMENT_TYPES, stageLabel } from "@/lib/stage";
import { PaymentEntry } from "@/components/PaymentEntry";
import { StageUpdateButton } from "@/components/StageUpdateButton";
import { UnitBlock, type StaffChoice } from "@/components/UnitBlock";

export interface PanelAccess {
  canBook: boolean;
  canPay: boolean;
  canEditBooking: boolean;
  canManageUnits: boolean;
  staff: StaffChoice[];
  currentUserId: string;
}

/** Everything about one unit: owner, money, charges, stage and payment record. */
export function UnitPanel({
  data,
  access,
  closeHref,
}: {
  data: UnitPanelData;
  access: PanelAccess;
  closeHref: string;
}) {
  const { unit, detail, charges } = data;
  const booking = detail?.booking;
  const customer = detail?.customer;
  const cost = detail?.cost;
  const o = detail?.outstanding;

  return (
    <div className="card space-y-5 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium">{unit.name}</h2>
          <p className="text-xs text-muted">
            {[unit.projectName, unit.areaSqft && `${Number(unit.areaSqft).toLocaleString("en-IN")} sq ft`, unit.floor && `Floor ${unit.floor}`]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill status={unit.status} />
          <Link href={closeHref} className="text-sm text-muted hover:text-ink" aria-label="Close panel">✕</Link>
        </div>
      </div>

      {unit.status === "available" && (
        <div className="space-y-3">
          <p className="text-sm text-muted">This unit is free. Nobody has booked it.</p>
          <div className="flex flex-wrap gap-2">
            {access.canBook && (
              <Link href={`/bookings/new?unitId=${unit.id}`} className="btn-primary">Book this unit</Link>
            )}
            {access.canManageUnits && (
              <UnitBlock unitId={unit.id} blocked={false} staff={access.staff} currentUserId={access.currentUserId} />
            )}
          </div>
        </div>
      )}

      {unit.status === "blocked" && unit.block && (
        <div className="space-y-3">
          <section className="grid grid-cols-2 gap-3 text-sm">
            <Info label="Held for" value={unit.block.name} />
            <Info label="Contact" value={unit.block.mobile || "—"} />
            <Info label="Blocked by" value={unit.block.by ?? "—"} />
            <Info label="Blocked on" value={unit.block.on ?? "—"} />
            <Info label="Unblocks on" value={unit.block.until ?? "Never"} />
            <Info label="Remarks" value={unit.block.reason ?? "—"} />
          </section>
          <div className="flex flex-wrap gap-2">
            {access.canBook && (
              <Link
                href={`/bookings/new?unitId=${unit.id}${unit.block.customerId ? `&customerId=${unit.block.customerId}` : ""}`}
                className="btn-primary"
              >
                Book this unit
              </Link>
            )}
            {access.canManageUnits && (
              <UnitBlock unitId={unit.id} blocked staff={access.staff} currentUserId={access.currentUserId} />
            )}
          </div>
        </div>
      )}

      {unit.status === "booked" && booking && customer && cost && o && (
        <>
          <section>
            <p className="text-xs uppercase tracking-wide text-muted">Owner</p>
            <Link href={`/customers/${customer.id}`} className="font-medium text-brass-dark hover:underline">
              {customer.fullName}
            </Link>
            <p className="text-sm text-muted">{customer.mobile}{customer.email ? ` · ${customer.email}` : ""}</p>
            {customer.address && <p className="text-sm text-muted">{customer.address}</p>}
          </section>

          <section className="grid grid-cols-2 gap-3 text-sm">
            <Info label="Booked on" value={booking.bookingDate} />
            <Info label="Payment type" value={PAYMENT_TYPES[booking.paymentType] ?? booking.paymentType} />
            <Info label="Agreement value" value={formatINR(cost.agreementValue, { paise2dp: false })} money />
            <Info label="Total cost" value={formatINR(cost.totalCost, { paise2dp: false })} money />
          </section>

          <section className="grid grid-cols-2 gap-3">
            <Stat label="Received" value={formatINR(o.totalPaid, { paise2dp: false })} tone="paid" />
            <Stat
              label={o.isAdvance ? "Advance" : "Payment due"}
              value={formatINR(o.isAdvance ? o.advanceAmount : o.outstanding, { paise2dp: false })}
              tone={o.isAdvance ? "paid" : "due"}
            />
          </section>

          {booking.stageBased && (() => {
            const d = stageDisbursement(cost.totalCost, booking.currentStage, o.totalPaid);
            return (
              <section className="rounded-md border border-hairline bg-canvas p-3 text-sm">
                <p className="font-medium">
                  {stageLabel(booking.currentStage)} · {d.currentPercentBps / 100}%
                </p>
                <p className="text-muted">
                  Eligible <span className="money">{formatINR(d.eligible, { paise2dp: false })}</span>
                  {" · "}
                  Due now <span className="money text-due">{formatINR(d.pendingRelease, { paise2dp: false })}</span>
                  {d.nextStage && <> · Next: {d.nextStage.label}</>}
                </p>
              </section>
            );
          })()}

          <section>
            <p className="mb-2 text-xs uppercase tracking-wide text-muted">Charges</p>
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted">
                <tr>
                  <th className="py-1 font-medium">Item</th>
                  <th className="py-1 text-right font-medium">Total</th>
                  <th className="py-1 text-right font-medium">Received</th>
                  <th className="py-1 text-right font-medium">Due now</th>
                </tr>
              </thead>
              <tbody>
                {charges.map((c) => (
                  <tr key={c.label} className="border-t border-hairline">
                    <td className="py-1.5">{c.label}</td>
                    <td className="money py-1.5 text-right">{formatINR(c.total, { paise2dp: false })}</td>
                    <td className="money py-1.5 text-right text-paid">{formatINR(c.received, { paise2dp: false })}</td>
                    <td className="money py-1.5 text-right text-due">{formatINR(c.due, { paise2dp: false })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs uppercase tracking-wide text-muted">Payment record</p>
              <span className="text-xs text-muted">{detail.payments.length} payment{detail.payments.length === 1 ? "" : "s"}</span>
            </div>
            {detail.payments.length === 0 ? (
              <p className="text-sm text-muted">No payments yet.</p>
            ) : (
              <ul className="divide-y divide-hairline text-sm">
                {detail.payments.slice(0, 8).map((p) => (
                  <li key={p.id} className="flex items-baseline justify-between py-1.5">
                    <span>
                      {p.paymentDate}
                      <span className="ml-2 text-xs text-muted">{p.paymentFor ?? p.mode.replace("_", " ")}</span>
                    </span>
                    <span className="money font-medium text-paid">{formatINR(p.amount, { paise2dp: false })}</span>
                  </li>
                ))}
              </ul>
            )}
            {detail.payments.length > 8 && (
              <Link href={`/bookings/${booking.id}`} className="mt-1 inline-block text-xs text-brass-dark hover:underline">
                See all payments →
              </Link>
            )}
          </section>

          {detail.loan && (
            <section className="text-sm">
              <p className="text-xs uppercase tracking-wide text-muted">Loan</p>
              <p>
                {detail.loan.status.replace("_", " ")}
                {detail.loan.bankName ? ` · ${detail.loan.bankName}` : ""}
                {detail.loan.loanAmount ? ` · ${formatINR(detail.loan.loanAmount, { paise2dp: false })}` : ""}
              </p>
            </section>
          )}

          <section className="space-y-3 border-t border-hairline pt-4">
            <div className="flex flex-wrap gap-2">
              {access.canEditBooking && booking.stageBased && (
                <StageUpdateButton bookingId={booking.id} currentStage={booking.currentStage} canEdit />
              )}
              <Link href={`/bookings/${booking.id}`} className="btn-secondary">
                Full booking page
              </Link>
              {access.canEditBooking && (
                <Link href={`/bookings/${booking.id}/edit`} className="btn-secondary">Edit booking</Link>
              )}
            </div>
            <PaymentEntry
              bookingId={booking.id}
              canAdd={access.canPay}
              gstBps={cost.gstPercentBps}
              docBps={cost.documentationPercentBps}
            />
          </section>
        </>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const cls =
    status === "booked" ? "pill-danger" : status === "available" ? "pill-paid" : "pill-neutral";
  return <span className={cls}>{status[0].toUpperCase() + status.slice(1)}</span>;
}

function Info({ label, value, money }: { label: string; value: string; money?: boolean }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className={money ? "money" : ""}>{value}</p>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: "paid" | "due" }) {
  return (
    <div className="rounded-md bg-canvas p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className={`money mt-0.5 text-lg font-medium ${tone === "paid" ? "text-paid" : "text-due"}`}>{value}</p>
    </div>
  );
}
