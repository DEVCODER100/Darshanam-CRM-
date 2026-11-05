import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { agents } from "@/db/schema";

/** Active agents of a project, for the booking form's optional Agent field. */
export async function agentChoices(projectId: string | null) {
  if (!projectId) return [];
  return db
    .select({ id: agents.id, name: agents.name })
    .from(agents)
    .where(and(eq(agents.projectId, projectId), eq(agents.archived, false)))
    .orderBy(asc(agents.name));
}
