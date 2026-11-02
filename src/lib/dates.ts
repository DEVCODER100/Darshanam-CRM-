/** "Today" as an ISO date (UTC). Pure, so tests and client code can use it. */
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
