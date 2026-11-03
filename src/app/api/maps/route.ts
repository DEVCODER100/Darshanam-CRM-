import { NextResponse } from "next/server";
import { db } from "@/db";
import { siteMaps, auditLog } from "@/db/schema";
import { requireCapability } from "@/lib/rbac";
import { auditEntry } from "@/lib/audit";
import { genId, jsonError } from "@/lib/api";
import { mapLabelsSchema } from "@/lib/validators";
import { needProject } from "@/lib/project-scope";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 4_400_000; // Vercel rejects larger request bodies

// POST /api/maps — upload a site map image (the browser has already turned PDFs
// into an image and read their text labels). unit:manage.
export async function POST(req: Request) {
  const gate = await requireCapability("unit:manage");
  if (!gate.ok) return gate.response;

  const scope = await needProject();
  if (!scope.ok) return scope.response;

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const name = String(form?.get("name") ?? "").trim();
  const width = Number(form?.get("width"));
  const height = Number(form?.get("height"));
  if (!(file instanceof File) || file.type !== "image/jpeg") {
    return jsonError("Upload the map as a PNG, JPG or PDF", 422);
  }
  if (file.size > MAX_BYTES) return jsonError("That map image is too large (max 4 MB)", 413);
  if (!name) return jsonError("Give the map a name", 422);
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    return jsonError("Map size is missing", 422);
  }
  const labels = mapLabelsSchema.safeParse(JSON.parse(String(form?.get("detected") || "[]")));
  if (!labels.success) return jsonError("Detected labels are invalid", 422);

  const id = genId();
  try {
    const row = {
      id,
      name,
      projectId: scope.project.id,
      projectName: scope.project.label,
      fileUrl: `/api/maps/${id}/image`,
      imageData: Buffer.from(await file.arrayBuffer()).toString("base64"),
      width,
      height,
      detected: labels.data,
      createdBy: gate.user.id,
    };
    await db.batch([
      db.insert(siteMaps).values(row),
      db.insert(auditLog).values(
        auditEntry({
          userId: gate.user.id,
          action: "create",
          entityType: "unit",
          entityId: null,
          after: { siteMap: name, detectedLabels: labels.data.length },
        }),
      ),
    ]);
  } catch (err) {
    console.error(err);
    return jsonError("Could not save the map", 500);
  }
  return NextResponse.json({ id }, { status: 201 });
}
