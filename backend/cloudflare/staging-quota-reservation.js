// Staging-only atomic DM quota reservations. No Graph API calls.
// Requires a unique _id per user + billing period and one reservation per action.
// Transaction support requires an Atlas replica set; callers must not send a DM
// until the transaction commits and the reservation is returned.
import { ObjectId } from "mongodb";
import { validateStagingMongoConfig } from "./staging-mongodb.js";

export async function reserveStagingDmQuota({ env, MongoClient, userId, actionId, periodStart, periodEnd, limit }) {
  const { uri, dbName } = validateStagingMongoConfig(env);
  if (typeof MongoClient !== "function") throw new TypeError("MongoClient required");
  if (typeof userId !== "string" || !/^[0-9a-f]{24}$/i.test(userId)) throw new TypeError("INVALID_USER");
  if (typeof actionId !== "string" || !/^[a-zA-Z0-9:_-]{1,160}$/.test(actionId)) throw new TypeError("INVALID_ACTION");
  if (![500, 10000].includes(limit)) throw new TypeError("INVALID_LIMIT");
  const start = new Date(periodStart), end = new Date(periodEnd);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start >= end) throw new TypeError("INVALID_PERIOD");
  const now = new Date();
  if (now < start || now >= end) return { reserved: false, reason: "OUTSIDE_PERIOD" };
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 1, retryWrites: true });
  const session = client.startSession();
  const reservationId = userId.toLowerCase() + ":" + actionId;
  const bucketId = userId.toLowerCase() + ":" + start.toISOString() + ":" + end.toISOString();
  try {
    await client.connect();
    const db = client.db(dbName);
    let result;
    await session.withTransaction(async () => {
      const reservations = db.collection("cloudflare_staging_dm_reservations");
      const buckets = db.collection("cloudflare_staging_dm_quota");
      const existing = await reservations.findOne({ _id: reservationId }, { session });
      if (existing) {
        result = existing.bucketId === bucketId
          ? { reserved: true, duplicate: true, reservationId }
          : { reserved: false, reason: "ACTION_ALREADY_RESERVED_OTHER_PERIOD" };
        return;
      }
      // Initialize bucket without resetting any existing counter.
      await buckets.updateOne({ _id: bucketId }, { $setOnInsert: {
        userId: new ObjectId(userId), periodStart: start, periodEnd: end, limit, used: 0
      } }, { upsert: true, session });
      const updated = await buckets.findOneAndUpdate(
        { _id: bucketId, limit, used: { $lt: limit } },
        { $inc: { used: 1 } },
        { session, returnDocument: "after" }
      );
      const bucket = updated?.value ?? updated;
      if (!bucket?._id) {
        result = { reserved: false, reason: "QUOTA_EXHAUSTED_OR_PERIOD_MISMATCH" };
        return;
      }
      await reservations.insertOne({
        _id: reservationId, userId: new ObjectId(userId), actionId,
        bucketId, status: "reserved", createdAt: now
      }, { session });
      result = { reserved: true, duplicate: false, reservationId };
    });
    return result;
  } finally {
    await session.endSession();
    await client.close();
  }
}
