// Optional staging-only verification of durable postbacks.
// A Meta-confirmed follow unlocks a session, but this worker never sends DMs.
import { validateStagingMongoConfig } from "./staging-mongodb.js";
import { verifyStagingFollowPostback } from "./staging-follow-verifier.js";

export async function processStagingFollowPostbacks({
  env, MongoClient, fetchImpl, limit = 5, verify = verifyStagingFollowPostback
}) {
  if (env?.ENABLE_STAGING_FOLLOW_POSTBACK_PROCESSOR !== "true") return { skipped: "disabled" };
  const { uri, dbName } = validateStagingMongoConfig(env);
  if (env?.ENABLE_STAGING_FOLLOW_VERIFICATION !== "true") throw new Error("FOLLOW_VERIFICATION_DISABLED");
  if (typeof MongoClient !== "function" || typeof fetchImpl !== "function") throw new TypeError("DEPENDENCIES_REQUIRED");
  if (!Number.isInteger(limit) || limit < 1 || limit > 10) throw new RangeError("INVALID_LIMIT");
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 1 });
  const summary = { inspected: 0, verified: 0, held: 0, instagramMessagesSent: 0 };
  try {
    await client.connect();
    const inbox = client.db(dbName).collection("cloudflare_staging_webhook_inbox");
    for (let i = 0; i < limit; i++) {
      // Claim before calling Meta; competing cron invocations cannot process twice.
      const claimed = await inbox.findOneAndUpdate(
        { kind: "postback", status: "pending" },
        { $set: { status: "verifying", verificationStartedAt: new Date() } },
        { sort: { receivedAt: 1, _id: 1 }, returnDocument: "after" }
      );
      const row = claimed?.value ?? claimed;
      if (!row?._id) break;
      summary.inspected++;
      let result;
      try {
        result = await verify({ env, MongoClient, postback: row.event, fetchImpl });
      } catch {
        result = { unlocked: false, reason: "VERIFICATION_UNAVAILABLE" };
      }
      const verified = result?.unlocked === true;
      await inbox.updateOne({ _id: row._id, status: "verifying" }, { $set: {
        status: verified ? "verified" : "needs_review",
        outcome: verified ? "FOLLOW_VERIFIED" : "FOLLOW_VERIFICATION_REQUIRED",
        verifiedAt: verified ? new Date() : null, updatedAt: new Date()
      } });
      if (verified) summary.verified++;
      else summary.held++;
    }
    return summary;
  } finally { await client.close(); }
}
