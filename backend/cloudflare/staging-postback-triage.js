// Durable Follow Gate postbacks must not be treated as verified follows.
// Triage only; no Graph requests, unlocks, or DM sends.
import { validateStagingMongoConfig } from "./staging-mongodb.js";

export async function triageStagingPostbacks({ env, MongoClient, limit = 10 }) {
  if (env?.ENABLE_STAGING_POSTBACK_TRIAGE !== "true") return { skipped: "disabled" };
  const { uri, dbName } = validateStagingMongoConfig(env);
  if (typeof MongoClient !== "function") throw new TypeError("MONGO_CLIENT_REQUIRED");
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new RangeError("INVALID_LIMIT");
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 1 });
  try {
    await client.connect();
    const inbox = client.db(dbName).collection("cloudflare_staging_webhook_inbox");
    let reviewed = 0;
    for (let i = 0; i < limit; i++) {
      const claim = await inbox.findOneAndUpdate(
        { kind: "postback", status: "pending" },
        { $set: { status: "needs_review", outcome: "FOLLOW_VERIFICATION_REQUIRED", updatedAt: new Date() } },
        { sort: { receivedAt: 1, _id: 1 }, returnDocument: "after" }
      );
      if (!(claim?.value ?? claim)?._id) break;
      reviewed++;
    }
    return { reviewed, verified: 0, instagramMessagesSent: 0 };
  } finally {
    await client.close();
  }
}
