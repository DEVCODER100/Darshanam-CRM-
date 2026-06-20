export const CONSTRUCTION_STAGES = [
  { value: "plinth", label: "Plinth Level (Coping)", percentBps: 4500 },
  { value: "ground_floor", label: "Ground Floor Slab Level", percentBps: 5500 },
  { value: "first_floor", label: "First Floor Slab Level", percentBps: 7000 },
  { value: "second_floor", label: "Second Floor Slab Level", percentBps: 8000 },
  { value: "outside_plaster", label: "Outside Plaster Work", percentBps: 9000 },
  { value: "flooring", label: "Flooring Level", percentBps: 9500 },
  { value: "finishing", label: "Finishing Level", percentBps: 10000 },
] as const;

export type ConstructionStage = (typeof CONSTRUCTION_STAGES)[number]["value"];
export type PaymentType = "self_finance" | "bank_loan" | "installment";

export function stagePercentBps(stage: ConstructionStage | null): number {
  if (!stage) return 0;
  return CONSTRUCTION_STAGES.find((item) => item.value === stage)?.percentBps ?? 0;
}

export function stageLabel(stage: ConstructionStage | null): string {
  if (!stage) return "Not selected";
  return CONSTRUCTION_STAGES.find((item) => item.value === stage)?.label ?? stage;
}

export function amountAtPercent(amount: bigint, percentBps: number): bigint {
  return (amount * BigInt(percentBps)) / 10000n;
}

export interface ReceivableInput {
  totalCost: bigint;
  paymentType: PaymentType;
  stageBased: boolean;
  currentStage: ConstructionStage | null;
  scheduleDueTillDate?: bigint;
}

export function calculateReceivable(input: ReceivableInput): bigint {
  const stageEligible = amountAtPercent(
    input.totalCost,
    stagePercentBps(input.currentStage),
  );

  if (input.paymentType === "installment") {
    const scheduled = input.scheduleDueTillDate ?? 0n;
    return input.stageBased
      ? scheduled < stageEligible
        ? scheduled
        : stageEligible
      : scheduled;
  }

  return input.stageBased ? stageEligible : input.totalCost;
}

export interface CollectionLimitResult {
  receivable: bigint;
  receivedBefore: bigint;
  attemptedCollection: bigint;
  receivedAfter: bigint;
  remainingBefore: bigint;
  exceedsEligible: boolean;
}

export function checkCollectionLimit(
  receivable: bigint,
  receivedBefore: bigint,
  attemptedCollection: bigint,
): CollectionLimitResult {
  const receivedAfter = receivedBefore + attemptedCollection;
  return {
    receivable,
    receivedBefore,
    attemptedCollection,
    receivedAfter,
    remainingBefore:
      receivable > receivedBefore ? receivable - receivedBefore : 0n,
    exceedsEligible: receivedAfter > receivable,
  };
}
