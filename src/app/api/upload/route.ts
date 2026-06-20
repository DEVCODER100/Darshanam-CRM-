import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { requireCapability } from "@/lib/rbac";
import { jsonError } from "@/lib/api";

// POST /api/upload — upload a payment attachment to Vercel Blob, return its URL.
// Gated to payment:create since attachments belong to payments.
export async function POST(req: Request) {
  const gate = await requireCapability("payment:create");
  if (!gate.ok) return gate.response;

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return jsonError("File storage is not configured (BLOB_READ_WRITE_TOKEN)", 503);
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return jsonError("No file provided", 400);
  }

  const safeName = file.name.replace(/[^\w.\-]/g, "_");
  try {
    const blob = await put(`payments/${Date.now()}-${safeName}`, file, {
      access: "public",
      addRandomSuffix: true,
    });
    return NextResponse.json({ url: blob.url });
  } catch (err) {
    console.error(err);
    return jsonError("Upload failed", 500);
  }
}
