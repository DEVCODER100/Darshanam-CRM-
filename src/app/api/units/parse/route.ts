import { NextResponse } from "next/server";
import { requireCapability } from "@/lib/rbac";
import { jsonError } from "@/lib/api";
import { readTable } from "@/lib/unit-file-parse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/units/parse — read an uploaded .xlsx / .csv into a grid of text (unit:manage).
// PDFs are read in the browser instead; the grid goes through the same import preview.
export async function POST(req: Request) {
  const gate = await requireCapability("unit:manage");
  if (!gate.ok) return gate.response;

  const file = (await req.formData().catch(() => null))?.get("file");
  if (!(file instanceof File)) return jsonError("Choose a file to upload", 422);
  if (/\.xls$/i.test(file.name)) {
    return jsonError("Old .xls files are not supported. Open it in Excel and Save As .xlsx.", 415);
  }
  if (!/\.(xlsx|csv)$/i.test(file.name)) return jsonError("Upload an .xlsx, .csv or .pdf file", 415);

  try {
    return NextResponse.json({ rows: await readTable(Buffer.from(await file.arrayBuffer()), file.name) });
  } catch (err) {
    console.error(err);
    return jsonError("That file could not be read. Is it a valid spreadsheet?", 422);
  }
}
