/**
 * unit-board.ts — data behind the unit board (the dashboard).
 * A unit is "booked" when a booking points at it, "blocked" when an admin has
 * blocked it, otherwise "available". Nothing about booked-ness is stored.
 */
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { bookings, customers, units } from "@/db/schema";
import { computeGstStatus } from "./gst-calc";
import { loadBookingDetail, todayISO, type BookingDetail } from "./booking-detail";
import {
  bookingStatement,
  paymentComponents,
  scheduleComponents,
} from "./statement";

export type UnitStatus = "booked" | "available" | "blocked";

export interface BoardUnit {
  id: string;
  projectName: string;
  unitType: string;
  unitNumber: string;
  name: string; // "Bungalow 3"
  status: UnitStatus;
  owner: string | null;
  bookingId: string | null;
  blockReason: string | null;
}

export interface BoardData {
  units: BoardUnit[];
  counts: { total: number; booked: number; available: number; blocked: number };
  types: string[];
  projects: string[];
}

export const unitName = (type: string, number: string) =>
  number.startsWith("(") ? type : `${type} ${number}`;

export async function getBoard(): Promise<BoardData> {
  const rows = await db
    .select({
      id: units.id,
      projectName: units.projectName,
      unitType: units.unitType,
      unitNumber: units.unitNumber,
      blocked: units.blocked,
      blockReason: units.blockReason,
      bookingId: bookings.id,
      owner: customers.fullName,
    })
    .from(units)
    .leftJoin(bookings, eq(bookings.unitId, units.id))
    .leftJoin(customers, eq(customers.id, bookings.customerId));

  const list: BoardUnit[] = rows
    .map((r) => ({
      id: r.id,
      projectName: r.projectName,
      unitType: r.unitType,
      unitNumber: r.unitNumber,
      name: unitName(r.unitType, r.unitNumber),
      status: (r.bookingId ? "booked" : r.blocked ? "blocked" : "available") as UnitStatus,
      owner: r.owner,
      bookingId: r.bookingId,
      blockReason: r.blockReason,
    }))
    .sort(
      (a, b) =>
        a.projectName.localeCompare(b.projectName) ||
        a.unitType.localeCompare(b.unitType) ||
        a.unitNumber.localeCompare(b.unitNumber, undefined, { numeric: true }),
    );

  const count = (s: UnitStatus) => list.filter((u) => u.status === s).length;
  return {
    units: list,
    counts: {
      total: list.length,
      booked: count("booked"),
      available: count("available"),
      blocked: count("blocked"),
    },
    types: [...new Set(list.map((u) => u.unitType))],
    projects: [...new Set(list.map((u) => u.projectName).filter(Boolean))],
  };
}

// --- one unit's panel -------------------------------------------------------

export interface ChargeLine {
  label: string;
  total: bigint;
  received: bigint;
  due: bigint;
  note?: string;
}

export interface UnitPanelData {
  unit: BoardUnit;
  detail: BookingDetail | null;
  charges: ChargeLine[];
}

export async function getUnitPanel(unitId: string): Promise<UnitPanelData | null> {
  const board = await getBoard();
  const unit = board.units.find((u) => u.id === unitId);
  if (!unit) return null;

  const detail = unit.bookingId ? await loadBookingDetail(unit.bookingId) : null;
  if (!detail || !detail.cost) return { unit, detail, charges: [] };

  const { cost, payments, schedule } = detail;
  const sumOf = (f: (p: (typeof payments)[number]) => bigint) =>
    payments.reduce((s, p) => s + f(p), 0n);

  const gstPaid = sumOf((p) => p.gstAmount);
  const docPaid = sumOf((p) => p.documentationAmount);
  const maintPaid = sumOf((p) => p.maintenanceAmount);
  const basicCollected = sumOf(
    (p) => p.amount - p.gstAmount - p.maintenanceAmount - p.documentationAmount,
  );

  // GST and document charges are owed in proportion to the basic collected.
  const gst = computeGstStatus({
    gstRateBps: cost.gstPercentBps,
    basicCollected,
    gstCollected: gstPaid,
  });
  const doc = computeGstStatus({
    gstRateBps: cost.documentationPercentBps,
    basicCollected,
    gstCollected: docPaid,
  });
  // Maintenance is a fixed deposit: due once an instalment for it falls due.
  const st = bookingStatement(
    schedule.map((s) => ({
      id: s.id,
      dueDate: s.dueDate,
      label: s.label,
      percentageBps: s.percentageBps,
      comps: scheduleComponents(s),
    })),
    payments.map(paymentComponents),
    todayISO(),
  );

  return {
    unit,
    detail,
    charges: [
      {
        label: `GST (${cost.gstPercentBps / 100}%)`,
        total: cost.gstAmount,
        received: gstPaid,
        due: gst.gstShortfall,
      },
      {
        label: `Document charges (${cost.documentationPercentBps / 100}%)`,
        total: cost.documentationAmount,
        received: docPaid,
        due: doc.gstShortfall,
      },
      {
        label: "Maintenance",
        total: cost.maintenanceCharge,
        received: maintPaid,
        due: st.due.other,
        note: "due when scheduled",
      },
    ],
  };
}
