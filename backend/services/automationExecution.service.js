const Automation = require("../models/Automation");

class AutomationExecutionService {
  async processComment({
    postId,
    commentText,
    username,
    commentId,
  }) {
    // ------------------------------------
    // Load Active Automations
    // ------------------------------------

    const automations = await Automation.find({
      status: "active",
    });

    console.log(
      `Found ${automations.length} active automations`
    );

    const executionPayloads = [];

    const comment = (commentText || "").toLowerCase();

    for (const automation of automations) {
      let triggerMatched = false;

      // ===================================
      // Trigger Matching
      // ===================================

      if (automation.triggerType === "any-post") {
        triggerMatched = true;
      }

      else if (
        automation.triggerType === "specific-post" &&
        automation.instagramMediaId === postId
      ) {
        triggerMatched = true;
      }

      else if (automation.triggerType === "next-post") {
        // TODO
        triggerMatched = false;
      }

      if (!triggerMatched) {
        continue;
      }

      // ===================================
      // Keyword Matching
      // ===================================

      const keywords = (automation.keywords || []).map((k) =>
        k.toLowerCase().trim()
      );

      let keywordMatched = false;

      if (keywords.length === 0) {
        keywordMatched = true;
      }

      else if (automation.matchType === "any") {
        keywordMatched = keywords.some((keyword) =>
          comment.includes(keyword)
        );
      }

      else {
        keywordMatched = keywords.every((keyword) =>
          comment.includes(keyword)
        );
      }

      if (!keywordMatched) {
        continue;
      }

      // ===================================
      // Build Actions
      // ===================================

      if (automation.commentReplyEnabled) {
        executionPayloads.push({
          automationId: automation._id,

          userId: automation.user,

          postId,

          commentId,

          username,

          commentText,

          action: {
            type: "reply",
            username,
            message:
              automation.commentReplyMessage,
          },
        });
      }

      if (
        automation.dmMessage &&
        automation.dmMessage.trim()
      ) {
        executionPayloads.push({
          automationId: automation._id,

          userId: automation.user,

          postId,

          commentId,

          username,

          commentText,

          action: {
            type: "send_dm",
            username,
            message:
              automation.dmMessage,
          },
        });
      }
    }

    console.log(
      `Built ${executionPayloads.length} actions`
    );

    return executionPayloads;
  }
}

module.exports = new AutomationExecutionService();