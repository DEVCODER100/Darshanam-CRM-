"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface CustomerFormValues {
  fullName: string;
  mobile: string;
  alternateMobile: string;
  email: string;
  panNumber: string;
  aadhaarNumber: string;
  address: string;
  salesExecutive: string;
  notes: string;
}

const empty: CustomerFormValues = {
  fullName: "",
  mobile: "",
  alternateMobile: "",
  email: "",
  panNumber: "",
  aadhaarNumber: "",
  address: "",
  salesExecutive: "",
  notes: "",
};

export function CustomerForm({
  mode,
  customerId,
  initial,
}: {
  mode: "create" | "edit";
  customerId?: string;
  initial?: Partial<CustomerFormValues>;
}) {
  const router = useRouter();
  const [values, setValues] = useState<CustomerFormValues>({
    ...empty,
    ...initial,
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set =
    (key: keyof CustomerFormValues) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setValues((current) => ({ ...current, [key]: event.target.value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const url =
      mode === "create" ? "/api/customers" : `/api/customers/${customerId}`;
    const response = await fetch(url, {
      method: mode === "create" ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    setBusy(false);
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.error ?? `Request failed (${response.status})`);
      return;
    }
    const body = await response.json().catch(() => ({}));
    router.push(
      mode === "create" ? `/customers/${body.id}` : `/customers/${customerId}`,
    );
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="grid max-w-3xl gap-4 md:grid-cols-2">
      {error && (
        <p className="md:col-span-2 rounded-md bg-danger-bg px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      <Field label="Customer name" required>
        <input className="field" value={values.fullName} onChange={set("fullName")} required />
      </Field>
      <Field label="Mobile number" required>
        <input className="field" value={values.mobile} onChange={set("mobile")} required />
      </Field>
      <Field label="Alternate number">
        <input className="field" value={values.alternateMobile} onChange={set("alternateMobile")} />
      </Field>
      <Field label="Email">
        <input className="field" type="email" value={values.email} onChange={set("email")} />
      </Field>
      <Field label="PAN number (stored masked)">
        <input className="field" value={values.panNumber} onChange={set("panNumber")} />
      </Field>
      <Field label="Aadhaar number (stored masked)">
        <input className="field" value={values.aadhaarNumber} onChange={set("aadhaarNumber")} />
      </Field>
      <Field label="Sales executive">
        <input className="field" value={values.salesExecutive} onChange={set("salesExecutive")} />
      </Field>
      <Field label="Address">
        <textarea className="field" rows={3} value={values.address} onChange={set("address")} />
      </Field>
      <div className="md:col-span-2">
        <Field label="Notes">
          <textarea className="field" rows={3} value={values.notes} onChange={set("notes")} />
        </Field>
      </div>
      <div className="md:col-span-2">
        <button type="submit" disabled={busy} className="btn-primary">
          {busy ? "Saving..." : mode === "create" ? "Create customer" : "Save changes"}
        </button>
      </div>
    </form>
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
