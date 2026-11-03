"use client";

import { useRouter } from "next/navigation";

/** Header dropdown: the project every page, report and download is showing. */
export function ProjectSwitcher({
  projects,
  activeId,
}: {
  projects: { id: string; label: string }[];
  activeId: string; // a project id, or "all"
}) {
  const router = useRouter();
  async function choose(id: string) {
    await fetch("/api/projects/active", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    router.refresh();
  }
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="hidden text-muted sm:inline">Project</span>
      <select className="field w-auto max-w-[18rem] py-1.5 font-medium" value={activeId} onChange={(e) => choose(e.target.value)}>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>{p.label}</option>
        ))}
        <option value="all">All projects</option>
      </select>
    </label>
  );
}
