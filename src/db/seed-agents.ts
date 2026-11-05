/**
 * seed-agents.ts — one-off, idempotent: the 15 agents named in the DaeBuild agent file, with the
 * placeholder plans "Plan 1" (0%) and "Reward 1" (₹0) the file mentions, in Splendora 3.
 * Set the real rates under Agents > Plans afterwards.   npx tsx src/db/seed-agents.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { agents, brokeragePlans, projects, rewardPlans } from "./schema";

const AGENTS: [string, string][] = [
  ["AG001", "abc"], ["AG002", "Zul"], ["AG003", "Anami Thakkar"], ["AG004", "Paresh Malkan"], ["AG005", "Anami thakkar"],
  ["AG006", "Manoj Makwana"], ["AG007", "Archana Pathak"], ["AG008", "vasant brambhatt"], ["AG009", "Jaydep"], ["AG010", "jagdish shah"],
  ["AG011", "lokendra singh"], ["AG012", "Kunal Shah"], ["AG013", "Samir"], ["AG014", "Mit Patel"], ["AG015", "Dilip Zha"],
];

(async () => {
  const project = (await db.select().from(projects).where(eq(projects.name, "Splendora 3")))[0];
  if (!project) throw new Error("Splendora 3 not found");

  const planOf = async (name: string) =>
    (await db.select().from(brokeragePlans).where(and(eq(brokeragePlans.projectId, project.id), eq(brokeragePlans.name, name))))[0] ??
    (await db.insert(brokeragePlans).values({ projectId: project.id, name }).returning())[0];
  const rewardOf = async (name: string) =>
    (await db.select().from(rewardPlans).where(and(eq(rewardPlans.projectId, project.id), eq(rewardPlans.name, name))))[0] ??
    (await db.insert(rewardPlans).values({ projectId: project.id, name }).returning())[0];
  const [plan, reward] = [await planOf("Plan 1"), await rewardOf("Reward 1")];

  let added = 0;
  for (const [code, name] of AGENTS) {
    const exists = await db.query.agents.findFirst({ where: eq(agents.agentCode, code), columns: { id: true } });
    if (exists) continue;
    await db.insert(agents).values({ agentCode: code, name, projectId: project.id, brokeragePlanId: plan.id, rewardPlanId: reward.id, userGroup: "Agent Group" });
    added++;
  }
  console.log(`${project.name}: ${added} agents added (${AGENTS.length - added} already there).`);
})();
