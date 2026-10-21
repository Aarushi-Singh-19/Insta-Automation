const mongoose = require("mongoose");

// Permanent record: disconnecting an Instagram account must not restore its trial.
const trialRedemptionSchema = new mongoose.Schema(
  {
    instagramBusinessId: { type: String, required: true, unique: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    redeemedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model("TrialRedemption", trialRedemptionSchema);
