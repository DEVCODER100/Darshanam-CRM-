/**
 * stage-ladder.ts — stage-wise bank disbursement (pure, no DB, testable).
 *
 * Eligible Amount       = Total cost × current stage %  (cumulative, latest stage)
 * Pending Release       = Eligible − Received           (bank release allowed now)
 * Remaining Balance     = Total − Received
 *
 * Skipping earlier stages does NOT lose eligibility — the latest completed stage
 * sets the maximum releasable amount (see the spec's important rule).
 */
import {
  CONSTRUCTION_STAGES,
  amountAtPercent,
  stagePercentBps,
  type ConstructionStage,
} from "./stage";

export type StageStatus = "completed" | "active" | "pending" | "locked";

export interface StageRung {
  value: ConstructionStage;
  label: string;
  percentBps: number;
  eligibleAmount: bigint;
  received: bigint | null; // amount allocated to this stage (null when locked)
  due: bigint | null; // eligible − received (null when locked)
  released: boolean; // received covers this stage's eligible amount
  status: StageStatus;
}

/**
 * The 7-stage ladder for a booking. For each unlocked stage, `received` is the
 * collected amount allocated to it (capped at its eligible amount) and `due` is
 * the gap. Locked stages (above the current one) show null amounts.
 */
export function stageLadder(
  totalCost: bigint,
  currentStage: ConstructionStage | null,
  received: bigint,
): StageRung[] {
  const currentIndex = currentStage
    ? CONSTRUCTION_STAGES.findIndex((s) => s.value === currentStage)
    : -1;

  return CONSTRUCTION_STAGES.map((s, i) => {
    const eligibleAmount = amountAtPercent(totalCost, s.percentBps);
    const releasedFull = received >= eligibleAmount && eligibleAmount > 0n;
    let status: StageStatus;
    if (currentIndex < 0 || i > currentIndex) status = "locked";
    else if (i === currentIndex) status = "active";
    else status = releasedFull ? "completed" : "pending";

    const locked = status === "locked";
    const receivedForStage = locked
      ? null
      : received >= eligibleAmount
        ? eligibleAmount
        : received;
    const due = locked ? null : eligibleAmount - (receivedForStage ?? 0n);

    return {
      value: s.value,
      label: s.label,
      percentBps: s.percentBps,
      eligibleAmount,
      received: receivedForStage,
      due,
      released: releasedFull,
      status,
    };
  });
}

export interface StageDisbursement {
  currentPercentBps: number;
  eligible: bigint;
  received: bigint;
  pendingRelease: bigint; // eligible − received (clamped ≥ 0) = current amount due
  remaining: bigint; // total − received (clamped ≥ 0)
  fullyPaid: boolean; // current stage fully collected (due == 0)
  nextStage: { value: ConstructionStage; label: string; percentBps: number } | null;
}

export function stageDisbursement(
  totalCost: bigint,
  currentStage: ConstructionStage | null,
  received: bigint,
): StageDisbursement {
  const currentPercentBps = stagePercentBps(currentStage);
  const eligible = amountAtPercent(totalCost, currentPercentBps);
  const pendingRelease = eligible > received ? eligible - received : 0n;
  const remaining = totalCost > received ? totalCost - received : 0n;

  const idx = currentStage
    ? CONSTRUCTION_STAGES.findIndex((s) => s.value === currentStage)
    : -1;
  const next =
    idx >= 0 && idx < CONSTRUCTION_STAGES.length - 1
      ? CONSTRUCTION_STAGES[idx + 1]
      : null;

  return {
    currentPercentBps,
    eligible,
    received,
    pendingRelease,
    remaining,
    fullyPaid: currentStage !== null && pendingRelease === 0n,
    nextStage: next
      ? { value: next.value, label: next.label, percentBps: next.percentBps }
      : null,
  };
}
