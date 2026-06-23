/**
 * Milli-cent accumulator math for v2 State Credits.
 *
 * Legacy (V1) per-snapshot pricing rounds every snapshot up to 1¢, which makes
 * high-frequency 4 KB agent snapshots economically nonsensical. v2 keeps
 * `users.credits` as cents on the wire, but accumulates owed cost in
 * `users.credits_milli` (BIGINT). Whole cents are spilled into the cents
 * column only when the milli accumulator crosses 1000.
 *
 * Both client (SDK preview) and server (Edge Function debit) consume this
 * same module so the cost preview matches the on-the-wire deduction.
 */

/** Milli-cents per byte. */
export const RATE_PER_BYTE_MILLI = 0.045;

/** v2 prepay floor — 50¢ vs the legacy $20 minimum. */
export const MIN_DEPOSIT_CENTS_V2 = 50;

/** Hard cap on ciphertext bytes per snapshot. */
export const MAX_PAYLOAD_BYTES = 262_144;

/** Milli-cents per cent — the rollover boundary. */
export const MILLI_PER_CENT = 1000;

export function priceSnapshotMilli(byteLength: number): number {
  if (!Number.isFinite(byteLength) || byteLength < 0) {
    throw new RangeError("byteLength must be a non-negative finite number");
  }
  if (byteLength === 0) return 0;
  return Math.ceil(byteLength * RATE_PER_BYTE_MILLI);
}

export interface DebitDelta {
  /** New milli-cent balance (post-rollover). Always in [0, 999]. */
  newMilli: number;
  /** Whole cents to subtract from `users.credits` (always ≥ 0). */
  centsToBurn: number;
}

export interface RefundDelta {
  /** New milli-cent balance after refund. Always in [0, 999]. */
  newMilli: number;
  /** Whole cents to add back to `users.credits`. */
  centsToReturn: number;
}

/**
 * Apply an owed milli-cent debit to a user's accumulator.
 * Returns the new accumulator value and how many whole cents must be
 * deducted from `users.credits` as a side effect.
 *
 * Both inputs and outputs are non-negative integers.
 */
export function applyMilliDebit(
  currentMilli: number,
  owedMilli: number
): DebitDelta {
  assertNonNegInt("currentMilli", currentMilli);
  assertNonNegInt("owedMilli", owedMilli);
  const total = currentMilli + owedMilli;
  const centsToBurn = Math.floor(total / MILLI_PER_CENT);
  const newMilli = total - centsToBurn * MILLI_PER_CENT;
  return { newMilli, centsToBurn };
}

/**
 * Inverse of `applyMilliDebit`. Used when a snapshot fails after the
 * debit has been recorded (e.g. Irys upload failure).
 *
 * If the refund exceeds what's currently in the milli accumulator, the
 * difference is returned as whole cents to credit back to `users.credits`.
 */
export function applyMilliRefund(
  currentMilli: number,
  refundMilli: number
): RefundDelta {
  assertNonNegInt("currentMilli", currentMilli);
  assertNonNegInt("refundMilli", refundMilli);
  if (refundMilli <= currentMilli) {
    return { newMilli: currentMilli - refundMilli, centsToReturn: 0 };
  }
  const deficit = refundMilli - currentMilli;
  const centsToReturn = Math.ceil(deficit / MILLI_PER_CENT);
  const newMilli = centsToReturn * MILLI_PER_CENT - deficit;
  return { newMilli, centsToReturn };
}

function assertNonNegInt(name: string, n: number): void {
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
    throw new RangeError(`${name} must be a non-negative integer (got ${n})`);
  }
}
