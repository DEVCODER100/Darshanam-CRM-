/**
 * report-filters.ts — the filter engine for the Payment Received and Payment
 * Due reports. Pure (no DB): URL params -> typed filters -> row predicates, so
 * the screens and the Excel/CSV/PDF downloads apply exactly the same rules.
 */
import { rupeesToPaise } from "./money";
import { isMonth, monthRange } from "./statement";
import { todayISO } from "./dates";
import { isValidPan, normalizePan } from "./pan-format";

export type Params = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined): string | undefined =>
  (Array.isArray(v) ? v[0] : v)?.trim() || undefined;

// --- account status ---------------------------------------------------------

export type AccountStatus = "paid_in_full" | "dues_pending" | "up_to_date" | "nothing_paid";

export const ACCOUNT_STATUS_LABELS: Record<AccountStatus, string> = {
  paid_in_full: "Paid in full",
  dues_pending: "Dues pending",
  up_to_date: "Up to date (not fully paid)",
  nothing_paid: "Nothing paid yet",
};

/** One status per unit: full payment, overdue dues, on track, or untouched. */
export function accountStatus(p: {
  totalCost: bigint;
  received: bigint;
  dueNow: bigint;
}): AccountStatus {
  if (p.totalCost > 0n && p.received >= p.totalCost) return "paid_in_full";
  if (p.received === 0n) return "nothing_paid";
  if (p.dueNow > 0n) return "dues_pending";
  return "up_to_date";
}

// --- small normalisers ------------------------------------------------------

const BANK_ALIASES: Record<string, string> = {
  bob: "baroda",
  bankofbaroda: "baroda",
  idfcfirst: "idfc",
  kotak: "kotakmahindra",
  sbi: "sbi",
};

