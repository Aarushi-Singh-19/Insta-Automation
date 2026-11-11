// Read-only staging campaign API. This is a migration component, not a live route.
// Authentication must be verified before calling. Never trust a userId from query params.
import { ObjectId } from "mongodb";
import { validateStagingMongoConfig } from "./staging-mongodb.js";

export async function listOwnCampaigns({ env, MongoClient, authenticatedUserId, limit = 20 }) {
  const { uri, dbName } = validateStagingMongoConfig(env);
  if (typeof MongoClient !== "function") throw new TypeError("MongoClient required");
  if (!ObjectId.isValid(authenticatedUserId) || String(new ObjectId(authenticatedUserId)) !== authenticatedUserId.toLowerCase()) {
    throw new TypeError("AUTHENTICATED_USER_REQUIRED");
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new RangeError("INVALID_PAGE_LIMIT");
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 1 });
  try {
    await client.connect();
    const rows = await client.db(dbName).collection("campaigns")
      .find({ userId: new ObjectId(authenticatedUserId) })
      .project({ _id: 1, triggerType: 1, status: 1, instagramMediaId: 1, createdAt: 1, updatedAt: 1 })
      .sort({ createdAt: -1, _id: -1 }).limit(limit).toArray();
    return rows.map(c => ({
      id: String(c._id), triggerType: c.triggerType || null,
      status: c.status || null, instagramMediaId: c.instagramMediaId || null,
      createdAt: c.createdAt?.toISOString?.() || null,
      updatedAt: c.updatedAt?.toISOString?.() || null,
    }));
  } finally {
    await client.close();
  }
}
