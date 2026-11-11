import { ObjectId } from "mongodb";
import { validateStagingMongoConfig } from "./staging-mongodb.js";

// Native, read-only staging equivalent of Express GET /api/rules.
// Never expose arbitrary user records or credentials.
export async function listStagingRules({ env, MongoClient, authenticatedUserId }) {
  const { uri, dbName } = validateStagingMongoConfig(env);
  if (typeof authenticatedUserId !== "string" || !/^[a-f0-9]{24}$/i.test(authenticatedUserId)) {
    throw new TypeError("AUTHENTICATED_USER_REQUIRED");
  }
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 1 });
  try {
    await client.connect();
    const rows = await client.db(dbName).collection("rules")
      .find({ userId: new ObjectId(authenticatedUserId) })
      .project({ accessToken: 0, password: 0 })
      .sort({ priority: -1 }).limit(200).toArray();
    return rows.map(row => ({ ...row, _id: String(row._id), userId: String(row.userId) }));
  } finally {
    await client.close();
  }
}
