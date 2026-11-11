// Run locally with MONGODB_STAGING_URI set to the isolated staging database.
// Usage: node staging-fixture-smoke.mjs
// Creates namespaced test documents, verifies planning, then removes only those IDs.
import assert from "node:assert/strict";
import { MongoClient, ObjectId } from "mongodb";
import { validateStagingMongoConfig } from "./staging-mongodb.js";
import { resolveStagingComment } from "./staging-comment-resolver.js";
import { planCommentAutomation } from "./comment-planner.js";

const env = {
  MONGODB_STAGING_DB: "triggerdm_staging",
  MONGODB_STAGING_URI: process.env.MONGODB_STAGING_URI
};
const { uri, dbName } = validateStagingMongoConfig(env);
const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 1 });
const userId = new ObjectId(), accountId = new ObjectId(), campaignId = new ObjectId(), ruleId = new ObjectId();
const suffix = String(BigInt("0x" + userId.toHexString()));
const entryId = suffix, postId = String(BigInt("0x" + campaignId.toHexString()));
const comment = { entryId, postId, eventId: "1", commentText: "send TEST link" };
let connected = false;
try {
  await client.connect();
  connected = true;
  const db = client.db(dbName);
  const accounts = db.collection("instagramaccounts"), campaigns = db.collection("campaigns"), rules = db.collection("rules");
  await accounts.insertOne({ _id: accountId, userId, instagramBusinessId: entryId, status: "active", username: "cloudflare_staging_fixture" });
  await rules.insertOne({ _id: ruleId, userId, isActive: true, triggerType: "keyword", triggerKeywords: ["test"] });
  await campaigns.insertOne({ _id: campaignId, userId, instagramAccountId: entryId, name: "cloudflare_staging_fixture",
    status: "active", triggerType: "specific-post", instagramMediaId: postId, postIds: [postId], ruleIds: [ruleId] });
  const resolution = await resolveStagingComment({ db, comment });
  assert.ok(resolution, "No matching campaign/rule");
  const decision = planCommentAutomation({ comment, ...resolution });
  assert.equal(decision.matched, true);
  assert.equal(decision.plan.actionsNotAuthorized, true);
  assert.equal(decision.plan.ruleId, String(ruleId));
  console.log("PASS: staging MongoDB -> owned account -> campaign -> rule -> unauthorized plan");
} finally {
  if (connected) {
    const db = client.db(dbName);
    // Only delete exact generated fixture IDs. No bulk deletion or production access.
    try { await db.collection("campaigns").deleteOne({ _id: campaignId, userId }); }
    finally {
      try { await db.collection("rules").deleteOne({ _id: ruleId, userId }); }
      finally { await db.collection("instagramaccounts").deleteOne({ _id: accountId, userId }); }
    }
  }
  await client.close();
}
