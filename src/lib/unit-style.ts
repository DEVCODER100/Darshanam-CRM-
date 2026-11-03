import type { UnitStatus } from "./unit-board";

export const STATUSES: { key: UnitStatus; label: string; dot: string }[] = [
  { key: "booked", label: "Booked", dot: "bg-danger" },
  { key: "available", label: "Available", dot: "bg-paid" },
  { key: "blocked", label: "Blocked", dot: "bg-slate2" },
];

/** Box colours by status, shared by the grid and the map. */
export const BOX: Record<UnitStatus, string> = {
  booked: "border-danger/30 bg-danger-bg text-danger",
  available: "border-paid/30 bg-paid-bg text-paid",
  blocked: "border-hairline bg-inkbg text-slate2",
};
