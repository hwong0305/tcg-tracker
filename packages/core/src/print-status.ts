import type { PrintStatusInput, PrintStatusResult } from "./types";

export function computePrintStatus(input: PrintStatusInput): PrintStatusResult {
  const today = new Date(`${input.todayUtc}T00:00:00.000Z`);
  const release = new Date(`${input.releaseDate}T00:00:00.000Z`);
  const ageCutoff = new Date(today);
  ageCutoff.setUTCMonth(ageCutoff.getUTCMonth() - 24);

  const ageRule = release <= ageCutoff;
  const priceRule = input.currentBoxPrice != null ? input.currentBoxPrice > 196 : false;

  if (ageRule || priceRule) {
    return { isOutOfPrint: true, reason: ageRule ? "age" : "price" };
  }

  if (input.currentBoxPrice == null) {
    return {
      isOutOfPrint: input.previousIsOutOfPrint ?? false,
      reason: "preserve-on-null-price"
    };
  }

  if (input.currentBoxPrice < 168) {
    return { isOutOfPrint: false, reason: "recent-and-sub-20-percent" };
  }

  return { isOutOfPrint: false, reason: "default-in-print" };
}
