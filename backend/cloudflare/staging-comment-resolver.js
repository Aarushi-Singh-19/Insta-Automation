// Read-only staging campaign/rule resolver. Ambiguous ownership or rule
// relationships fail closed; this never reads production or sends messages.
import { ObjectId } from "mongodb";
export async function resolveStagingComment({ db, comment }) {
  if (!db || !comment || !/^\d+$/.test(String(comment.postId || "")) ||
      !/^\d+$/.test(String(comment.entryId || ""))) return null;
  // The webhook entry identifies the Instagram account, not a user-provided ID.
  const accounts = await db.collection("instagramaccounts")
    .find({ instagramBusinessId: String(comment.entryId) })
    .project({ _id: 1, userId: 1 }).limit(2).toArray();
  if (accounts.length !== 1 || !ObjectId.isValid(accounts[0].userId)) return null;
  const account = accounts[0];
  const campaigns = await db.collection("campaigns").find({
    userId: new ObjectId(String(account.userId)),
    status: "active",
    instagramAccountId: String(comment.entryId),
    $or: [
      { triggerType: "any-post" },
      { triggerType: "specific-post", instagramMediaId: String(comment.postId) },
      { triggerType: "specific-post", postIds: String(comment.postId) }
    ]
  }).project({ _id: 1, userId: 1, ruleIds: 1, status: 1, triggerType: 1, instagramMediaId: 1, postIds: 1 })
    .limit(2).toArray();
  // Never choose arbitrarily among multiple campaigns.
  if (campaigns.length !== 1 || !Array.isArray(campaigns[0].ruleIds) || campaigns[0].ruleIds.length !== 1 || !ObjectId.isValid(campaigns[0].ruleIds[0])) return null;
  const campaign = campaigns[0];
  const rule = await db.collection("rules").findOne({
    _id: new ObjectId(String(campaign.ruleIds[0])),
    userId: new ObjectId(String(account.userId)),
    isActive: true
  }, { projection: { _id: 1, userId: 1, isActive: 1, triggerType: 1, triggerKeywords: 1 } });
  return rule ? { campaign, rule } : null;
}
