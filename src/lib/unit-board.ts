/**
 * unit-board.ts — data behind the unit board (the dashboard).
 * A unit is "booked" when a booking points at it, "blocked" when an admin has
 * blocked it, otherwise "available". Nothing about booked-ness is stored.
 */
import { eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { bookings, customers, units, users } from "@/db/schema";
import { blockActive } from "./unit-block";
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
  areaSqft: string | null;
  floor: string | null;
  /** Where its box sits on a site map (percent of the map), if placed. */
  map: { id: string; x: number; y: number; w: number; h: number } | null;
  /** Who the unit is held for, set while the unit is blocked. */
  block: {
    name: string;
    mobile: string;
    customerId: string | null;
    reason: string | null;
    by: string | null;
    on: string | null; // when it was blocked (ISO date)
    until: string | null; // null = never
  } | null;
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
  const blocker = alias(users, "blocker");
  const rows = await db
    .select({
      id: units.id,
      projectName: units.projectName,
      unitType: units.unitType,
      unitNumber: units.unitNumber,
      areaSqft: units.areaSqft,
      floor: units.floor,
      mapId: units.mapId,
      mapX: units.mapX,
      mapY: units.mapY,
      mapW: units.mapW,
      mapH: units.mapH,
      blocked: units.blocked,
      blockReason: units.blockReason,
      blockedAt: units.blockedAt,
      blockName: units.blockName,
      blockMobile: units.blockMobile,
      blockCustomerId: units.blockCustomerId,
      unblockOn: units.unblockOn,
      blockedByName: blocker.name,
      bookingId: bookings.id,
      owner: customers.fullName,
    })
    .from(units)
    .leftJoin(bookings, eq(bookings.unitId, units.id))
    .leftJoin(customers, eq(customers.id, bookings.customerId))
    .leftJoin(blocker, eq(blocker.id, units.blockedBy));

  const list: BoardUnit[] = rows
    .map((r) => {
      const held = !r.bookingId && blockActive(r);
      return {
        id: r.id,
        projectName: r.projectName,
        unitType: r.unitType,
        unitNumber: r.unitNumber,
        name: unitName(r.unitType, r.unitNumber),
        status: (r.bookingId ? "booked" : held ? "blocked" : "available") as UnitStatus,
        owner: r.owner,
        bookingId: r.bookingId,
        areaSqft: r.areaSqft,
        floor: r.floor,
        map:
          r.mapId && r.mapX !== null && r.mapY !== null && r.mapW !== null && r.mapH !== null
            ? { id: r.mapId, x: r.mapX, y: r.mapY, w: r.mapW, h: r.mapH }
            : null,
        block: held
          ? {
              name: r.blockName ?? "Unknown",
              mobile: r.blockMobile ?? "",
              customerId: r.blockCustomerId,
              reason: r.blockReason,
              by: r.blockedByName,
              on: r.blockedAt?.toISOString().slice(0, 10) ?? null,
              until: r.unblockOn,
            }
          : null,
      };
    })
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
