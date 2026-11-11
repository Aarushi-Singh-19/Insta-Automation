import { ObjectId } from "mongodb";
import { validateStagingMongoConfig } from "./staging-mongodb.js";
import { validateRule } from "./staging-rule-create.js";

export async function updateStagingRule({ env, MongoClient, authenticatedUserId, ruleId, input }) {
  const { uri, dbName } = validateStagingMongoConfig(env);
  if (typeof authenticatedUserId !== "string" || !/^[a-f0-9]{24}$/i.test(authenticatedUserId)) throw new Error("AUTHENTICATED_USER_REQUIRED");
  if (typeof ruleId !== "string" || !/^[a-f0-9]{24}$/i.test(ruleId)) return { status: 400, body: { message: "Invalid rule ID" } };
  const fields = validateRule(input);
  if (Object.keys(fields).length === 0) return { status: 400, body: { message: "No rule fields provided" } };
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 1 });
  try {
    await client.connect();
    const updated = await client.db(dbName).collection("rules").findOneAndUpdate(
      { _id: new ObjectId(ruleId), userId: new ObjectId(authenticatedUserId) },
      { $set: { ...fields, updatedAt: new Date() } },
      { returnDocument: "after" }
    );
    return updated
      ? { status: 200, body: updated }
      : { status: 404, body: { message: "Rule not found" } };
  } finally { await client.close(); }
}
