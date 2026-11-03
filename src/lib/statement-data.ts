/**
 * statement-data.ts — DB readers for the month-wise Payment Received, Payment
 * Due and Statement reports. All maths lives in statement.ts (pure + tested) and
 * all filtering in report-filters.ts (pure + tested). Amounts are bigint paise.
 */
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import {
  bookings,
  customers,
  loans,
  paymentSchedule,
  payments,
  propertyCosts,
  users,
} from "@/db/schema";
import { todayISO } from "./dates";
import { activeProjectId, inProject } from "./project-scope";
import { displayPan, hashPan } from "./pan";
import { calculateReceivable, PAYMENT_TYPES, type PaymentType } from "./stage";
import {
  ZERO,
  bookingStatement,
  monthRange,
  paymentComponents,
  rowDues,
  scheduleComponents,
  splitGst,
  sumComponents,
  type Components,
  type ScheduleItem,
} from "./statement";
import {
  accountStatus,
  matchesDue,
  matchesReceived,
  panQueryHash,
  type AccountStatus,
  type DueFilters,
  type DueRowFields,
  type Period,
  type ReceivedFilters,
  type ReceivedRowFields,
} from "./report-filters";

export const MODE_LABELS: Record<string, string> = {
  bank_transfer: "Bank transfer",
  rtgs: "RTGS",
  neft: "NEFT",
  imps: "IMPS",
  cheque: "Cheque/DD",
  cash: "Cash",
  upi: "UPI",
  card: "Card",
  other: "Other",
};

export function paymentTypeLabel(paymentType: string, stageBased: boolean): string {
  const base = PAYMENT_TYPES[paymentType as PaymentType] ?? paymentType;
  return stageBased ? `${base} · Stage` : base;
}

const unitName = (type: string, number: string | null) => (number ? number : type);

const add = (a: Components, b: Components): Components => ({
  basic: a.basic + b.basic,
  gst: a.gst + b.gst,
  other: a.other + b.other,
  doc: a.doc + b.doc,
});

const unique = (xs: string[]) =>
  [...new Set(xs.filter((x) => x && x !== "—"))].sort((a, b) => a.localeCompare(b));

/** Who is looking: decides whether full PANs are shown. */
export interface Viewer {
  canSeePan: boolean;
}

function panQueryHashSafe(q: string | undefined): string | null {
  try {
    return panQueryHash(q, hashPan);
  } catch {
    return null; // no key configured: PAN search simply finds nothing
  }
}

// --- per-unit account status ------------------------------------------------

export interface AccountInfo {
  status: AccountStatus;
  totalCost: bigint;
  received: bigint;
  dueNow: bigint;
  /** Receivable so far minus received; negative means paid in advance. */
  outstanding: bigint;
}

export async function loadAccounts(asOf: string): Promise<Map<string, AccountInfo>> {
  const [bk, costs, pays, sched] = await Promise.all([
    db
      .select({
        id: bookings.id,
        paymentType: bookings.paymentType,
        stageBased: bookings.stageBased,
        currentStage: bookings.currentStage,
      })
      .from(bookings)
      .where(inProject(bookings.projectId, await activeProjectId())),
    db
      .select({ bookingId: propertyCosts.bookingId, totalCost: propertyCosts.totalCost })
      .from(propertyCosts),
    db.select({ bookingId: payments.bookingId, amount: payments.amount }).from(payments),
    db
      .select({
        bookingId: paymentSchedule.bookingId,
        dueDate: paymentSchedule.dueDate,
        amount: paymentSchedule.amount,
      })
      .from(paymentSchedule),
  ]);
  const costOf = new Map(costs.map((c) => [c.bookingId, c.totalCost]));
  const received = new Map<string, bigint>();
  for (const p of pays) received.set(p.bookingId, (received.get(p.bookingId) ?? 0n) + p.amount);
  const scheduled = new Map<string, bigint>();
  for (const s of sched)
    if (s.dueDate <= asOf)
      scheduled.set(s.bookingId, (scheduled.get(s.bookingId) ?? 0n) + s.amount);

  const out = new Map<string, AccountInfo>();
  for (const b of bk) {
    const totalCost = costOf.get(b.id) ?? 0n;
    const got = received.get(b.id) ?? 0n;
    const receivable = calculateReceivable({
      totalCost,
      paymentType: b.paymentType,
      stageBased: b.stageBased,
      currentStage: b.currentStage,
      scheduleDueTillDate: scheduled.get(b.id) ?? 0n,
    });
    const dueNow = receivable > got ? receivable - got : 0n;
    out.set(b.id, {
      totalCost,
      received: got,
      dueNow,
      outstanding: receivable - got,
      status: accountStatus({ totalCost, received: got, dueNow }),
    });
  }
  return out;
}

