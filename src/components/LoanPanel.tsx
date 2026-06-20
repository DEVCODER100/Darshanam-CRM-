"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatINR, paiseToRupeeString } from "@/lib/money";

const STATUSES = [
  ["not_applicable", "Not applicable"],
  ["pending_docs", "Pending"],
  ["applied", "Applied"],
  ["approved", "Approved"],
  ["disbursed", "Disbursed"],
  ["rejected", "Rejected"],
] as const;

type Status = (typeof STATUSES)[number][0];
const STATUS_LABEL: Record<string, string> = Object.fromEntries(STATUSES);

type LoanInput = {
  status: string;
  loanAmount: string | null;
  customerContribution: string | null;
  amountReleased: string;
  bankName: string | null;
  referenceNumber: string | null;
  sanctionDate: string | null;
  approvalDate: string | null;
  disbursementDate: string | null;
};

export function LoanPanel({
  bookingId,
  canEdit,
  loan,
}: {
  bookingId: string;
  canEdit: boolean;
  loan: LoanInput | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState({
    status: (loan?.status as Status) ?? "pending_docs",
    loanAmount: toRupees(loan?.loanAmount),
    customerContribution: toRupees(loan?.customerContribution),
    amountReleased: toRupees(loan?.amountReleased) || "0",
    bankName: loan?.bankName ?? "",
    referenceNumber: loan?.referenceNumber ?? "",
    sanctionDate: loan?.sanctionDate ?? "",
    approvalDate: loan?.approvalDate ?? "",
    disbursementDate: loan?.disbursementDate ?? "",
  });

  const set =
    (key: keyof typeof values) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setValues((current) => ({ ...current, [key]: event.target.value }));

  async function save() {
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/bookings/${bookingId}/loan`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    setBusy(false);
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.error ?? "Could not save loan");
      return;
    }
    setEditing(false);
    router.refresh();
  }

  if (!editing) {
    return (
      <div className="card p-4">
        {loan ? (
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <Item label="Status" value={STATUS_LABEL[loan.status] ?? loan.status} />
            <MoneyItem label="Loan amount" value={loan.loanAmount} />
            <MoneyItem label="Customer contribution" value={loan.customerContribution} />
            <MoneyItem label="Amount released" value={loan.amountReleased} />
            <MoneyItem
              label="Pending release"
              value={
                loan.loanAmount
                  ? (
                      BigInt(loan.loanAmount) - BigInt(loan.amountReleased)
                    ).toString()
                  : null
              }
            />
            <Item label="Bank" value={loan.bankName ?? "—"} />
            <Item label="Reference" value={loan.referenceNumber ?? "—"} />
            <Item label="Sanction date" value={loan.sanctionDate ?? "—"} />
            <Item label="Approval date" value={loan.approvalDate ?? "—"} />
            <Item label="Disbursement date" value={loan.disbursementDate ?? "—"} />
          </dl>
        ) : (
          <p className="text-sm text-muted">No loan recorded.</p>
        )}
        {canEdit && (
          <button onClick={() => setEditing(true)} className="btn-secondary mt-3">
            {loan ? "Edit loan" : "Add loan"}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-hairline bg-canvas p-4">
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Status"><select className="field" value={values.status} onChange={set("status")}>{STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
        <Field label="Bank name"><input className="field" value={values.bankName} onChange={set("bankName")} /></Field>
        <Field label="Loan amount (₹)"><input className="field" value={values.loanAmount} onChange={set("loanAmount")} /></Field>
        <Field label="Customer contribution (₹)"><input className="field" value={values.customerContribution} onChange={set("customerContribution")} /></Field>
        <Field label="Amount released (₹)"><input className="field" value={values.amountReleased} onChange={set("amountReleased")} /></Field>
        <Field label="Reference number"><input className="field" value={values.referenceNumber} onChange={set("referenceNumber")} /></Field>
        <Field label="Sanction date"><input type="date" className="field" value={values.sanctionDate} onChange={set("sanctionDate")} /></Field>
        <Field label="Approval date"><input type="date" className="field" value={values.approvalDate} onChange={set("approvalDate")} /></Field>
        <Field label="Disbursement date"><input type="date" className="field" value={values.disbursementDate} onChange={set("disbursementDate")} /></Field>
      </div>
      <div className="flex gap-2">
        <button onClick={save} disabled={busy} className="btn-primary">{busy ? "Saving..." : "Save loan"}</button>
        <button onClick={() => setEditing(false)} className="btn-secondary">Cancel</button>
      </div>
    </div>
  );
}

function toRupees(value: string | null | undefined) {
  return value ? paiseToRupeeString(BigInt(value)) : "";
}

function Item({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs uppercase tracking-wide text-muted">{label}</dt><dd>{value}</dd></div>;
}

function MoneyItem({ label, value }: { label: string; value: string | null }) {
  return <Item label={label} value={value ? formatINR(BigInt(value)) : "—"} />;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="text-sm"><span className="mb-1 block text-muted">{label}</span>{children}</label>;
}
