const mongoose = require("mongoose");

const failedJobSchema = new mongoose.Schema(
  {
    errorType: { type: String }, // NEW
isRetryable: { type: Boolean, default: true }, // NEW
failureStage: { type: String }, // EXECUTION / QUEUE / API
    jobId: String,
    campaignId: String,
    ruleId: String,
    userId: String,

    actionType: String,
    payload: Object,

    errorMessage: String,
    stack: String,

    attemptsMade: Number,

    failedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("FailedJob", failedJobSchema);