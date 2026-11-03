/** Rules for holding a unit for someone. Pure, so the board, the booking page and the API agree. */
import { todayISO } from "./dates";

/** A block holds the unit until `unblockOn` (null = never). On that date it is free again. */
export const blockActive = (
  u: { blocked: boolean; unblockOn: string | null },
  today: string = todayISO(),
) => u.blocked && (!u.unblockOn || u.unblockOn > today);

/** Column values that clear a block (release, or once the unit is booked). */
export const CLEAR_BLOCK = {
  blocked: false,
  blockReason: null,
  blockedAt: null,
  blockCustomerId: null,
  blockName: null,
  blockMobile: null,
  blockedBy: null,
  unblockOn: null,
} as const;
