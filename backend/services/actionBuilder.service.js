class ActionBuilderService {
  buildActionFromRule(rule, username, campaign) {
    if (rule.replyMode === "single") {
      const message = rule.replies?.[0] || "Thanks for your comment!";

      return {
        type: "reply",
        username,
        message,
        campaignId: campaign._id,
        ruleId: rule._id,
      };
    }

    // fallback
    return {
      type: "reply",
      username,
      message: "Thanks for your comment!",
      campaignId: campaign._id,
      ruleId: rule._id,
    };
  }
}

module.exports = new ActionBuilderService();