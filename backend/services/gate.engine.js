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
    case "FOLLOW":

        if (gate.status !== "enabled") {
            return {
                continueWorkflow: true,
                gate: null,
            };
        }

        console.log("Follow Gate detected.");

        return {
            continueWorkflow: true,
            gate: null,
        };

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