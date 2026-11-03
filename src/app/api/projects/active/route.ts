import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireAuth } from "@/lib/rbac";
import { jsonError } from "@/lib/api";
import { ALL_PROJECTS, PROJECT_COOKIE, listProjects } from "@/lib/project-scope";

// POST /api/projects/active { id } — remember which project this browser is looking at.
export async function POST(req: Request) {
  const gate = await requireAuth();
  if (!gate.ok) return gate.response;

  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  if (id !== ALL_PROJECTS && !(await listProjects()).some((p) => p.id === id)) {
    return jsonError("Unknown project", 404);
  }
  cookies().set(PROJECT_COOKIE, id!, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  return NextResponse.json({ ok: true });
}
