const GateSession = require("../models/GateSession.js");
const crypto = require("crypto");

async function processGate({
  campaign,
  rule,
  comment,
  actions,
}) {
  console.log("========== GATE ENGINE ==========");
  console.log("Campaign Gate:", campaign.gate);
  console.log("Comment:", comment);
  console.log("=================================");

  const gate = campaign.gate || {
    gateType: "NONE",
    status: "disabled",
  };

  switch (gate.gateType) {
    case "FOLLOW": {
      console.log("🔥 ENTERED FOLLOW CASE");

      // Gate disabled → continue normally
      if (gate.status !== "enabled") {
        return {
          continueWorkflow: true,
          gate: null,
        };
      }

      console.log("🔥 FOLLOW GATE DETECTED");

      // The Instagram account ID must come from
      // the same account that received the comment.
      if (!comment.instagramAccountId) {
        throw new Error(
          "INSTAGRAM_ACCOUNT_ID_REQUIRED_FOR_GATE"
        );
      }

      // Actions are already built before the gate.
      // They are stored as an immutable snapshot.
      if (!Array.isArray(actions) || actions.length === 0) {
        throw new Error("NO_ACTIONS_TO_STORE_IN_GATE_SESSION");
      }

      const verificationToken = crypto.randomUUID();

      const gateSession = await GateSession.create({
        verificationToken,

        campaignId: campaign._id,

        userId: campaign.userId,

        instagramAccountId: comment.instagramAccountId,

        commentId: comment.eventId,

        ruleId: rule._id,

        commenterId: comment.recipientId,

        recipientId: comment.recipientId,

        username: comment.username,

        gateType: "FOLLOW",

        actions,

        status: "WAITING",

        expiresAt: new Date(
          Date.now() + 24 * 60 * 60 * 1000
        ),
      });

      console.log(
        "✅ GateSession Created:",
        gateSession._id
      );

      console.log(
        "🔐 Verification Token:",
        verificationToken
      );

      console.log(
        "📸 Instagram Account:",
        comment.instagramAccountId
      );

      return {
        continueWorkflow: false,
        gate: gateSession,
      };
    }

    case "NONE":
    default: {
      // No active gate → continue normal workflow
      return {
        continueWorkflow: true,
        gate: null,
      };
    }
  }
}

module.exports = {
  processGate,
};