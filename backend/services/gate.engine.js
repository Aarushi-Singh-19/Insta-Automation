const GateSession = require("../models/GateSession.js");

async function processGate({ campaign, rule, comment }) {
    
    console.log("Campaign:", campaign._id.toString());
    console.log("Rule:", rule._id.toString());
    console.log("Comment:", comment.commentText);
    console.log("================================");

   const gate = campaign.gate || {
    gateType: "NONE",
    status: "disabled",
};

switch (gate.gateType) {

    case "FOLLOW": {

        if (gate.status !== "enabled") {
            return {
                continueWorkflow: true,
                gate: null,
            };
        }

        console.log("Follow Gate detected.");

        console.log("Comment Object:", comment);

        const gateSession = await GateSession.create({
            campaignId: campaign._id,

            instagramAccountId: campaign.instagramAccountId,

            commentId: comment.commentId,

            commenterId: comment.commenterId,

            recipientId: campaign.instagramAccountId,

            username: comment.username,

            gateType: "FOLLOW",

            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        });

        console.log("GateSession Created:", gateSession._id);

        return {
            continueWorkflow: false,
            gate: gateSession,
        };
    }

    case "NONE":
    default:
        return {
            continueWorkflow: true,
            gate: null,
        };
}
}

module.exports = {
    processGate,
};