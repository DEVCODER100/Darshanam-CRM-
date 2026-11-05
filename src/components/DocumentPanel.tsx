"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { checkFile, checklist, DOCUMENT_TYPES, MAX_FILE_BYTES, type DocumentType } from "@/lib/document-rules";
import { imageToCanvas, shrinkCanvas } from "@/lib/image-shrink";

export interface DocumentRow {
  id: string;
  documentType: string;
  fileName: string;
  fileUrl: string | null; // null = the viewer may not open it
  note: string | null;
  sizeBytes: number | null;
  uploadedOn: string; // ISO date
  uploadedBy: string | null;
  booking: string | null; // unit the form belongs to
}

/** Photos from a phone are shrunk to fit; PDFs must already be small enough. */
async function prepare(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size <= MAX_FILE_BYTES / 2) return file;
  const blob = await shrinkCanvas(await imageToCanvas(file, 2400), MAX_FILE_BYTES);
  return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
}

const kb = (n: number | null) => (n === null ? "" : n > 1_000_000 ? `${(n / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1000))} KB`);

/** Documents on a customer's profile: a Uploaded / Missing checklist, the files, and an upload form. */
export function DocumentPanel({
  customerId,
  documents,
  bookings,
  canEdit,
}: {
  customerId: string;
  documents: DocumentRow[];
  bookings: { id: string; label: string }[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [type, setType] = useState<DocumentType>("aadhaar");
  const [bookingId, setBookingId] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(event: React.FormEvent) {
    event.preventDefault();
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const ready = await prepare(file);
      const problem = checkFile(ready);
      if (problem) throw new Error(problem);
      const form = new FormData();
      form.append("file", ready);
      form.append("documentType", type);
      form.append("bookingId", bookingId);
      form.append("note", note);
      const res = await fetch(`/api/customers/${customerId}/documents`, { method: "POST", body: form });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `Upload failed (${res.status})`);
      setFile(null);
      setNote("");
      (event.target as HTMLFormElement).reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    }
    setBusy(false);
  }

  async function remove(id: string) {
    if (!confirm("Remove this document from the customer profile?")) return;
    if ((await fetch(`/api/documents/${id}`, { method: "DELETE" })).ok) router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {checklist(documents).map((c) => (
          <span key={c.type} className={c.count ? "pill-paid" : "pill-due"}>
            {c.label}: {c.count ? `uploaded${c.count > 1 ? ` (${c.count})` : ""}` : "missing"}
          </span>
        ))}
      </div>

      {documents.length ? (
        <div className="card overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Type</th><th>File</th><th>Unit</th><th>Note</th><th>Added</th>
                {canEdit && <th />}
              </tr>
            </thead>
            <tbody>
              {documents.map((d) => (
                <tr key={d.id}>
                  <td className="whitespace-nowrap">{DOCUMENT_TYPES[d.documentType as DocumentType] ?? d.documentType}</td>
                  <td>
                    {d.fileUrl ? (
                      <a href={d.fileUrl} target="_blank" rel="noreferrer" className="text-brass-dark hover:underline">{d.fileName}</a>
                    ) : (
                      <span className="text-muted" title="Only admin and accountant can open this">{d.fileName} · Restricted</span>
                    )}
                    <span className="ml-2 text-xs text-muted">{kb(d.sizeBytes)}</span>
                  </td>
                  <td className="text-muted">{d.booking ?? "—"}</td>
                  <td className="text-muted">{d.note ?? "—"}</td>
                  <td className="whitespace-nowrap text-muted">{d.uploadedOn}{d.uploadedBy ? ` · ${d.uploadedBy}` : ""}</td>
                  {canEdit && (
                    <td className="text-right">
                      <button onClick={() => remove(d.id)} className="text-xs text-danger hover:underline">Delete</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-muted">No documents uploaded yet.</p>
      )}

      {canEdit && (
        <form onSubmit={upload} className="card flex flex-wrap items-end gap-3 p-3 text-sm">
          <label>
            <span className="mb-1 block text-muted">Document type</span>
            <select className="field" value={type} onChange={(e) => setType(e.target.value as DocumentType)}>
              {Object.entries(DOCUMENT_TYPES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          {bookings.length > 0 && (
            <label>
              <span className="mb-1 block text-muted">For unit (optional)</span>
              <select className="field" value={bookingId} onChange={(e) => setBookingId(e.target.value)}>
                <option value="">Whole profile</option>
                {bookings.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
              </select>
            </label>
          )}
          <label>
            <span className="mb-1 block text-muted">Note (optional)</span>
            <input className="field" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. back side" />
          </label>
          <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} required />
          <button className="btn-primary" disabled={busy || !file}>{busy ? "Uploading..." : "Upload document"}</button>
          <p className="basis-full text-xs text-muted">PDF, JPG, PNG or WEBP up to {(MAX_FILE_BYTES / 1_000_000).toFixed(1)} MB. Aadhaar, PAN and address proof can only be opened by admin and accountant.</p>
          {error && <p className="basis-full text-danger">{error}</p>}
        </form>
      )}
    </div>
  );
}
