"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type DocumentRow = {
  id: string;
  documentType: string;
  fileName: string;
  fileUrl: string;
};

const LABELS: Record<string, string> = {
  aadhaar: "Aadhaar",
  pan: "PAN",
  agreement: "Agreement",
  loan_document: "Loan document",
  other: "Other",
};

export function DocumentPanel({
  customerId,
  documents,
  canEdit,
}: {
  customerId: string;
  documents: DocumentRow[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [type, setType] = useState("agreement");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(event: React.FormEvent) {
    event.preventDefault();
    if (!file) return;
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.append("file", file);
    const uploadResponse = await fetch("/api/upload", {
      method: "POST",
      body: form,
    });
    if (!uploadResponse.ok) {
      setBusy(false);
      setError("File upload failed");
      return;
    }
    const uploaded = await uploadResponse.json();
    const response = await fetch(`/api/customers/${customerId}/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        documentType: type,
        fileName: file.name,
        fileUrl: uploaded.url,
      }),
    });
    setBusy(false);
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.error ?? "Could not save document");
      return;
    }
    setFile(null);
    router.refresh();
  }

  async function remove(id: string) {
    if (!confirm("Remove this document from the customer profile?")) return;
    const response = await fetch(`/api/documents/${id}`, { method: "DELETE" });
    if (response.ok) router.refresh();
  }

  return (
    <div className="space-y-3">
      {documents.length ? (
        <div className="card overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>File</th>
                {canEdit && <th />}
              </tr>
            </thead>
            <tbody>
              {documents.map((document) => (
                <tr key={document.id}>
                  <td>{LABELS[document.documentType] ?? document.documentType}</td>
                  <td>
                    <a
                      href={document.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-brass-dark hover:underline"
                    >
                      {document.fileName}
                    </a>
                  </td>
                  {canEdit && (
                    <td className="text-right">
                      <button
                        onClick={() => remove(document.id)}
                        className="text-xs text-danger hover:underline"
                      >
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-muted">No documents uploaded.</p>
      )}

      {canEdit && (
        <form onSubmit={upload} className="flex flex-wrap items-end gap-2">
          <label className="text-sm">
            <span className="mb-1 block text-muted">Document type</span>
            <select className="field" value={type} onChange={(e) => setType(e.target.value)}>
              {Object.entries(LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <input
            type="file"
            className="text-sm"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            required
          />
          <button className="btn-primary" disabled={busy || !file}>
            {busy ? "Uploading..." : "Upload document"}
          </button>
          {error && <p className="w-full text-sm text-danger">{error}</p>}
        </form>
      )}
    </div>
  );
}
