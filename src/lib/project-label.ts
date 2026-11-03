/** "Splendora 3 – Construction Area 2" (or just the name when there is no area). Pure. */
export const projectLabel = (p: { name: string; area: string }) => (p.area ? `${p.name} – ${p.area}` : p.name);

/** "Splendora-3-Construction-Area-2", safe for a file name. */
export const projectSlug = (label: string) => label.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");
