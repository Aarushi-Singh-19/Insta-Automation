const CampaignLog = require("../models/campaignLog.model");

class LogService {
  async log({
    campaignId,
    userId,
    type,
    message,
    metadata = {},
  }) {
    try {
      await CampaignLog.create({
        campaignId,
        userId,
        type,
        message,
        metadata,
      });
    } catch (err) {
      console.log("❌ Log failed:", err.message);
    }
  }
}

module.exports = new LogService();