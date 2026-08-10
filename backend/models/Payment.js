const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    razorpaySubscriptionId: {
      type: String,
      index: true,
    },

    razorpayPaymentId: {
      type: String,
      unique: true,
      sparse: true,
    },

    razorpayPlanId: {
      type: String,
    },

    amount: {
      type: Number,
      required: true,
    },

    currency: {
      type: String,
      default: "INR",
    },

    status: {
      type: String,
      enum: [
        "authorized",
        "success",
        "failed",
        "refunded",
      ],
      default: "success",
    },

    paymentType: {
      type: String,
      enum: ["subscription"],
      default: "subscription",
    },

    billingPeriodStart: {
      type: Date,
    },

    billingPeriodEnd: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Payment", paymentSchema);