// --- Payment Received -------------------------------------------------------

export interface ReceivedRow {
  no: number;
  paymentId: string;
  bookingId: string;
  date: string;
  unit: string;
  customer: string;
  mobile: string;
  pan: string; // full for allowed roles, masked otherwise, "" when missing
  panMissing: boolean;
  phone: string; // landline
  joint: string; // joint applicants' names
  clientCode: string;
  bookingCode: string;
  paymentNumber: string;
  receiptNo: string;
  paymentType: string;
  paidBy: string;
  mode: string;
  modeKey: string;
  instrumentDate: string | null;
  instrumentNumber: string;
  bank: string; // bank on the instrument
  loanBank: string;
  loanBranch: string;
  basic: bigint;
  cgst: bigint;
  sgst: bigint;
  maintenance: bigint;
  documentation: bigint;
  total: bigint;
  paymentFor: string;
  bookedBy: string;
  receivedBy: string;
  narration: string;
  accountStatus: AccountStatus;
}

export interface ReceivedReport {
  month: string | null;
  from: string;
  to: string;
  rows: ReceivedRow[];
  unfilteredCount: number;
  totals: {
    basic: bigint;
    cgst: bigint;
    sgst: bigint;
    maintenance: bigint;
    documentation: bigint;
    total: bigint;
  };
  /** Values the filter dropdowns offer, taken from the unfiltered period. */
  options: { banks: string[]; paymentFor: string[] };
}

