import { ObjectId } from "mongodb";
import { validateStagingMongoConfig } from "./staging-mongodb.js";

export async function toggleStagingRule({ env, MongoClient, authenticatedUserId, ruleId }) {
  const { uri, dbName } = validateStagingMongoConfig(env);
  if (typeof authenticatedUserId !== "string" || !/^[a-f0-9]{24}$/i.test(authenticatedUserId)) throw new Error("AUTHENTICATED_USER_REQUIRED");
  if (typeof ruleId !== "string" || !/^[a-f0-9]{24}$/i.test(ruleId)) return { status: 400, body: { message: "Invalid rule ID" } };
  const filter = { _id: new ObjectId(ruleId), userId: new ObjectId(authenticatedUserId) };
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 1 });
  try {
    await client.connect();
    const collection = client.db(dbName).collection("rules");
    // Atomic pipeline update prevents concurrent toggles from overwriting each other.
    const updated = await collection.findOneAndUpdate(filter, [
      { $set: { isActive: { $not: ["$isActive"] }, updatedAt: "$$NOW" } }
    ], { returnDocument: "after" });
    if (!updated) return { status: 404, body: { message: "Rule not found" } };
    return { status: 200, body: { success: true, data: updated } };
  } finally { await client.close(); }
}
