import { ObjectId } from "mongodb";
import { validateStagingMongoConfig } from "./staging-mongodb.js";
const id = value => typeof value === "string" && /^[a-f0-9]{24}$/i.test(value);
const clean = (input, create = false) => {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("INVALID_CAMPAIGN");
  const fields = {};
  if ("name" in input || create) {
    if (typeof input.name !== "string" || !input.name.trim() || input.name.length > 120) throw new Error("INVALID_NAME");
    fields.name = input.name.trim();
  }
  if ("triggerType" in input) {
    if (!["any-post", "specific-post", "next-post"].includes(input.triggerType)) throw new Error("INVALID_TRIGGER_TYPE");
    fields.triggerType = input.triggerType;
  }
  if ("status" in input) {
    if (!["draft", "active", "paused", "completed"].includes(input.status)) throw new Error("INVALID_STATUS");
    fields.status = input.status;
  }
  for (const key of ["instagramMediaId", "instagramMediaUrl", "instagramAccountId"]) {
    if (key in input) {
      if (typeof input[key] !== "string" || input[key].length > 2048) throw new Error("INVALID_" + key);
      fields[key] = input[key];
    }
  }
  if ("postIds" in input) {
    if (!Array.isArray(input.postIds) || input.postIds.length > 100 || input.postIds.some(x => typeof x !== "string" || !/^\d{5,40}$/.test(x))) throw new Error("INVALID_POST_IDS");
    fields.postIds = [...new Set(input.postIds)];
  }
  if ("ruleIds" in input) {
    if (!Array.isArray(input.ruleIds) || input.ruleIds.length > 100 || !input.ruleIds.every(id)) throw new Error("INVALID_RULE_IDS");
    fields.ruleIds = input.ruleIds.map(x => new ObjectId(x));
  }
  return fields;
};
export async function nativeStagingCampaigns({ env, MongoClient, authenticatedUserId, method, campaignId, action, input }) {
  if (!id(authenticatedUserId)) return { status: 401, body: { message: "Unauthorized" } };
  if (campaignId && !id(campaignId)) return { status: 400, body: { message: "Invalid campaign ID" } };
  const { uri, dbName } = validateStagingMongoConfig(env);
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 1 });
  try {
    await client.connect();
    const db = client.db(dbName);
    const collection = db.collection("campaigns");
    const userId = new ObjectId(authenticatedUserId);
    const filter = { _id: new ObjectId(campaignId || "000000000000000000000000"), userId };
    if (method === "GET" && !campaignId) {
      const docs = await collection.find({ userId }).sort({ createdAt: -1 }).limit(100).toArray();
      return { status: 200, body: { success: true, data: docs } };
    }
    if (method === "GET" && campaignId) {
      const doc = await collection.findOne(filter);
      return doc ? { status: 200, body: { success: true, data: doc } } : { status: 404, body: { message: "Not found" } };
    }
    if (method === "DELETE" && campaignId) {
      const result = await collection.deleteOne(filter);
      return { status: result.deletedCount ? 200 : 404, body: { message: result.deletedCount ? "Deleted successfully" : "Not found" } };
    }
    if (!["POST", "PUT", "PATCH"].includes(method)) return { status: 405, body: { message: "Method not allowed" } };
    let fields;
    try { fields = action === "rules" ? clean({ ruleIds: input?.ruleIds }) : clean(input, method === "POST"); }
    catch (error) { return { status: 400, body: { message: error.message } }; }
    if (fields.ruleIds?.length) {
      const count = await db.collection("rules").countDocuments({ _id: { $in: fields.ruleIds }, userId });
      if (count !== fields.ruleIds.length) return { status: 400, body: { message: "Unknown or unowned rule" } };
    }
    const now = new Date();
    if (method === "POST" && !campaignId) {
      const doc = { ...fields, userId, status: fields.status || "draft", triggerType: fields.triggerType || "any-post",
        postIds: fields.postIds || [], ruleIds: fields.ruleIds || [], metrics: { commentsProcessed: 0, repliesSent: 0, dmsSent: 0, errors: 0 },
        createdAt: now, updatedAt: now };
      const result = await collection.insertOne(doc);
      return { status: 201, body: { success: true, data: { ...doc, _id: result.insertedId } } };
    }
    if (!campaignId) return { status: 400, body: { message: "Campaign ID required" } };
    const result = await collection.findOneAndUpdate(filter, { $set: { ...fields, updatedAt: now } }, { returnDocument: "after" });
    return result ? { status: 200, body: { success: true, data: result } } : { status: 404, body: { message: "Not found" } };
  } finally { await client.close(); }
}
