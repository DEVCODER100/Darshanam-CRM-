import Link from "next/link";
import { getDashboardData } from "@/lib/dashboard";
import { formatINR } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const d = await getDashboardData();

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-medium">Dashboard</h1>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/calendar" className="text-brass-dark hover:underline">Calendar →</Link>
          <Link href="/reports/gst" className="text-brass-dark hover:underline">GST tracker →</Link>
          <Link href="/reports" className="text-brass-dark hover:underline">Reports →</Link>
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card label="Total customers" value={String(d.totalCustomers)} href="/customers" />
        <Card label="Total bookings" value={String(d.totalBookings)} href="/bookings" />
        <Card label="Total sales value" value={formatINR(d.totalSalesValue, { paise2dp: false })} />
        <Card label="Total receivable" value={formatINR(d.totalReceivable, { paise2dp: false })} />
        <Card label="Total received" value={formatINR(d.totalReceived, { paise2dp: false })} href="/reports/monthly" />
        <Card label="Total outstanding" value={formatINR(d.totalOutstanding, { paise2dp: false })} accent="amber" href="/reports/outstanding" />
        <Card label="Pending loan amount" value={formatINR(d.pendingLoanAmount, { paise2dp: false })} href="/reports/loan" />
        <Card label="Active loans" value={String(d.activeLoans)} href="/reports/loan" />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">Payment breakdown</h2>
        <div className="grid gap-4 lg:grid-cols-3">
          <BreakdownCard label="Self finance" data={d.paymentBreakdown.self_finance} />
          <BreakdownCard label="Bank loan" data={d.paymentBreakdown.bank_loan} />
          <BreakdownCard label="Installment" data={d.paymentBreakdown.installment} />
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-medium">Stage-wise bank disbursement</h2>
          <Link href="/stages" className="text-sm text-brass-dark hover:underline">
            Stage tracking →
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card label="Stage customers" value={String(d.stageMetrics.customers)} href="/stages" />
          <Card label="Pending bank release" value={formatINR(d.stageMetrics.pendingRelease, { paise2dp: false })} accent="amber" href="/stages" />
          <Card label="Released amount" value={formatINR(d.stageMetrics.released, { paise2dp: false })} href="/stages" />
          <Card label="Remaining amount" value={formatINR(d.stageMetrics.remaining, { paise2dp: false })} href="/stages" />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">Alerts</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Alert label="Overdue payments" count={d.alerts.overduePayments} tone="amber" href="/alerts/overdue" />
          <Alert label="Due this month" count={d.alerts.dueThisMonth} tone="blue" href="/alerts/due-this-month" />
          <Alert label="Loan docs pending" count={d.alerts.loanDocsPending} tone="gray" href="/alerts/loan-docs" />
          <Alert label="Loan approval pending" count={d.alerts.loanApprovalPending} tone="gray" href="/alerts/loan-approval" />
        </div>
      </section>
    </div>
  );
}

function BreakdownCard({
  label,
  data,
}: {
  label: string;
  data: { receivable: bigint; received: bigint; due: bigint };
}) {
  return (
    <div className="card p-4">
      <h3 className="mb-3 font-medium">{label}</h3>
      <dl className="space-y-2 text-sm">
        <MoneyLine label="Receivable" value={data.receivable} />
        <MoneyLine label="Received" value={data.received} tone="paid" />
        <MoneyLine label="Due" value={data.due} tone="due" />
      </dl>
    </div>
  );
}

function MoneyLine({
  label,
  value,
  tone,
}: {
  label: string;
  value: bigint;
  tone?: "paid" | "due";
}) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted">{label}</dt>
      <dd
        className={`money font-medium ${
          tone === "paid" ? "text-paid" : tone === "due" ? "text-due" : ""
        }`}
      >
        {formatINR(value, { paise2dp: false })}
      </dd>
    </div>
  );
}

function Card({
  label,
  value,
  accent,
  href,
}: {
  label: string;
  value: string;
  accent?: "amber";
  href?: string;
}) {
  const cls = `block rounded-lg border p-4 shadow-card ${accent === "amber" ? "border-l-[3px] border-l-due border-hairline bg-surface" : "border-hairline bg-surface"} ${href ? "transition hover:shadow-pop hover:border-brass/40" : ""}`;
  const inner = (
    <>
      <p className="text-xs tracking-wide text-muted">{label}</p>
      <p className="money mt-1 text-xl font-medium text-ink">{value}</p>
    </>
  );
  return href ? <Link href={href} className={cls}>{inner}</Link> : <div className={cls}>{inner}</div>;
}

function Alert({
  label,
  count,
  tone,
  href,
}: {
  label: string;
  count: number;
  tone: "amber" | "blue" | "gray";
  href: string;
}) {
  const tones = {
    amber: "border-due/30 bg-due-bg text-due",
    blue: "border-hairline bg-inkbg text-slate2",
    gray: "border-hairline bg-surface text-ink",
  } as const;
  return (
    <Link
      href={href}
      className={`block rounded-lg border p-4 shadow-card transition hover:shadow-pop ${tones[tone]}`}
    >
      <p className="money text-2xl font-medium">{count}</p>
      <p className="flex items-center justify-between text-sm">
        {label}
        <span aria-hidden>→</span>
      </p>
    </Link>
  );
}
