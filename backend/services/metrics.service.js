const Campaign = require("../models/campaign.model");

const ALLOWED_FIELDS = [
  "commentsProcessed",
  "repliesSent",
  "dmsSent",
  "errors",
];

class MetricsService {
  async increment(campaignId, field) {
    if (!ALLOWED_FIELDS.includes(field)) {
      throw new Error(`Invalid metric field: ${field}`);
    }

    const result = await Campaign.findByIdAndUpdate(
      campaignId,
      {
        $inc: {
          [`metrics.${field}`]: 1,
        },
      },
      { new: true }
    );

    if (!result) {
      throw new Error("Campaign not found");
    }

    return result;
  }

  async bulkIncrement(campaignId, fieldsObj) {
    const safeInc = {};

    for (const key in fieldsObj) {
      if (ALLOWED_FIELDS.includes(key)) {
        safeInc[`metrics.${key}`] = fieldsObj[key];
      }
    }

    if (Object.keys(safeInc).length === 0) return;

    const result = await Campaign.findByIdAndUpdate(
      campaignId,
      { $inc: safeInc },
      { new: true }
    );

    if (!result) {
      throw new Error("Campaign not found");
    }

    return result;
  }
}

module.exports = new MetricsService();