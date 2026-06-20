"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { computeCost } from "@/lib/cost";
import { rupeesToPaise, percentToBps, formatINR } from "@/lib/money";
import { CONSTRUCTION_STAGES } from "@/lib/stage";

interface Values {
  bookingDate: string;
  projectName: string;
  propertyType: "Villa" | "Plot" | "Apartment" | "Flat" | "Shop";
  propertyNumber: string;
  bookingAddress: string;
  unitStatus: "available" | "booked" | "sold";
  paymentType: "self_finance" | "bank_loan" | "installment";
  stageBased: boolean;
  currentStage: string;
  downPayment: string;
  installmentCount: string;
  installmentFrequency: "monthly" | "quarterly" | "custom";
  baseCost: string;
  extraCharges: string;
  discount: string;
  gstPercent: string;
  maintenanceCharge: string;
  documentationPercent: string;
}

const today = new Date().toISOString().slice(0, 10);

export function BookingForm({
  customerId,
  mode = "create",
  bookingId,
  initial,
}: {
  customerId: string;
  mode?: "create" | "edit";
  bookingId?: string;
  initial?: Partial<Values>;
}) {
  const router = useRouter();
  const [v, setV] = useState<Values>({
    bookingDate: today,
    projectName: "",
    propertyType: "Villa",
    propertyNumber: "",
    bookingAddress: "",
    unitStatus: "booked",
    paymentType: "self_finance",
    stageBased: false,
    currentStage: "",
    downPayment: "0",
    installmentCount: "",
    installmentFrequency: "monthly",
    baseCost: "",
    extraCharges: "0",
    discount: "0",
    gstPercent: "0",
    maintenanceCharge: "0",
    documentationPercent: "0",
    ...initial,
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set =
    (key: keyof Values) =>
    (
      event: React.ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >,
    ) =>
      setV((current) => ({ ...current, [key]: event.target.value }));

  const preview = useMemo(() => {
    try {
      return computeCost({
        baseCost: rupeesToPaise(v.baseCost || "0"),
        extraCharges: rupeesToPaise(v.extraCharges || "0"),
        discount: rupeesToPaise(v.discount || "0"),
        gstPercentBps: Number(percentToBps(v.gstPercent || "0")),
        maintenanceCharge: rupeesToPaise(v.maintenanceCharge || "0"),
        documentationPercentBps: Number(
          percentToBps(v.documentationPercent || "0"),
        ),
      });
    } catch {
      return null;
    }
  }, [
    v.baseCost,
    v.extraCharges,
    v.discount,
    v.gstPercent,
    v.maintenanceCharge,
    v.documentationPercent,
  ]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const bookingPayload = {
      bookingDate: v.bookingDate,
      projectName: v.projectName,
      propertyType: v.propertyType,
      propertyNumber: v.propertyNumber,
      bookingAddress: v.bookingAddress,
      unitStatus: v.unitStatus,
      paymentType: v.paymentType,
      stageBased: v.stageBased,
      currentStage: v.stageBased && v.currentStage ? v.currentStage : null,
      downPayment: v.downPayment,
      installmentCount:
        v.paymentType === "installment" && v.installmentCount
          ? Number(v.installmentCount)
          : null,
      installmentFrequency:
        v.paymentType === "installment" ? v.installmentFrequency : null,
    };
    const costPayload = {
      baseCost: v.baseCost,
      extraCharges: v.extraCharges,
      discount: v.discount,
      gstPercent: v.gstPercent,
      maintenanceCharge: v.maintenanceCharge,
      documentationPercent: v.documentationPercent,
    };

    try {
      if (mode === "create") {
        const response = await fetch("/api/bookings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...bookingPayload, ...costPayload, customerId }),
        });
        if (!response.ok) throw await response.json().catch(() => ({}));
        const body = await response.json();
        router.push(`/bookings/${body.id}`);
      } else {
        // Edit: booking fields and pricing go to separate endpoints.
        const r1 = await fetch(`/api/bookings/${bookingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bookingPayload),
        });
        if (!r1.ok) throw await r1.json().catch(() => ({}));
        const r2 = await fetch(`/api/bookings/${bookingId}/cost`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(costPayload),
        });
        if (!r2.ok) throw await r2.json().catch(() => ({}));
        router.push(`/bookings/${bookingId}`);
      }
      router.refresh();
    } catch (err) {
      const e = err as { error?: string };
      setError(e.error ?? "Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid max-w-5xl gap-6 lg:grid-cols-3">
      {error && (
        <p className="lg:col-span-3 rounded-md bg-danger-bg px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <Section title="Unit details">
        <Field label="Booking date" required>
          <input type="date" className="field" value={v.bookingDate} onChange={set("bookingDate")} required />
        </Field>
        <Field label="Project name">
          <input className="field" value={v.projectName} onChange={set("projectName")} />
        </Field>
        <Field label="Unit type" required>
          <select className="field" value={v.propertyType} onChange={set("propertyType")}>
            {["Villa", "Plot", "Apartment", "Flat", "Shop"].map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>
        </Field>
        <Field label="Unit number">
          <input className="field" value={v.propertyNumber} onChange={set("propertyNumber")} />
        </Field>
        <Field label="Unit status">
          <select className="field" value={v.unitStatus} onChange={set("unitStatus")}>
            <option value="available">Available</option>
            <option value="booked">Booked</option>
            <option value="sold">Sold</option>
          </select>
        </Field>
        <Field label="Unit address">
          <textarea className="field" rows={2} value={v.bookingAddress} onChange={set("bookingAddress")} />
        </Field>
      </Section>

      <Section title="Payment plan">
        <Field label="Payment type">
          <select className="field" value={v.paymentType} onChange={set("paymentType")}>
            <option value="self_finance">Self finance</option>
            <option value="bank_loan">Bank loan</option>
            <option value="installment">Installment based</option>
          </select>
        </Field>
        <label className="flex items-center gap-2 rounded-md border border-hairline p-3 text-sm">
          <input
            type="checkbox"
            checked={v.stageBased}
            onChange={(event) =>
              setV((current) => ({ ...current, stageBased: event.target.checked }))
            }
          />
          Stage-based collection
        </label>
        {v.stageBased && (
          <Field label="Current construction stage" required>
            <select className="field" value={v.currentStage} onChange={set("currentStage")} required>
              <option value="">Select stage</option>
              {CONSTRUCTION_STAGES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label} ({item.percentBps / 100}%)
                </option>
              ))}
            </select>
          </Field>
        )}
        {v.paymentType === "installment" && (
          <>
            <Field label="Down payment (₹)">
              <input className="field" value={v.downPayment} onChange={set("downPayment")} />
            </Field>
            <Field label="Number of installments">
              <input type="number" min="1" className="field" value={v.installmentCount} onChange={set("installmentCount")} />
            </Field>
            <Field label="Frequency">
              <select className="field" value={v.installmentFrequency} onChange={set("installmentFrequency")}>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="custom">Custom</option>
              </select>
            </Field>
          </>
        )}
      </Section>

      <Section title="Pricing">
        <Field label="Base cost (₹)" required>
          <input className="field" value={v.baseCost} onChange={set("baseCost")} required />
        </Field>
        <Field label="Extra charges (₹)">
          <input className="field" value={v.extraCharges} onChange={set("extraCharges")} />
        </Field>
        <Field label="Discount (₹)">
          <input className="field" value={v.discount} onChange={set("discount")} />
        </Field>
        <Field label="GST %">
          <input className="field" value={v.gstPercent} onChange={set("gstPercent")} />
        </Field>
        <Field label="Maintenance deposit (₹)">
          <input className="field" value={v.maintenanceCharge} onChange={set("maintenanceCharge")} />
        </Field>
        <Field label="Documentation %">
          <input className="field" value={v.documentationPercent} onChange={set("documentationPercent")} />
        </Field>
        <div className="rounded-md border border-hairline bg-canvas p-3 text-sm">
          {preview ? (
            <dl className="space-y-1">
              <Row label="Agreement value" value={formatINR(preview.agreementValue)} />
              <Row label="GST" value={formatINR(preview.gstAmount)} />
              <Row label="Documentation" value={formatINR(preview.documentationAmount)} />
              <Row label="Total payable" value={formatINR(preview.totalCost)} strong />
            </dl>
          ) : (
            <p className="text-muted">Enter valid amounts to preview totals.</p>
          )}
        </div>
      </Section>

      <div className="lg:col-span-3">
        <button type="submit" disabled={busy} className="btn-primary">
          {busy
            ? "Saving..."
            : mode === "create"
              ? "Create booking"
              : "Save changes"}
        </button>
      </div>
    </form>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-lg border border-hairline bg-white p-5 shadow-card">
      <h2 className="font-medium text-ink">{title}</h2>
      {children}
    </section>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-ink">
        {label}
        {required && <span className="text-danger"> *</span>}
      </span>
      {children}
    </label>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className={`flex justify-between ${strong ? "border-t border-hairline pt-1 font-medium" : ""}`}>
      <dt className="text-muted">{label}</dt>
      <dd className="money">{value}</dd>
    </div>
  );
}
