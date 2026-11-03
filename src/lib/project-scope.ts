/**
 * project-scope.ts — which project the signed-in user is looking at. The header
 * switcher stores it in a cookie; every loader scopes its queries with it, so
 * pages, reports and downloads always show the same project. `null` = all projects.
 */
import { cache } from "react";
import { cookies } from "next/headers";
import { asc, eq, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { projectLabel } from "./project-label";

export const PROJECT_COOKIE = "project";
export const ALL_PROJECTS = "all";

export interface ProjectInfo {
  id: string;
  name: string;
  area: string;
  label: string;
}

/** Projects people can switch to (archived ones are hidden). */
export const listProjects = cache(async (): Promise<ProjectInfo[]> => {
  const rows = await db
    .select({ id: projects.id, name: projects.name, area: projects.area })
    .from(projects)
    .where(eq(projects.archived, false))
    .orderBy(asc(projects.name), asc(projects.area));
  return rows.map((p) => ({ ...p, label: projectLabel(p) }));
});

/** The selected project, or null for "All projects". With no choice yet, the first project. */
export const getActiveProject = cache(async (): Promise<ProjectInfo | null> => {
  const list = await listProjects();
  const chosen = cookies().get(PROJECT_COOKIE)?.value;
  if (chosen === ALL_PROJECTS) return null;
  return list.find((p) => p.id === chosen) ?? list[0] ?? null;
});

export const activeProjectId = async () => (await getActiveProject())?.id ?? null;

/** `column = active project`, or no condition at all for "All projects". */
export const inProject = (column: PgColumn, projectId: string | null): SQL | undefined =>
  projectId ? eq(column, projectId) : undefined;

/** Keep only rows whose booking is in scope (for child tables loaded whole). */
export const forBookings = <T extends { bookingId: string }>(rows: T[], bookingIds: Set<string>) =>
  rows.filter((r) => bookingIds.has(r.bookingId));

/** New records need a specific project: refuse while "All projects" is selected. */
export async function needProject(): Promise<
  { ok: true; project: ProjectInfo } | { ok: false; response: Response }
> {
  const project = await getActiveProject();
  return project
    ? { ok: true, project }
    : { ok: false, response: Response.json({ error: "Choose a project in the top bar first." }, { status: 409 }) };
}
