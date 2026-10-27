const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  referrerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  referredUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  razorpayPaymentId: { type: String, required: true, unique: true, index: true },
  grossAmount: { type: Number, required: true, min: 0 },
  commissionRate: { type: Number, default: 20 },
  commissionAmount: { type: Number, required: true, min: 0 },
  originalCommissionAmount: { type: Number, default: null, min: 0 },
  refundedAmount: { type: Number, default: 0, min: 0 },
  commissionReversedAmount: { type: Number, default: 0, min: 0 },
  recoveryDue: { type: Number, default: 0, min: 0 },
  currency: { type: String, default: "INR" },
  status: { type: String, enum: ["eligible", "requested", "paid", "reversed"], default: "eligible", index: true },
  paidAt: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model("ReferralEarning", schema);
