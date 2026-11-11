// MongoDB-backed adapter for the isolated Cloudflare action executor.
// Models must be supplied by a separately initialized, Worker-compatible DB layer.
// This file never opens a connection or touches production on import.
export function createMongoActionDependencies({ User, ActionLog, InstagramAccount, actionService, hasSubscriptionAccess }) {
  if (![User, ActionLog, InstagramAccount].every(Boolean) ||
      typeof actionService?.execute !== "function" || typeof hasSubscriptionAccess !== "function") {
    throw new TypeError("Mongo action adapter dependencies missing");
  }
  return {
    async getSubscriptionAccess(userId) {
      const user = await User.findById(userId);
      return { user, hasAccess: hasSubscriptionAccess(user) };
    },
    async claimAction(key, data) {
      // A unique index on (eventId, actionType) is REQUIRED. Never reset a
      // processing/success record to queued, which could resend an Instagram DM.
      const now = new Date();
      // Failed/processing records are not automatically reclaimed: an upstream
      // Graph API call may have succeeded before its result was persisted.
      try {
        const result = await ActionLog.findOneAndUpdate(
          { ...key, status: "queued" },
          { $set: { status: "processing", updatedAt: now },
            $setOnInsert: { ...key, campaignId: data.campaignId, ruleId: String(data.ruleId),
              userId: String(data.userId), metricsUpdated: false, createdAt: now } },
          { upsert: true, returnDocument: "after" }
        );
        return result?.status === "processing" ? { state: "claimed" } : { state: "unknown" };
      } catch (error) {
        if (error?.code !== 11000) throw error;
        const existing = await ActionLog.findOne(key);
        if (existing?.status === "success") return { state: "success" };
        if (existing?.status === "failed") return { state: "ambiguous" };
        // Processing claims are never stolen without a carefully designed lease.
        return { state: "busy" };
      }
    },
    getInstagramAccount(userId) {
      return InstagramAccount.findOne({ userId, status: "active" });
    },
    executeAction(action, context) {
      return actionService.execute(action, context);
    },
    async markSuccess(key, { skippedSelfComment } = {}) {
      const result = await ActionLog.updateOne(
        { ...key, status: "processing" },
        { $set: { status: "success", updatedAt: new Date(),
          ...(skippedSelfComment ? { error: "Skipped self-authored comment" } : {}) } }
      );
      return result?.matchedCount === 1;
    },
    async markFailure(key, error) {
      await ActionLog.updateOne(
        { ...key, status: "processing" },
        { $set: { status: "failed", error: String(error?.message || error), updatedAt: new Date() } }
      );
    },
  };
}