export async function getReceivedReport(
  period: Period,
  filters: ReceivedFilters,
  viewer: Viewer,
): Promise<ReceivedReport> {
  const { from, to } = period;
  const [rows, accounts] = await Promise.all([
    db
      .select({
        paymentId: payments.id,
        bookingId: bookings.id,
        bookingCode: bookings.bookingCode,
        project: bookings.projectName,
        date: payments.paymentDate,
        propertyType: bookings.propertyType,
        propertyNumber: bookings.propertyNumber,
        paymentType: bookings.paymentType,
        stageBased: bookings.stageBased,
        customer: customers.fullName,
        mobile: customers.mobile,
        clientCode: customers.clientCode,
        salesExecutive: customers.salesExecutive,
        panEncrypted: customers.panEncrypted,
        panMasked: customers.panMasked,
        panHash: customers.panHash,
        profile: customers.profile,
        jointApplicants: customers.jointApplicants,
        source: payments.source,
        mode: payments.mode,
        reference: payments.referenceNumber,
        paymentNumber: payments.paymentNumber,
        instrumentDate: payments.instrumentDate,
        instrumentNumber: payments.instrumentNumber,
        instrumentBank: payments.instrumentBank,
        loanBank: loans.bankName,
        loanBranch: loans.branchName,
        amount: payments.amount,
        gstAmount: payments.gstAmount,
        maintenanceAmount: payments.maintenanceAmount,
        documentationAmount: payments.documentationAmount,
        paymentFor: payments.paymentFor,
        notes: payments.notes,
        receivedBy: users.name,
      })
      .from(payments)
      .innerJoin(bookings, eq(payments.bookingId, bookings.id))
      .innerJoin(customers, eq(bookings.customerId, customers.id))
      .leftJoin(loans, eq(loans.bookingId, bookings.id))
      .leftJoin(users, eq(users.id, payments.createdBy))
      .where(
        and(
          gte(payments.paymentDate, from),
          lte(payments.paymentDate, to),
          inProject(bookings.projectId, await activeProjectId()),
        ),
      )
      .orderBy(desc(payments.paymentDate), desc(payments.createdAt)),
    loadAccounts(todayISO()),
  ]);

  const qPanHash = panQueryHashSafe(filters.q);
  const built: { row: ReceivedRow; fields: ReceivedRowFields }[] = [];

  for (const r of rows) {
    const c = paymentComponents(r);
    const { cgst, sgst } = splitGst(c.gst);
    const status = accounts.get(r.bookingId)?.status ?? "nothing_paid";
    const unit = unitName(r.propertyType, r.propertyNumber);
    const hasPan = !!r.panEncrypted || !!r.panMasked;
    built.push({
      row: {
        no: 0,
        paymentId: r.paymentId,
        bookingId: r.bookingId,
        date: r.date,
        unit,
        customer: r.customer,
        mobile: r.mobile,
        pan: displayPan(r, viewer.canSeePan) ?? "",
        panMissing: !hasPan,
        phone: r.profile.landline ?? "",
        joint: r.jointApplicants.map((j) => j.name).join(", "),
        clientCode: r.clientCode ?? "—",
        bookingCode: r.bookingCode ?? "—",
        paymentNumber: r.paymentNumber ?? "—",
        receiptNo: r.reference ?? "—",
        paymentType: paymentTypeLabel(r.paymentType, r.stageBased),
        paidBy: r.source === "bank" ? "Bank" : "Client",
        mode: MODE_LABELS[r.mode] ?? r.mode,
        modeKey: r.mode,
        instrumentDate: r.instrumentDate,
        instrumentNumber: r.instrumentNumber ?? "—",
        bank: r.instrumentBank ?? "—",
        loanBank: r.source === "bank" ? (r.loanBank ?? "—") : "—",
        loanBranch: r.source === "bank" ? (r.loanBranch ?? "—") : "—",
        basic: c.basic,
        cgst,
        sgst,
        maintenance: c.other,
        documentation: c.doc,
        total: r.amount,
        paymentFor: r.paymentFor ?? "—",
        bookedBy: r.salesExecutive ?? "—",
        receivedBy: r.receivedBy ?? "—",
        narration: r.notes ?? "",
        accountStatus: status,
      },
      fields: {
        customer: r.customer,
        mobile: r.mobile,
        unit,
        clientCode: r.clientCode,
        bookingCode: r.bookingCode,
        project: r.project ?? "",
        unitType: r.propertyType,
        paymentTypeKey: r.paymentType,
        stageBased: r.stageBased,
        panHash: r.panHash,
        hasPan,
        accountStatus: status,
        amount: r.amount,
        mode: r.mode,
        paidBy: r.source === "bank" ? "bank" : "client",
        instrumentBank: r.instrumentBank,
        paymentFor: r.paymentFor,
        basic: c.basic,
        gst: c.gst,
      },
    });
  }

  const kept = built.filter((x) => matchesReceived(x.fields, filters, { qPanHash })).map((x) => x.row);
  const totals = { basic: 0n, cgst: 0n, sgst: 0n, maintenance: 0n, documentation: 0n, total: 0n };
  kept.forEach((row, i) => {
    row.no = i + 1;
    totals.basic += row.basic;
    totals.cgst += row.cgst;
    totals.sgst += row.sgst;
    totals.maintenance += row.maintenance;
    totals.documentation += row.documentation;
    totals.total += row.total;
  });

  return {
    month: period.month,
    from,
    to,
    rows: kept,
    unfilteredCount: rows.length,
    totals,
    options: {
      banks: unique(rows.map((r) => r.instrumentBank ?? "")),
      paymentFor: unique(rows.map((r) => r.paymentFor ?? "")),
    },
  };
}

// --- shared loader for due + statement --------------------------------------

interface BookingInfo {
  bookingId: string;
  bookingCode: string | null;
  project: string;
  unit: string;
  customer: string;
  mobile: string;
  clientCode: string | null;
  bookedBy: string | null;
  panEncrypted: string | null;
  panMasked: string | null;
  panHash: string | null;
  unitType: string;
  phone: string;
  joint: string;
  paymentType: string; // label
  paymentTypeKey: PaymentType;
  stageBased: boolean;
  loanBank: string | null;
  loanBranch: string | null;
  loanBranchContact: string | null;
  schedule: ScheduleItem[];
  payments: { date: string; comps: Components }[];
}

