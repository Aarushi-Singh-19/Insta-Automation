// A Cloudflare-only counter cannot prove how many DMs Render already sent.
// Fail closed until an independently verified baseline has been persisted.
export function verifiedQuotaState(counter, period, userId) {
  if (!counter || !period || !userId) return null;
  if (counter.baselineVerified !== true || counter.baselineSource !== "render-reconciliation") return null;
  if (String(counter.userId) !== String(userId) || counter.period !== period.period ||
      counter.limit !== period.limit) return null;
  const baseline = counter.baselineSent;
  const reserved = counter.reserved;
  if (![baseline, reserved].every(n => Number.isSafeInteger(n) && n >= 0)) return null;
  if (baseline + reserved > period.limit) return null;
  return { sent: baseline + reserved, remaining: period.limit - baseline - reserved };
}
