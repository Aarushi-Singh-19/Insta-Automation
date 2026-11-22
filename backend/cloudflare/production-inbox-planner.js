import { ObjectId } from "mongodb";
import { validateProductionMongoConfig } from "./production-mongodb.js";
import { planCommentAutomation } from "./comment-planner.js";
const oid = v => /^[a-f0-9]{24}$/i.test(String(v || "")) ? new ObjectId(String(v)) : null;

// Resolve only a uniquely owned account/campaign; preserve rule ordering.
export async function resolveProductionComment({ db, item, claimNextPost = false }) {
  const e = item?.event, owner = oid(item?.userId);
  if (!owner || !/^\d+$/.test(String(e?.entryId || "")) ||
      !/^\d+$/.test(String(e?.postId || ""))) return null;
  const accounts = await db.collection("instagramaccounts").find({
    instagramBusinessId: String(e.entryId), userId: owner, status: "active"
  }).limit(2).toArray();
  if (accounts.length !== 1) return null;
  const account = accounts[0];
  const ownUsername = String(account.username || "").replace(/^@/, "").trim().toLowerCase();
  if (ownUsername && ownUsername === String(e.username || "").replace(/^@/, "").trim().toLowerCase()) return null;
  const campaigns = db.collection("campaigns");
  const postId = String(e.postId);
  const scope = {
    userId: owner, status: "active",
    $or: [{ instagramAccountId: String(e.entryId) }, { instagramAccountId: "" },
      { instagramAccountId: null }, { instagramAccountId: { $exists: false } }],
  };
  const sort = { createdAt: -1, _id: -1 };
  const findMatched = () => campaigns.find({ ...scope,
    $and: [{ $or: [{ triggerType: "any-post" },
      { triggerType: "specific-post", instagramMediaId: postId },
      { triggerType: "specific-post", postIds: postId }] }],
  }).sort(sort).limit(1).toArray();
  let [campaign] = await findMatched();
  if (!campaign && claimNextPost) {
    campaign = await campaigns.findOneAndUpdate({ ...scope, triggerType: "next-post",
      $and: [{ $or: [{ postIds: { $exists: false } }, { postIds: { $size: 0 } }] }],
    }, { $set: { triggerType: "specific-post", instagramMediaId: postId, postIds: [postId], updatedAt: new Date() } },
    { sort, returnDocument: "after" });
    if (!campaign) [campaign] = await findMatched();
  }
  if (!Array.isArray(campaign?.ruleIds)) return null;
  const ids = campaign.ruleIds.map(oid);
  if (!ids.length || ids.some(x => !x)) return null;
  const rules = await db.collection("rules").find({
    _id: { $in: ids }, userId: owner, isActive: true
  }).toArray();
  const byId = new Map(rules.map(rule => [String(rule._id), rule]));
  const text = String(e.commentText || "").toLowerCase();
  for (const id of ids) {
    const rule = byId.get(String(id));
    if (!rule) continue;
    const keywords = Array.isArray(rule.triggerKeywords) ? rule.triggerKeywords : rule.keywords;
    if (rule.triggerType === "any_comment" ||
        (rule.triggerType === "keyword" && Array.isArray(keywords) &&
         keywords.some(k => typeof k === "string" && k.trim() && text.includes(k.trim().toLowerCase()))))
      return { campaign, rule };
  }
  return null;
}

// Planning writes durable, unauthorized records only. No Meta calls or sends.
export async function planProductionInbox({ env, MongoClient, limit = 10, claimNextPost = false }) {
  const { uri, dbName } = validateProductionMongoConfig(env);
  if (env?.ENABLE_PRODUCTION_PLANNER !== "true") throw new Error("PRODUCTION_PLANNER_DISABLED");
  if (!Number.isInteger(limit) || limit < 1 || limit > 25) throw new Error("INVALID_LIMIT");
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 1 });
  const summary = { inspected: 0, planned: 0, ignored: 0, needsReview: 0, sent: 0 };
  try {
    await client.connect();
    const db = client.db(dbName);
    const inbox = db.collection("cloudflare_production_webhook_inbox");
    const plans = db.collection("cloudflare_production_action_plans");
    for (let i = 0; i < limit; i++) {
      const claimed = await inbox.findOneAndUpdate(
        { kind: "comment", status: "pending" },
        { $set: { status: "planning", planningStartedAt: new Date() } },
        { sort: { receivedAt: 1, _id: 1 }, returnDocument: "after" });
      const item = claimed?.value ?? claimed;
      if (!item?._id) break;
      summary.inspected++;
      try {
        const resolved = await resolveProductionComment({ db, item, claimNextPost });
        const decision = planCommentAutomation({
          comment: item.event, campaign: resolved?.campaign, rule: resolved?.rule
        });
        if (decision.matched) {
          await plans.updateOne({ _id: item._id }, { $setOnInsert: {
            _id: item._id, userId: item.userId, accountId: item.accountId,
            plan: decision.plan, status: "awaiting_authorization",
            authorized: false, createdAt: new Date(), receivedAt: item.receivedAt ?? null
          } }, { upsert: true });
        }
        const status = decision.matched ? "planned" : "ignored";
        const updated = await inbox.updateOne({ _id: item._id, status: "planning" },
          { $set: { status, outcome: decision.matched ? "REQUIRES_AUTHORIZATION" : decision.reason,
            updatedAt: new Date() } });
        if (updated.matchedCount !== 1) throw new Error("INBOX_STATE_CONFLICT");
        summary[status]++;
      } catch {
        await inbox.updateOne({ _id: item._id, status: "planning" },
          { $set: { status: "needs_review", outcome: "PLANNING_FAILED", updatedAt: new Date() } });
        summary.needsReview++;
      }
    }
    return summary;
  } finally { await client.close(); }
}
