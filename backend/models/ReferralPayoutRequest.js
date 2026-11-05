const mongoose = require("mongoose");

const referralPayoutRequestSchema = new mongoose.Schema({
  referrerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  earningIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "ReferralEarning", required: true }],
  amount: { type: Number, required: true, min: 199 },
  currency: { type: String, default: "INR", enum: ["INR"] },
  status: { type: String, enum: ["requested", "approved", "paid", "rejected"], default: "requested", index: true },
  requestedAt: { type: Date, default: Date.now },
  reviewedAt: { type: Date, default: null },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  completedAt: { type: Date, default: null },
  transferReference: { type: String, default: null, maxlength: 160 },
  adminNote: { type: String, default: null, maxlength: 500 }
}, { timestamps: true });

referralPayoutRequestSchema.index({ referrerId: 1, requestedAt: -1 });

module.exports = mongoose.model("ReferralPayoutRequest", referralPayoutRequestSchema);
