/**
 * permissions.ts — pure role/capability matrix (PRD §2), no DB or framework
 * imports so it is unit-testable in isolation. `rbac.ts` consumes this.
 */
export type Role = "admin" | "accountant" | "sales_executive" | "manager";

export type AuditAction = "create" | "update" | "delete";
export type AuditEntity =
  | "customer"
  | "booking"
  | "property_cost"
  | "payment_schedule"
  | "payment"
  | "loan"
  | "document"
  | "user";

export type Capability =
  | "customer:create"
  | "customer:edit"
  | "customer:delete"
  | "booking:create"
  | "booking:edit"
  | "booking:delete"
  | "cost:edit"
  | "schedule:edit"
  | "payment:create"
  | "payment:edit"
  | "payment:delete"
  | "loan:edit"
  | "document:upload"
  | "document:delete"
  | "user:manage"
  | "report:view"
  | "audit:view"
  | "sensitive:view"; // unmask Aadhaar/PAN

export const ALL_CAPABILITIES: Capability[] = [
  "customer:create",
  "customer:edit",
  "customer:delete",
  "booking:create",
  "booking:edit",
  "booking:delete",
  "cost:edit",
  "schedule:edit",
  "payment:create",
  "payment:edit",
  "payment:delete",
  "loan:edit",
  "document:upload",
  "document:delete",
  "user:manage",
  "report:view",
  "audit:view",
  "sensitive:view",
];

/**
 * Role -> capability matrix.
 *
 * Per the owner's directive, ALL data editing is admin-only: only admin can
 * create/edit/delete any entity. Accountant, sales executive, and manager are
 * strictly view-only (reads are not capability-gated). Accountant retains the
 * view-only privileges of seeing reports and unmasking Aadhaar/PAN; manager can
 * view reports; sales executive has no extra capabilities.
 */
export const CAPABILITIES: Record<Role, Capability[]> = {
  admin: ALL_CAPABILITIES,
  accountant: ["report:view", "sensitive:view"],
  sales_executive: [],
  manager: ["report:view"],
};

export function can(role: Role, capability: Capability): boolean {
  return CAPABILITIES[role].includes(capability);
}
