const mongoose = require("mongoose");

const referralRefundRecordSchema = new mongoose.Schema({
  razorpayRefundId: { type: String, required: true, unique: true, index: true },
  razorpayPaymentId: { type: String, required: true, index: true },
  amount: { type: Number, required: true, min: 0 },
  commissionReversal: { type: Number, required: true, min: 0 },
  processedAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model("ReferralRefundRecord", referralRefundRecordSchema);
