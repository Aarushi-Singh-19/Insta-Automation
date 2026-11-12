import { ObjectId } from "mongodb";
import { validateStagingMongoConfig } from "./staging-mongodb.js";

// Read-only staging account listing. Never return Meta access tokens.
export async function listStagingInstagramAccounts({ env, MongoClient, authenticatedUserId }) {
  if (typeof authenticatedUserId !== "string" || !/^[a-f0-9]{24}$/i.test(authenticatedUserId)) {
    throw new TypeError("AUTHENTICATED_USER_REQUIRED");
  }
  const { uri, dbName } = validateStagingMongoConfig(env);
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 1 });
  try {
    await client.connect();
    const accounts = await client.db(dbName).collection("instagramaccounts")
      .find({ userId: new ObjectId(authenticatedUserId) })
      .project({ username: 1, status: 1, connectedAt: 1, lastSyncedAt: 1 })
      .limit(20).toArray();
    return accounts.map(a => ({ ...a, _id: String(a._id) }));
  } finally {
    await client.close();
  }
}
