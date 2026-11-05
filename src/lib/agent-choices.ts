import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { agents, brokeragePlans, rewardPlans } from "@/db/schema";
import { activeProjectId, inProject } from "./project-scope";

/** Active agents of a project, for the booking form's optional Agent field. */
export async function agentChoices(projectId: string | null) {
  if (!projectId) return [];
  return db
    .select({ id: agents.id, name: agents.name })
    .from(agents)
    .where(and(eq(agents.projectId, projectId), eq(agents.archived, false)))
    .orderBy(asc(agents.name));
}

/** Plans of the active project, for the agent form's pickers. */
export async function planChoices() {
  const pid = await activeProjectId();
  const [brokerage, reward] = await Promise.all([
    db.select({ id: brokeragePlans.id, name: brokeragePlans.name }).from(brokeragePlans).where(and(inProject(brokeragePlans.projectId, pid), eq(brokeragePlans.archived, false))).orderBy(asc(brokeragePlans.name)),
    db.select({ id: rewardPlans.id, name: rewardPlans.name }).from(rewardPlans).where(and(inProject(rewardPlans.projectId, pid), eq(rewardPlans.archived, false))).orderBy(asc(rewardPlans.name)),
  ]);
  return { brokerage, reward };
}
