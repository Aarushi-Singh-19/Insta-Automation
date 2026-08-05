/**
 * Gate Engine
 *
 * Decides whether an automation should continue
 * immediately or pause at a premium gate.
 *
 * Currently:
 * - NONE -> Continue
 *
 * Future:
 * - FOLLOW
 * - EMAIL
 * - QUIZ
 * - etc.
 */

async function processGate({ campaign, rule, comment }) {
    const gate = campaign.gate || { type: "NONE" };

    switch (gate.type) {
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