async function loadBookings(): Promise<BookingInfo[]> {
  const [bookingRows, scheduleRows, paymentRows] = await Promise.all([
    db
      .select({
        id: bookings.id,
        bookingCode: bookings.bookingCode,
        project: bookings.projectName,
        propertyType: bookings.propertyType,
        propertyNumber: bookings.propertyNumber,
        paymentType: bookings.paymentType,
        stageBased: bookings.stageBased,
        customer: customers.fullName,
        mobile: customers.mobile,
        clientCode: customers.clientCode,
        salesExecutive: customers.salesExecutive,
        panEncrypted: customers.panEncrypted,
        panMasked: customers.panMasked,
        panHash: customers.panHash,
        profile: customers.profile,
        jointApplicants: customers.jointApplicants,
        loanBank: loans.bankName,
        loanBranch: loans.branchName,
        loanBranchContact: loans.branchContact,
      })
      .from(bookings)
      .innerJoin(customers, eq(bookings.customerId, customers.id))
      .leftJoin(loans, eq(loans.bookingId, bookings.id))
      .where(inProject(bookings.projectId, await activeProjectId())),
    db.select().from(paymentSchedule),
    db.select().from(payments),
  ]);

  const schedByBooking = new Map<string, ScheduleItem[]>();
  for (const s of scheduleRows) {
    const list = schedByBooking.get(s.bookingId) ?? [];
    list.push({
      id: s.id,
      dueDate: s.dueDate,
      label: s.label,
      percentageBps: s.percentageBps,
      comps: scheduleComponents(s),
    });
    schedByBooking.set(s.bookingId, list);
  }
  const payByBooking = new Map<string, { date: string; comps: Components }[]>();
  for (const p of paymentRows) {
    const list = payByBooking.get(p.bookingId) ?? [];
    list.push({ date: p.paymentDate, comps: paymentComponents(p) });
    payByBooking.set(p.bookingId, list);
  }

  return bookingRows.map((b) => ({
    bookingId: b.id,
    bookingCode: b.bookingCode,
    project: b.project ?? "",
    unit: unitName(b.propertyType, b.propertyNumber),
    customer: b.customer,
    mobile: b.mobile,
    clientCode: b.clientCode,
    bookedBy: b.salesExecutive,
    panEncrypted: b.panEncrypted,
    panMasked: b.panMasked,
    panHash: b.panHash,
    unitType: b.propertyType,
    phone: b.profile.landline ?? "",
    joint: b.jointApplicants.map((j) => j.name).join(", "),
    paymentType: paymentTypeLabel(b.paymentType, b.stageBased),
    paymentTypeKey: b.paymentType,
    stageBased: b.stageBased,
    loanBank: b.loanBank,
    loanBranch: b.loanBranch,
    loanBranchContact: b.loanBranchContact,
    schedule: schedByBooking.get(b.id) ?? [],
    payments: payByBooking.get(b.id) ?? [],
  }));
}

// --- Payment Due ------------------------------------------------------------

export interface DueRow {
  no: number;
  bookingId: string;
  bookingCode: string;
  clientCode: string;
  dueDate: string;
  unit: string;
  customer: string;
  mobile: string;
  pan: string;
  panMissing: boolean;
  phone: string;
  joint: string;
  paymentType: string;
  instalment: string;
  percentage: number | null; // percent, e.g. 10 or 11.54
  basic: bigint;
  cgst: bigint;
  sgst: bigint;
  other: bigint;
  doc: bigint;
  total: bigint;
  daysOverdue: number;
  projected: boolean;
  loanBank: string;
  loanBranch: string;
  loanBranchContact: string;
  bookedBy: string;
  accountStatus: AccountStatus;
}

export interface DueReport {
  month: string | null;
  from: string;
  to: string;
  asOf: string;
  rows: DueRow[];
  unfilteredCount: number;
  totals: {
    basic: bigint;
    cgst: bigint;
    sgst: bigint;
    other: bigint;
    doc: bigint;
    total: bigint;
  };
  options: { milestones: string[]; loanBanks: string[] };
}

