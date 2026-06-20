import Link from "next/link";
import { notFound } from "next/navigation";
import { formatINR } from "@/lib/money";
import { todayISO } from "@/lib/booking-detail";
import { getOutstandingReport } from "@/lib/reports";
import { getDueThisMonthList, getLoanStatusList } from "@/lib/alerts";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  pending_docs: "Pending docs",
  applied: "Applied",
  approved: "Approved",
  disbursed: "Disbursed",
  rejected: "Rejected",
  not_applicable: "Not applicable",
};

const TITLES: Record<string, string> = {
  overdue: "Overdue payments",
  "due-this-month": "Payments due this month",
  "loan-docs": "Loan documents pending",
  "loan-approval": "Loan approval pending",
};

export default async function AlertPage({
  params,
}: {
  params: { type: string };
}) {
  const type = params.type;
  if (!TITLES[type]) notFound();

  return (
    <div className="space-y-4">
      <div>
        <Link href="/dashboard" className="text-sm text-brass-dark hover:underline">
          ← Dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-medium">{TITLES[type]}</h1>
      </div>
      {type === "overdue" && <OverdueList />}
      {type === "due-this-month" && <DueList />}
      {type === "loan-docs" && <LoanList statuses={["pending_docs"]} />}
      {type === "loan-approval" && <LoanList statuses={["applied"]} />}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-muted">{text}</p>;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="card overflow-hidden">
      <table className="data-table">{children}</table>
    </div>
  );
}

async function OverdueList() {
  const rows = await getOutstandingReport();
  if (rows.length === 0) return <Empty text="No customers have outstanding dues. 🎉" />;
  const total = rows.reduce((s, r) => s + r.outstanding, 0n);
  return (
    <>
      <p className="text-sm text-muted">
        {rows.length} booking{rows.length === 1 ? "" : "s"} with dues outstanding as of {todayISO()}.
      </p>
      <Shell>
        <thead>
          <tr>
            <th>Customer</th>
            <th>Property</th>
            <th className="text-right">Paid</th>
            <th className="text-right">Outstanding</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.bookingId}>
              <td>{r.customerName}</td>
              <td>
                <Link href={`/bookings/${r.bookingId}`} className="text-brass-dark hover:underline">
                  {r.booking}
                </Link>
              </td>
              <td className="money text-right">{formatINR(r.paid)}</td>
              <td className="money text-right font-medium text-due">{formatINR(r.outstanding)}</td>
            </tr>
          ))}
          <tr>
            <td colSpan={3} className="font-medium">Total outstanding</td>
            <td className="money text-right font-medium">{formatINR(total)}</td>
          </tr>
        </tbody>
      </Shell>
    </>
  );
}

async function DueList() {
  const rows = await getDueThisMonthList();
  if (rows.length === 0) return <Empty text="No instalments fall due this month." />;
  const total = rows.reduce((s, r) => s + r.amount, 0n);
  return (
    <>
      <p className="text-sm text-muted">{rows.length} instalment(s) due this month.</p>
      <Shell>
        <thead>
          <tr>
            <th>Due date</th>
            <th>Customer</th>
            <th>Property</th>
            <th>Instalment</th>
            <th className="text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td>{r.dueDate}</td>
              <td>{r.customerName}</td>
              <td>
                <Link href={`/bookings/${r.bookingId}`} className="text-brass-dark hover:underline">
                  {r.booking}
                </Link>
              </td>
              <td className="text-muted">{r.label ?? "—"}</td>
              <td className="money text-right font-medium">{formatINR(r.amount)}</td>
            </tr>
          ))}
          <tr>
            <td colSpan={4} className="font-medium">Total due this month</td>
            <td className="money text-right font-medium">{formatINR(total)}</td>
          </tr>
        </tbody>
      </Shell>
    </>
  );
}

async function LoanList({
  statuses,
}: {
  statuses: ("pending_docs" | "applied")[];
}) {
  const rows = await getLoanStatusList(statuses);
  if (rows.length === 0) return <Empty text="Nothing pending here." />;
  return (
    <Shell>
      <thead>
        <tr>
          <th>Customer</th>
          <th>Property</th>
          <th>Status</th>
          <th>Bank</th>
          <th className="text-right">Loan amount</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.bookingId}>
            <td>{r.customerName}</td>
            <td>
              <Link href={`/bookings/${r.bookingId}`} className="text-brass-dark hover:underline">
                {r.booking}
              </Link>
            </td>
            <td>{STATUS_LABEL[r.status] ?? r.status}</td>
            <td className="text-muted">{r.bankName ?? "—"}</td>
            <td className="money text-right">{r.loanAmount ? formatINR(r.loanAmount) : "—"}</td>
          </tr>
        ))}
      </tbody>
    </Shell>
  );
}