/** "HDFC BANK", "hdfc", "Bank of baroda", "BOB" -> one comparable key. */
export function bankKey(name: string | null | undefined): string {
  let k = (name ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (BANK_ALIASES[k]) return BANK_ALIASES[k];
  k = k.replace(/^bankof/, "").replace(/bank$/, "");
  return BANK_ALIASES[k] ?? k;
}

export type AgeBand = "0-30" | "31-60" | "61-90" | "90+";
export const AGE_BANDS: AgeBand[] = ["0-30", "31-60", "61-90", "90+"];

export function ageBand(days: number): AgeBand {
  return days <= 30 ? "0-30" : days <= 60 ? "31-60" : days <= 90 ? "61-90" : "90+";
}

const norm = (s: string | null | undefined) => (s ?? "").toLowerCase().trim();

// --- period -----------------------------------------------------------------

export interface Period {
  from: string;
  to: string;
  month: string | null; // set when the period is a whole calendar month
}

const isDate = (v: string | undefined): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** from/to wins over month; with neither, the current month. */
export function resolvePeriod(sp: Params, today: string = todayISO()): Period {
  const from = one(sp.from);
  const to = one(sp.to);
  if (isDate(from) && isDate(to) && from <= to) return { from, to, month: null };
  const m = one(sp.month);
  const month = isMonth(m) ? m : today.slice(0, 7);
  return { ...monthRange(month), month };
}

// --- filters ----------------------------------------------------------------

export type PaymentTypeKey = "self_finance" | "bank_loan" | "installment" | "stage";
export const PAYMENT_TYPE_LABELS: Record<PaymentTypeKey, string> = {
  self_finance: "Self finance",
  bank_loan: "Bank loan",
  installment: "Installment",
  stage: "Stage-based",
};

export interface CommonFilters {
  q?: string; // client, mobile, unit, client / booking code, or an exact PAN
  paymentType?: PaymentTypeKey;
  status?: AccountStatus;
  panMissing?: boolean;
  project?: string;
  min?: bigint; // paise
  max?: bigint;
}

export interface ReceivedFilters extends CommonFilters {
  mode?: string; // payment mode key, e.g. "rtgs"
  paidBy?: "client" | "bank";
  bank?: string; // matched through bankKey()
  payFor?: string; // text inside "Payment for"
  gstOnly?: boolean;
}

export interface DueFilters extends CommonFilters {
  milestone?: string; // text inside the instalment name
  when?: "overdue" | "projected";
  age?: AgeBand;
  loanBank?: string;
}

function money(v: string | string[] | undefined): bigint | undefined {
  const s = one(v);
  if (!s) return undefined;
  try {
    return rupeesToPaise(s);
  } catch {
    return undefined;
  }
}

function pick<T extends string>(v: string | string[] | undefined, allowed: readonly T[]): T | undefined {
  const s = one(v);
  return s && (allowed as readonly string[]).includes(s) ? (s as T) : undefined;
}

function parseCommon(sp: Params): CommonFilters {
  return {
    q: one(sp.q),
    paymentType: pick(sp.ptype, ["self_finance", "bank_loan", "installment", "stage"] as const),
    status: pick(sp.status, ["paid_in_full", "dues_pending", "up_to_date", "nothing_paid"] as const),
    panMissing: one(sp.pan) === "missing" ? true : undefined,
    project: one(sp.project),
    min: money(sp.min),
    max: money(sp.max),
  };
}

export function parseReceivedFilters(sp: Params): ReceivedFilters {
  return {
    ...parseCommon(sp),
    mode: one(sp.mode),
    paidBy: pick(sp.by, ["client", "bank"] as const),
    bank: one(sp.bank),
    payFor: one(sp.for),
    gstOnly: one(sp.gst) === "only" ? true : undefined,
  };
}

export function parseDueFilters(sp: Params): DueFilters {
  return {
    ...parseCommon(sp),
    milestone: one(sp.ms),
    when: pick(sp.when, ["overdue", "projected"] as const),
    age: pick(sp.age, AGE_BANDS),
    loanBank: one(sp.lbank),
  };
}

/** How many filters are switched on (not counting the period). */
export function activeCount(f: object): number {
  return Object.values(f).filter((v) => v !== undefined && v !== false && v !== "").length;
}

/** One-line summary of the switched-on filters, for the file's tip row. */
export function describeFilters(f: ReceivedFilters & DueFilters): string {
  const parts: string[] = [];
  if (f.q) parts.push(`search "${f.q}"`);
  if (f.paymentType) parts.push(PAYMENT_TYPE_LABELS[f.paymentType]);
  if (f.status) parts.push(ACCOUNT_STATUS_LABELS[f.status]);
  if (f.panMissing) parts.push("PAN missing");
  if (f.project) parts.push(`project "${f.project}"`);
  if (f.min !== undefined) parts.push(`min Rs ${f.min / 100n}`);
  if (f.max !== undefined) parts.push(`max Rs ${f.max / 100n}`);
  if (f.mode) parts.push(`mode ${f.mode}`);
  if (f.paidBy) parts.push(`paid by ${f.paidBy}`);
  if (f.bank) parts.push(`bank ${f.bank}`);
  if (f.payFor) parts.push(`for "${f.payFor}"`);
  if (f.gstOnly) parts.push("GST-only receipts");
  if (f.milestone) parts.push(`milestone "${f.milestone}"`);
  if (f.when) parts.push(f.when);
  if (f.age) parts.push(`${f.age} days overdue`);
  if (f.loanBank) parts.push(`loan bank ${f.loanBank}`);
  return parts.join(", ");
}

// --- row predicates ---------------------------------------------------------

/** The part of a report row the common filters look at. */
export interface RowBase {
  customer: string;
  mobile: string;
  unit: string;
  clientCode: string | null;
  bookingCode: string | null;
  project: string;
  paymentTypeKey: "self_finance" | "bank_loan" | "installment";
  stageBased: boolean;
  panHash: string | null;
  hasPan: boolean;
  accountStatus: AccountStatus;
  amount: bigint; // the row's headline amount (received total / total due)
}

export interface FilterContext {
  /** HMAC of the search text, when it is a valid PAN (exact-match search). */
  qPanHash?: string | null;
}

/** Hash the search text only when it looks like a PAN. */
export function panQueryHash(
  q: string | undefined,
  hash: (pan: string) => string,
): string | null {
  return q && isValidPan(q) ? hash(normalizePan(q)) : null;
}

function matchesCommon(row: RowBase, f: CommonFilters, ctx: FilterContext): boolean {
  if (f.q) {
    const q = norm(f.q);
    const hit =
      [row.customer, row.mobile, row.unit, row.clientCode, row.bookingCode].some((h) =>
        norm(h).includes(q),
      ) || (!!ctx.qPanHash && row.panHash === ctx.qPanHash);
    if (!hit) return false;
  }
  if (f.paymentType) {
    // "Stage-based" is its own choice; the others match the booking's payment type.
    const ok = f.paymentType === "stage" ? row.stageBased : row.paymentTypeKey === f.paymentType;
    if (!ok) return false;
  }
  if (f.status && row.accountStatus !== f.status) return false;
  if (f.panMissing && row.hasPan) return false;
  if (f.project && !norm(row.project).includes(norm(f.project))) return false;
  if (f.min !== undefined && row.amount < f.min) return false;
  if (f.max !== undefined && row.amount > f.max) return false;
  return true;
}

export interface ReceivedRowFields extends RowBase {
  mode: string; // payment mode key
  paidBy: "client" | "bank";
  instrumentBank: string | null;
  paymentFor: string | null;
  basic: bigint;
  gst: bigint;
}

export function matchesReceived(row: ReceivedRowFields, f: ReceivedFilters, ctx: FilterContext = {}): boolean {
  if (!matchesCommon(row, f, ctx)) return false;
  if (f.mode && row.mode !== f.mode) return false;
  if (f.paidBy && row.paidBy !== f.paidBy) return false;
  if (f.bank && bankKey(row.instrumentBank) !== bankKey(f.bank)) return false;
  if (f.payFor && !norm(row.paymentFor).includes(norm(f.payFor))) return false;
  if (f.gstOnly && !(row.basic === 0n && row.gst > 0n)) return false;
  return true;
}

export interface DueRowFields extends RowBase {
  instalment: string;
  projected: boolean;
  daysOverdue: number;
  loanBank: string | null;
}

export function matchesDue(row: DueRowFields, f: DueFilters, ctx: FilterContext = {}): boolean {
  if (!matchesCommon(row, f, ctx)) return false;
  if (f.milestone && !norm(row.instalment).includes(norm(f.milestone))) return false;
  if (f.when === "overdue" && row.projected) return false;
  if (f.when === "projected" && !row.projected) return false;
  if (f.age && (row.projected || ageBand(row.daysOverdue) !== f.age)) return false;
  if (f.loanBank && bankKey(row.loanBank) !== bankKey(f.loanBank)) return false;
  return true;
}
