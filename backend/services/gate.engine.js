const GateSession = require("../models/GateSession.js");

async function processGate({ campaign, rule, comment }) {

 console.log("========== GATE ENGINE ==========");
console.log("Campaign Gate:", campaign.gate);
console.log("Comment:", comment);
console.log("=================================");;

   const gate = campaign.gate || {
    gateType: "NONE",
    status: "disabled",
};

switch (gate.gateType) {

    case "FOLLOW": {

        console.log("🔥 ENTERED FOLLOW CASE");

        if (gate.status !== "enabled") {
            return {
                continueWorkflow: true,
                gate: null,
            };
        }

       console.log("🔥 FOLLOW GATE DETECTED");

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