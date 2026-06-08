const mongoose = require("mongoose");

const actionLogSchema = new mongoose.Schema(
  {
    eventId: {
      type: String,
      required: true,
      index: true,
    },

campaignId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "Campaign",
  index: true,
},

    ruleId: {
      type: String,
    },

    userId: {
      type: String,
    },

    actionType: {
      type: String,
    },

    status: {
      type: String,
      enum: ["queued", "success", "failed"],
      default: "queued",
    },

    error: String,
    errorType: String,

    // =========================
    // IMPORTANT FOR METRICS SAFETY
    // =========================
    metricsUpdated: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

const ActionLog = mongoose.model("ActionLog", actionLogSchema);

module.exports = ActionLog;