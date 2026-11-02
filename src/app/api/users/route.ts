import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireCapability } from "@/lib/rbac";
import { asc } from "drizzle-orm";

export const dynamic = "force-dynamic";

/** GET /api/users — list all staff members (admin only) */
export async function GET() {
  const gate = await requireCapability("user:manage");
  if (!gate.ok) return gate.response;

  const rows = await db
    .select()
    .from(users)
    .orderBy(asc(users.createdAt));

  return NextResponse.json(rows);
}
