// Pure staging rule matcher. Planning only: no Graph API calls, queue sends,
// subscription checks or database mutations. Never execute a plan directly.
function normalized(text) { return String(text || "").trim().toLocaleLowerCase("en"); }
export function planCommentAutomation({ comment, campaign, rule }) {
  if (!comment?.eventId || !comment?.postId || !campaign || !rule) return { matched: false, reason: "MISSING_INPUT" };
  if (campaign.status !== "active" || rule.isActive !== true) return { matched: false, reason: "INACTIVE" };
  const trigger = campaign.triggerType || rule.triggerType;
  if (trigger === "specific-post") {
    const ids = Array.isArray(campaign.postIds) ? campaign.postIds.map(String) : [];
    if (campaign.instagramMediaId != null) ids.push(String(campaign.instagramMediaId));
    if (!ids.includes(String(comment.postId))) return { matched: false, reason: "WRONG_POST" };
  } else if (trigger !== "any-post") {
    return { matched: false, reason: "UNSUPPORTED_CAMPAIGN_TRIGGER" };
  }
  const rawKeywords = Array.isArray(rule.triggerKeywords) ? rule.triggerKeywords : rule.keywords;
  const keywords = Array.isArray(rawKeywords) ? rawKeywords.map(normalized).filter(Boolean) : [];
  const mode = rule.triggerType || "keyword";
  if (mode === "keyword") {
    if (!keywords.length || !keywords.some(word => normalized(comment.commentText).includes(word))) {
      return { matched: false, reason: "KEYWORD_MISMATCH" };
    }
  } else if (mode !== "any_comment") return { matched: false, reason: "UNSUPPORTED_RULE_TRIGGER" };
  // Plan contains identifiers only; sensitive tokens never leave storage.
  return { matched: true, plan: {
    eventId: String(comment.eventId), postId: String(comment.postId),
    campaignId: String(campaign._id || campaign.id),
    ruleId: String(rule._id || rule.id),
    needsFollowGateEvaluation: true,
    requiresSubscriptionAndQuotaCheck: true,
    actionsNotAuthorized: true
  } };
}
