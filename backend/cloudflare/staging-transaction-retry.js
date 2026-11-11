// Transaction retry policy for staging quota reservations.
// Only retry errors MongoDB explicitly marks as transient; never retry an
// ambiguous commit with a new action key. Caller must reuse identical inputs.
export function isRetryableTransactionError(error) {
  return Boolean(error?.hasErrorLabel?.("TransientTransactionError"));
}
export async function withStagingTransactionRetry(operation, { maxAttempts = 3 } = {}) {
  if (typeof operation !== "function") throw new TypeError("OPERATION_REQUIRED");
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 5) throw new RangeError("INVALID_ATTEMPTS");
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try { return await operation(attempt); }
    catch (error) {
      lastError = error;
      if (!isRetryableTransactionError(error) || attempt === maxAttempts) throw error;
    }
  }
  throw lastError;
}
