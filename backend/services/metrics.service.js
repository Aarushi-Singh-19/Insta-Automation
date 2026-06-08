const Campaign = require("../models/campaign.model");

const ALLOWED_FIELDS = [
  "commentsProcessed",
  "repliesSent",
  "dmsSent",
  "errors",
];

class MetricsService {
  // =========================
  // INCREMENT SINGLE METRIC
  // =========================
  async increment(campaignId, field, value = 1) {
    if (!ALLOWED_FIELDS.includes(field)) {
      throw new Error(`Invalid metric field: ${field}`);
    }

    const result = await Campaign.updateOne(
      { _id: campaignId },
      {
        $inc: {
          [`metrics.${field}`]: value,
        },
      }
    );

    if (result.matchedCount === 0) {
      throw new Error("Campaign not found");
    }

    return result;
  }

  // =========================
  // BULK INCREMENT METRICS
  // =========================
  async bulkIncrement(campaignId, fieldsObj) {
    const safeInc = {};

    for (const key in fieldsObj) {
      if (ALLOWED_FIELDS.includes(key) && typeof fieldsObj[key] === "number") {
        safeInc[`metrics.${key}`] = fieldsObj[key];
      }
    }

    if (Object.keys(safeInc).length === 0) {
      console.warn("⚠️ No valid metrics to increment:", fieldsObj);
      return null;
    }

    const result = await Campaign.updateOne(
      { _id: campaignId },
      { $inc: safeInc }
    );

    if (result.matchedCount === 0) {
      throw new Error("Campaign not found");
    }

    return result;
  }
}

module.exports = new MetricsService();