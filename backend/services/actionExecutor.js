// MOCK ACTION EXECUTOR (REAL INTEGRATION LATER)

const executeAction = async (action, campaign) => {
  try {
    if (action.type === "dm") {
      console.log(`📩 Sending DM to @${action.to}`);
      console.log(`Message: ${action.message}`);
    }

    if (action.type === "reply") {
      console.log(`💬 Replying to @${action.to}`);
      console.log(`Message: ${action.message}`);
    }

    // update metrics (basic tracking)
    campaign.metrics = campaign.metrics || {};

    if (action.type === "dm") {
      campaign.metrics.dmsSent = (campaign.metrics.dmsSent || 0) + 1;
    }

    if (action.type === "reply") {
      campaign.metrics.repliesSent = (campaign.metrics.repliesSent || 0) + 1;
    }

    await campaign.save();

    return true;
  } catch (err) {
    console.error("Action execution failed:", err.message);
    return false;
  }
};

module.exports = {
  executeAction,
};