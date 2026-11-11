// Read-only staging campaign/rule resolver. Ambiguous ownership or rule
// relationships fail closed; this never reads production or sends messages.
import { ObjectId } from "mongodb";
export async function resolveStagingComment({ db, comment }) {
  if (!db || !comment || !/^\d+$/.test(String(comment.postId || "")) ||
      !/^\d+$/.test(String(comment.entryId || ""))) return null;
  // The webhook entry identifies the Instagram account, not a user-provided ID.
  const accounts = await db.collection("instagramaccounts")
    .find({ instagramBusinessId: String(comment.entryId), status: "active" })
    .project({ _id: 1, userId: 1 }).limit(2).toArray();
  if (accounts.length !== 1 || !ObjectId.isValid(accounts[0].userId)) return null;
  const account = accounts[0];
  const campaigns = await db.collection("campaigns").find({
    userId: new ObjectId(String(account.userId)),
    status: "active",
    $or: [{ instagramAccountId: String(comment.entryId) }, { instagramAccountId: { $exists: false } }, { instagramAccountId: null }],
    $and: [{ $or: [
      { triggerType: "any-post" },
      { triggerType: "specific-post", instagramMediaId: String(comment.postId) },
      { triggerType: "specific-post", postIds: String(comment.postId) }
    ] }]
  }).project({ _id: 1, userId: 1, ruleIds: 1, status: 1, triggerType: 1, instagramMediaId: 1, postIds: 1 })
    .limit(2).toArray();
  // Never choose arbitrarily among multiple campaigns.
  if (campaigns.length !== 1 || !Array.isArray(campaigns[0].ruleIds) || campaigns[0].ruleIds.length < 1 || !campaigns[0].ruleIds.every(id => ObjectId.isValid(id))) return null;
  const campaign = campaigns[0];
  // Preserve the campaign ruleIds order. If multiple rules match, select the
  // first, as the existing Render rule engine does. Never select a non-owned rule.
  const ids = campaign.ruleIds.map(id => new ObjectId(String(id)));
  const rules = await db.collection("rules").find({
    _id: { $in: ids }, userId: new ObjectId(String(account.userId)), isActive: true
  }).project({ _id: 1, userId: 1, isActive: 1, triggerType: 1, triggerKeywords: 1, keywords: 1 }).toArray();
  const byId = new Map(rules.map(rule => [String(rule._id), rule]));
  const text = String(comment.commentText || "").toLowerCase().trim();
  for (const id of ids) {
    const rule = byId.get(String(id));
    if (!rule) continue;
    if (rule.triggerType === "any_comment") return { campaign, rule };
    const keywords = Array.isArray(rule.triggerKeywords) ? rule.triggerKeywords : rule.keywords;
    if (Array.isArray(keywords) && keywords.some(keyword => {
      const value = String(keyword || "").toLowerCase().trim();
      return value && text.includes(value);
    })) return { campaign, rule };
  }
  return null;
}
