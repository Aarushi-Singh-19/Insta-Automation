import { ObjectId } from "mongodb";
import { validateStagingMongoConfig } from "./staging-mongodb.js";

export async function deleteStagingRule({ env, MongoClient, authenticatedUserId, ruleId }) {
  const { uri, dbName } = validateStagingMongoConfig(env);
  if (typeof authenticatedUserId !== "string" || !/^[a-f0-9]{24}$/i.test(authenticatedUserId)) throw new Error("AUTHENTICATED_USER_REQUIRED");
  if (typeof ruleId !== "string" || !/^[a-f0-9]{24}$/i.test(ruleId)) return { status: 400, body: { message: "Invalid rule ID" } };
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 1 });
  try {
    await client.connect();
    const result = await client.db(dbName).collection("rules").findOneAndDelete({
      _id: new ObjectId(ruleId), userId: new ObjectId(authenticatedUserId)
    });
    return result
      ? { status: 200, body: { message: "Deleted successfully" } }
      : { status: 404, body: { message: "Rule not found" } };
  } finally { await client.close(); }
}
