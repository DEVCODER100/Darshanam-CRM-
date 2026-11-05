/**
 * unit-filters.ts — the big filter on the Dashboard: URL params -> typed filters ->
 * a yes/no per unit. Pure (no database), so the board, the map and the download
 * apply exactly the same rules.
 */
import { rupeesToPaise } from "./money";
import { bankKey, type AccountStatus, type Params } from "./report-filters";
import { CONSTRUCTION_STAGES, PAYMENT_TYPES, type ConstructionStage, type PaymentType } from "./stage";

export type UnitStatus = "booked" | "available" | "blocked";
export type Segment = "Residential" | "Commercial";

/** Shops are commercial; everything else is residential. */
export const segmentOf = (unitType: string): Segment => (unitType === "Shop" ? "Commercial" : "Residential");

/** What the filter looks at for each unit (the board's unit satisfies this). */
export interface FilterUnit {
  name: string; // "Bungalow B-3"
  unitNumber: string;
  unitType: string;
  subType: string | null;
  floor: string | null;
  areaSqft: string | null;
  status: UnitStatus;
  owner: string | null;
  booking: {
    code: string | null;
    date: string;
    paymentType: PaymentType;
    stageBased: boolean;
    stage: ConstructionStage | null;
    bookedBy: string | null;
    clientCode: string | null;
    mobile: string;
    panHash: string | null;
    loanBank: string | null;
    hasLoan: boolean;
    hasAgreement: boolean;
    totalCost: bigint;
    accountStatus: AccountStatus;
  } | null;
}

export interface UnitFilters {
  q?: string; // unit name or owner
  type?: string;
  subType?: string;
  segment?: Segment;
  status?: UnitStatus;
  bookingCode?: string;
  payment?: PaymentType;
  scheme?: "stage" | "schedule";
  stage?: ConstructionStage;
  client?: string; // name, mobile, client code or an exact PAN
  bookedBy?: string;
  loan?: "yes" | "no";
  bank?: string;
  agreement?: "yes" | "no";
  account?: AccountStatus;
  floor?: string;
  minPrice?: bigint;
  maxPrice?: bigint;
  minArea?: number;
  maxArea?: number;
  from?: string; // booking date range
  to?: string;
}

const one = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;

function pick<T extends string>(v: string | string[] | undefined, allowed: readonly T[]): T | undefined {
  const s = one(v);
  return s && (allowed as readonly string[]).includes(s) ? (s as T) : undefined;
}
function rupees(v: string | string[] | undefined): bigint | undefined {
  const s = one(v);
  try {
    return s ? rupeesToPaise(s) : undefined;
  } catch {
    return undefined;
  }
}
function num(v: string | string[] | undefined): number | undefined {
  const n = Number(one(v));
  return one(v) && Number.isFinite(n) && n >= 0 ? n : undefined;
}
const date = (v: string | string[] | undefined) => (/^\d{4}-\d{2}-\d{2}$/.test(one(v) ?? "") ? one(v) : undefined);

export const STATUS_KEYS = ["booked", "available", "blocked"] as const;
export const ACCOUNT_KEYS = ["paid_in_full", "dues_pending", "up_to_date", "nothing_paid"] as const;

export function parseUnitFilters(sp: Params): UnitFilters {
  return {
    q: one(sp.q),
    type: one(sp.type),
    subType: one(sp.sub),
    segment: pick(sp.seg, ["Residential", "Commercial"] as const),
    status: pick(sp.status, STATUS_KEYS),
    bookingCode: one(sp.bid),
    payment: pick(sp.pay, Object.keys(PAYMENT_TYPES) as PaymentType[]),
    scheme: pick(sp.scheme, ["stage", "schedule"] as const),
    stage: pick(sp.stage, CONSTRUCTION_STAGES.map((s) => s.value)),
    client: one(sp.client),
    bookedBy: one(sp.by),
    loan: pick(sp.loan, ["yes", "no"] as const),
    bank: one(sp.bank),
    agreement: pick(sp.agr, ["yes", "no"] as const),
    account: pick(sp.acct, ACCOUNT_KEYS),
    floor: one(sp.floor),
    minPrice: rupees(sp.pmin),
    maxPrice: rupees(sp.pmax),
    minArea: num(sp.amin),
    maxArea: num(sp.amax),
    from: date(sp.bfrom),
    to: date(sp.bto),
  };
}

/** How many filters are switched on. */
export const activeCount = (f: UnitFilters) => Object.values(f).filter((v) => v !== undefined && v !== "").length;

const norm = (s: string | null | undefined) => (s ?? "").toLowerCase().trim();
const has = (hay: string | null | undefined, needle: string) => norm(hay).includes(norm(needle));

/** `qPanHash`: the search text as a PAN hash (when it looks like a PAN), for exact PAN matching. */
export function matchesUnit(u: FilterUnit, f: UnitFilters, ctx: { clientPanHash?: string | null } = {}): boolean {
  const b = u.booking;
  if (f.q && !has(u.name, f.q) && !has(u.owner, f.q)) return false;
  if (f.type && u.unitType !== f.type) return false;
  if (f.subType && norm(u.subType) !== norm(f.subType)) return false;
  if (f.segment && segmentOf(u.unitType) !== f.segment) return false;
  if (f.status && u.status !== f.status) return false;
  if (f.floor && norm(u.floor) !== norm(f.floor)) return false;
  if (f.minArea !== undefined && !(Number(u.areaSqft) >= f.minArea)) return false;
  if (f.maxArea !== undefined && !(Number(u.areaSqft) <= f.maxArea)) return false;

  // Everything below is about the booking; an unbooked unit has none, so any such filter excludes it.
  const bookingFilter =
    f.bookingCode || f.payment || f.scheme || f.stage || f.client || f.bookedBy || f.loan || f.bank ||
    f.agreement || f.account || f.minPrice !== undefined || f.maxPrice !== undefined || f.from || f.to;
  if (!b) return !bookingFilter;

  if (f.bookingCode && !has(b.code, f.bookingCode)) return false;
  if (f.payment && b.paymentType !== f.payment) return false;
  if (f.scheme && (f.scheme === "stage") !== b.stageBased) return false;
  if (f.stage && b.stage !== f.stage) return false;
  if (f.client) {
    const hit = [u.owner, b.mobile, b.clientCode].some((h) => has(h, f.client!)) || (!!ctx.clientPanHash && b.panHash === ctx.clientPanHash);
    if (!hit) return false;
  }
  if (f.bookedBy && !has(b.bookedBy, f.bookedBy)) return false;
  if (f.loan && (f.loan === "yes") !== b.hasLoan) return false;
  if (f.bank && bankKey(b.loanBank) !== bankKey(f.bank)) return false;
  if (f.agreement && (f.agreement === "yes") !== b.hasAgreement) return false;
  if (f.account && b.accountStatus !== f.account) return false;
  if (f.minPrice !== undefined && b.totalCost < f.minPrice) return false;
  if (f.maxPrice !== undefined && b.totalCost > f.maxPrice) return false;
  if (f.from && b.date < f.from) return false;
  if (f.to && b.date > f.to) return false;
  return true;
}
