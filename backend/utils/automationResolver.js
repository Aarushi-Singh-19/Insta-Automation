const Automation = require("../models/Automation");

const findMatchingAutomations = async (postId) => {
    const automations = await Automation.find({
        status: "active",
    });

    return automations;
};

module.exports = {
    findMatchingAutomations,
};