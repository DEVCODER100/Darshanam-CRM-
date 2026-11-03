import { NextResponse } from "next/server";
import { and, desc, ilike, or } from "drizzle-orm";
import { db } from "@/db";
import { customers, auditLog } from "@/db/schema";
import { eq } from "drizzle-orm";
import { panColumns } from "@/lib/pan";
import { nextCode } from "@/lib/codes";
import { publicCustomer } from "@/lib/customer-public";
import { requireAuth, requireCapability } from "@/lib/rbac";
import { auditEntry } from "@/lib/audit";
import { parseBody, genId, jsonError } from "@/lib/api";
import { customerCreateSchema } from "@/lib/validators";
import { extraColumns } from "@/lib/customer-write";
import { activeProjectId, inProject, needProject } from "@/lib/project-scope";

// GET /api/customers — list (any authenticated staff).
// With ?q= it is a quick search (name, mobile, email, client ID) for pickers.
export async function GET(req: Request) {
  const gate = await requireAuth();
  if (!gate.ok) return gate.response;

  const q = new URL(req.url).searchParams.get("q")?.trim();
  if (q) {
    const like = `%${q}%`;
    const found = await db
      .select({ id: customers.id, fullName: customers.fullName, mobile: customers.mobile, clientCode: customers.clientCode })
      .from(customers)
      .where(
        and(
          or(ilike(customers.fullName, like), ilike(customers.mobile, like), ilike(customers.email, like), ilike(customers.clientCode, like)),
          inProject(customers.projectId, await activeProjectId()),
        ),
      )
      .limit(8);
    return NextResponse.json({ customers: found });
  }

  const rows = await db
    .select()
    .from(customers)
    .where(inProject(customers.projectId, await activeProjectId()))
    .orderBy(desc(customers.createdAt));
  return NextResponse.json({ customers: rows.map(publicCustomer) });
}

// POST /api/customers — create (customer:create).
export async function POST(req: Request) {
  const gate = await requireCapability("customer:create");
  if (!gate.ok) return gate.response;

  const scope = await needProject();
  if (!scope.ok) return scope.response;

  const parsed = await parseBody(req, customerCreateSchema);
  if (!parsed.ok) return parsed.response;
  const input = parsed.data;

  const id = genId();

  // PAN: stored encrypted. A PAN already on file for someone else is refused.
  let panCols: ReturnType<typeof panColumns> | null = null;
  if (input.panNumber) {
    try {
      panCols = panColumns(input.panNumber);
    } catch (err) {
      console.error(err);
      return jsonError("PAN storage is not configured on the server (PAN_ENCRYPTION_KEY).", 500);
    }
    const dup = await db.query.customers.findFirst({
      // Clients are kept per project, so the same PAN may exist in another project.
      where: and(eq(customers.panHash, panCols.panHash), eq(customers.projectId, scope.project.id)),
      columns: { fullName: true },
    });
    if (dup) return jsonError(`This PAN is already on file for ${dup.fullName}.`, 409);
  }
  const existingCodes = (await db.select({ c: customers.clientCode }).from(customers)).map((r) => r.c);

  const row = {
    id,
    clientCode: nextCode("CL", existingCodes),
    projectId: scope.project.id,
    ...(panCols ?? {}),
    panExemptReason: panCols ? null : input.noPanReason || null,
    fullName: input.fullName,
    mobile: input.mobile,
    alternateMobile: input.alternateMobile || null,
    email: input.email || null,
    ...extraColumns(input),
    address: input.address || null,
    salesExecutive: input.salesExecutive || null,
    notes: input.notes || null,
    createdBy: gate.user.id,
  };

  try {
    // Mutation + audit row run atomically as one Neon HTTP transaction.
    await db.batch([
      db.insert(customers).values(row),
      db.insert(auditLog).values(
        auditEntry({
          userId: gate.user.id,
          action: "create",
          entityType: "customer",
          entityId: id,
          after: row,
        }),
      ),
    ]);
  } catch (err) {
    console.error(err);
    return jsonError("Failed to create customer", 500);
  }

  return NextResponse.json({ id }, { status: 201 });
}
