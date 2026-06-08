const mongoose = require("mongoose");

const campaignLogSchema = new mongoose.Schema(
  {
    campaignId: String,
    userId: String,

    type: {
      type: String,
enum: [
  "WEBHOOK_RECEIVED",
  "RULE_MATCHED",
  "RULE_NOT_MATCHED",
  "ACTION_QUEUED",
  "ACTION_SUCCESS",
  "ACTION_FAILED",
  "NO_CAMPAIGN"
],
    },

    message: String,

    metadata: Object,
  },
  { timestamps: true }
);

module.exports = mongoose.model("CampaignLog", campaignLogSchema);