export async function getDueReport(
  period: Period,
  filters: DueFilters,
  viewer: Viewer,
  asOf: string = todayISO(),
): Promise<DueReport> {
  const { from, to } = period;
  const [all, accounts] = await Promise.all([loadBookings(), loadAccounts(asOf)]);
  const qPanHash = panQueryHashSafe(filters.q);

  const built: { row: DueRow; fields: DueRowFields }[] = [];

  for (const b of all) {
    const dues = rowDues(b.schedule, b.payments.map((p) => p.comps), asOf);
    const status = accounts.get(b.bookingId)?.status ?? "nothing_paid";
    const hasPan = !!b.panEncrypted || !!b.panMasked;
    for (const d of dues) {
      if (d.item.dueDate < from || d.item.dueDate > to) continue;
      const total = sumComponents(d.due);
      if (total === 0n) continue;
      const { cgst, sgst } = splitGst(d.due.gst);
      const instalment = d.item.label ?? "Installment";
      built.push({
        row: {
          no: 0,
          bookingId: b.bookingId,
          bookingCode: b.bookingCode ?? "—",
          clientCode: b.clientCode ?? "—",
          dueDate: d.item.dueDate,
          unit: b.unit,
          customer: b.customer,
          mobile: b.mobile,
          pan: displayPan(b, viewer.canSeePan) ?? "",
          panMissing: !hasPan,
          phone: b.phone,
          joint: b.joint,
          paymentType: b.paymentType,
          instalment,
          percentage: d.item.percentageBps === null ? null : d.item.percentageBps / 100,
          basic: d.due.basic,
          cgst,
          sgst,
          other: d.due.other,
          doc: d.due.doc,
          total,
          daysOverdue: d.daysOverdue,
          projected: d.projected,
          loanBank: b.loanBank ?? "—",
          loanBranch: b.loanBranch ?? "—",
          loanBranchContact: b.loanBranchContact ?? "—",
          bookedBy: b.bookedBy ?? "—",
          accountStatus: status,
        },
        fields: {
          customer: b.customer,
          mobile: b.mobile,
          unit: b.unit,
          clientCode: b.clientCode,
          bookingCode: b.bookingCode,
          project: b.project,
          unitType: b.unitType,
          paymentTypeKey: b.paymentTypeKey,
          stageBased: b.stageBased,
          panHash: b.panHash,
          hasPan,
          accountStatus: status,
          amount: total,
          instalment,
          projected: d.projected,
          daysOverdue: d.daysOverdue,
          loanBank: b.loanBank,
        },
      });
    }
  }

  const kept = built
    .filter((x) => matchesDue(x.fields, filters, { qPanHash }))
    .map((x) => x.row)
    .sort(
      (a, b) =>
        a.dueDate.localeCompare(b.dueDate) ||
        a.unit.localeCompare(b.unit, undefined, { numeric: true }),
    );

  const totals = { basic: 0n, cgst: 0n, sgst: 0n, other: 0n, doc: 0n, total: 0n };
  kept.forEach((r, i) => {
    r.no = i + 1;
    totals.basic += r.basic;
    totals.cgst += r.cgst;
    totals.sgst += r.sgst;
    totals.other += r.other;
    totals.doc += r.doc;
    totals.total += r.total;
  });

  return {
    month: period.month,
    from,
    to,
    asOf,
    rows: kept,
    unfilteredCount: built.length,
    totals,
    options: {
      milestones: unique(built.map((x) => x.row.instalment)),
      loanBanks: unique(built.map((x) => x.row.loanBank)),
    },
  };
}

// --- Statement: Receivable / Received / Due by category ---------------------

export interface StatementLine {
  receivable: Components;
  received: Components;
  due: Components;
}

export interface Statement {
  month: string;
  from: string;
  to: string;
  asOf: string;
  thisMonth: StatementLine;
  allTime: StatementLine;
}

export async function getStatement(
  month: string,
  asOf: string = todayISO(),
): Promise<Statement> {
  const { from, to } = monthRange(month);
  const all = await loadBookings();

  let mReceivable = ZERO;
  let mReceived = ZERO;
  let mDue = ZERO;
  let aReceivable = ZERO;
  let aReceived = ZERO;
  let aDue = ZERO;

  for (const b of all) {
    const payComps = b.payments.map((p) => p.comps);
    const st = bookingStatement(b.schedule, payComps, asOf);
    aReceivable = add(aReceivable, st.receivable);
    aReceived = add(aReceived, st.received);
    aDue = add(aDue, st.due);

    for (const s of b.schedule) {
      if (s.dueDate >= from && s.dueDate <= to) mReceivable = add(mReceivable, s.comps);
    }
    for (const p of b.payments) {
      if (p.date >= from && p.date <= to) mReceived = add(mReceived, p.comps);
    }
    for (const d of rowDues(b.schedule, payComps, asOf)) {
      if (d.item.dueDate >= from && d.item.dueDate <= to) mDue = add(mDue, d.due);
    }
  }

  return {
    month,
    from,
    to,
    asOf,
    thisMonth: { receivable: mReceivable, received: mReceived, due: mDue },
    allTime: { receivable: aReceivable, received: aReceived, due: aDue },
  };
}
