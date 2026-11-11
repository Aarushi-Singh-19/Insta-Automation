import { ObjectId } from "mongodb";
import { validateStagingMongoConfig } from "./staging-mongodb.js";

function validateRule(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("INVALID_RULE");
  const fields = ["ruleName", "postId", "priority", "triggerType", "triggerKeywords", "replyMode", "replies", "isActive"];
  if (Object.keys(input).some(key => !fields.includes(key))) throw new Error("INVALID_RULE_FIELD");
  const data = {};
  for (const key of fields) if (Object.hasOwn(input, key)) data[key] = input[key];
  if (data.ruleName !== undefined && (typeof data.ruleName !== "string" || data.ruleName.length > 200)) throw new Error("INVALID_RULE");
  if (data.postId !== undefined && (typeof data.postId !== "string" || data.postId.length > 100)) throw new Error("INVALID_RULE");
  if (data.priority !== undefined && (!Number.isInteger(data.priority) || data.priority < 0 || data.priority > 1000)) throw new Error("INVALID_RULE");
  if (data.triggerType !== undefined && !["keyword", "any_comment"].includes(data.triggerType)) throw new Error("INVALID_RULE");
  if (data.replyMode !== undefined && (typeof data.replyMode !== "string" || data.replyMode.length > 50)) throw new Error("INVALID_RULE");
  if (data.isActive !== undefined && typeof data.isActive !== "boolean") throw new Error("INVALID_RULE");
  for (const key of ["triggerKeywords", "replies"]) {
    if (data[key] !== undefined && (!Array.isArray(data[key]) || data[key].length > 50 ||
        data[key].some(value => typeof value !== "string" || value.length > 2000))) throw new Error("INVALID_RULE");
  }
  return data;
}

export async function createStagingRule({ env, MongoClient, authenticatedUserId, input }) {
  const { uri, dbName } = validateStagingMongoConfig(env);
  if (typeof authenticatedUserId !== "string" || !/^[a-f0-9]{24}$/i.test(authenticatedUserId)) throw new Error("AUTHENTICATED_USER_REQUIRED");
  const fields = validateRule(input);
  const now = new Date();
  const document = {
    ruleName: "", priority: 1, triggerType: "keyword", triggerKeywords: [],
    replyMode: "single", replies: [], isActive: true,
    ...fields, userId: new ObjectId(authenticatedUserId), createdAt: now, updatedAt: now
  };
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 1 });
  try {
    await client.connect();
    const db = client.db(dbName);
    const user = await db.collection("users").findOne(
      { _id: new ObjectId(authenticatedUserId) },
      { projection: { subscriptionStatus: 1, trialEndDate: 1, planEndDate: 1 } }
    );
    if (!user) return { status: 401, body: { message: "User not found" } };
    const allowed = (user.subscriptionStatus === "trial" && user.trialEndDate && new Date(user.trialEndDate) > now) ||
      (["active", "cancelled"].includes(user.subscriptionStatus) && user.planEndDate && new Date(user.planEndDate) > now);
    if (!allowed) return { status: 403, body: { message: "Active subscription required" } };
    const result = await db.collection("rules").insertOne(document);
    return { status: 201, body: { success: true, data: { ...document, _id: result.insertedId } } };
  } finally { await client.close(); }
}
