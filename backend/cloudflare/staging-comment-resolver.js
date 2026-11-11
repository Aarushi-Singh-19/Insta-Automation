// Read-only staging campaign/rule resolver. Ambiguous ownership or rule
// relationships fail closed; this never reads production or sends messages.
import { ObjectId } from "mongodb";
export async function resolveStagingComment({ db, comment }) {
  if (!db || !comment || !/^\d+$/.test(String(comment.postId || "")) ||
      !/^\d+$/.test(String(comment.entryId || ""))) return null;
  // The webhook entry identifies the Instagram account, not a user-provided ID.
  const accounts = await db.collection("instagramaccounts")
    .find({ instagramId: String(comment.entryId) })
    .project({ _id: 1, userId: 1 }).limit(2).toArray();
  if (accounts.length !== 1 || !ObjectId.isValid(accounts[0].userId)) return null;
  const account = accounts[0];
  const campaigns = await db.collection("campaigns").find({
    userId: new ObjectId(String(account.userId)),
    status: "active",
    $or: [
      { instagramMediaId: String(comment.postId) },
      { postIds: String(comment.postId) }
    ]
  }).project({ _id: 1, userId: 1, ruleId: 1, status: 1, triggerType: 1, instagramMediaId: 1, postIds: 1 })
    .limit(2).toArray();
  // Never choose arbitrarily among multiple campaigns.
  if (campaigns.length !== 1 || !ObjectId.isValid(campaigns[0].ruleId)) return null;
  const campaign = campaigns[0];
  const rule = await db.collection("rules").findOne({
    _id: new ObjectId(String(campaign.ruleId)),
    userId: new ObjectId(String(account.userId)),
    isActive: true
  }, { projection: { _id: 1, userId: 1, isActive: 1, triggerType: 1, keywords: 1 } });
  return rule ? { campaign, rule } : null;
}
