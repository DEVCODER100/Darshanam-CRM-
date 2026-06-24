import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { stageHistory, users } from "@/db/schema";
import { loadBookingDetail } from "@/lib/booking-detail";
import { getCurrentUser } from "@/lib/rbac";
import { can } from "@/lib/permissions";
import { stageLabel } from "@/lib/stage";
import type { ConstructionStage } from "@/lib/stage";
import { formatINR } from "@/lib/money";
import { StagePanel } from "@/components/StagePanel";
import { StageUpdateButton } from "@/components/StageUpdateButton";
import { PaymentEntry } from "@/components/PaymentEntry";

export const dynamic = "force-dynamic";

const MODE_LABELS: Record<string, string> = {
  bank_transfer: "Bank transfer",
  rtgs: "RTGS",
  neft: "NEFT",
  cheque: "Cheque",
  cash: "Cash",
  upi: "UPI",
  card: "Card",
  other: "Other",
};

export default async function StageDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await getCurrentUser();
  const detail = await loadBookingDetail(params.id);
  if (!detail) notFound();
  const { booking, customer, cost, payments, outstanding } = detail;

  const history = await db
    .select({
      id: stageHistory.id,
      previousStage: stageHistory.previousStage,
      newStage: stageHistory.newStage,
      remarks: stageHistory.remarks,
      createdAt: stageHistory.createdAt,
      changedBy: users.name,
    })
    .from(stageHistory)
    .leftJoin(users, eq(stageHistory.changedBy, users.id))
    .where(eq(stageHistory.bookingId, booking.id))
    .orderBy(desc(stageHistory.createdAt));

  const canEdit = !!user && can(user.role, "booking:edit");
  const canPay = !!user && can(user.role, "payment:create");

  return (
    <div className="space-y-7">
      <div>
        <Link href="/stages" className="text-sm text-brass-dark hover:underline">
          ← Stage Payments
        </Link>
        <h1 className="mt-2 text-2xl font-medium">
          {customer?.fullName ?? "Customer"} · {booking.propertyType} {booking.propertyNumber ?? ""}
        </h1>
      </div>

      {/* Customer information */}
      <section>
        <h2 className="mb-3 text-lg font-medium">Customer information</h2>
        <dl className="card grid gap-4 p-4 text-sm sm:grid-cols-3">
          <Info label="Customer name" value={customer?.fullName ?? "—"} />
          <Info label="Phone" value={customer?.mobile ?? "—"} />
          <Info label="Property type" value={booking.propertyType} />
          <Info label="Unit number" value={booking.propertyNumber ?? "—"} />
          <Info label="Booking date" value={booking.bookingDate} />
          <Info label="Total property amount" value={cost ? formatINR(cost.totalCost) : "—"} money />
        </dl>
      </section>

      {/* Quick actions */}
      {(canEdit || canPay) && (
        <section className="flex flex-wrap gap-3">
          {canEdit && (
            <StageUpdateButton
              bookingId={booking.id}
              currentStage={booking.currentStage}
              canEdit={canEdit}
            />
          )}
          {canPay && (
            <PaymentEntry
              bookingId={booking.id}
              canAdd={canPay}
              gstBps={cost?.gstPercentBps ?? 0}
            />
          )}
        </section>
      )}

      {/* Stage summary + progress tracker + ladder */}
      <section>
        <h2 className="mb-3 text-lg font-medium">Stage payment</h2>
        <div className="card border-l-[3px] border-l-brass p-5">
          <StagePanel
            totalCost={cost?.totalCost ?? 0n}
            currentStage={booking.currentStage}
            received={outstanding.totalPaid}
            lastPaymentDate={payments[0]?.paymentDate ?? null}
          />
        </div>
      </section>

      {/* Stage history */}
      <section>
        <h2 className="mb-3 text-lg font-medium">Stage history</h2>
        {history.length === 0 ? (
          <p className="text-sm text-muted">No stage changes recorded yet.</p>
        ) : (
          <div className="card overflow-hidden">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Previous stage</th>
                  <th>New stage</th>
                  <th>Updated by</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id}>
                    <td className="whitespace-nowrap">
                      {new Date(h.createdAt).toLocaleDateString("en-IN")}
                    </td>
                    <td>{stageLabel(h.previousStage as ConstructionStage | null)}</td>
                    <td>{stageLabel(h.newStage as ConstructionStage | null)}</td>
                    <td className="text-muted">{h.changedBy ?? "—"}</td>
                    <td className="text-muted">{h.remarks ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Payment history */}
      <section>
        <h2 className="mb-3 text-lg font-medium">Payment history</h2>
        {payments.length === 0 ? (
          <p className="text-sm text-muted">No payments recorded.</p>
        ) : (
          <div className="card overflow-hidden">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th className="text-right">Amount</th>
                  <th>Mode</th>
                  <th>Reference</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td>{p.paymentDate}</td>
                    <td className="money text-right font-medium text-paid">{formatINR(p.amount)}</td>
                    <td>{MODE_LABELS[p.mode] ?? p.mode}</td>
                    <td className="text-muted">{p.referenceNumber ?? "—"}</td>
                    <td className="text-muted">{p.notes ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Info({
  label,
  value,
  money,
}: {
  label: string;
  value: string;
  money?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className={money ? "money" : ""}>{value}</dd>
    </div>
  );
}
