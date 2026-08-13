const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // ==========================================
    // RAZORPAY IDENTIFIERS
    // ==========================================

    razorpayPaymentId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },

    razorpaySubscriptionId: {
      type: String,
      default: null,
      index: true,
    },

    // Legacy field - kept so old payment history
    // is not unnecessarily broken.
    paymentId: {
      type: String,
      default: null,
    },

    // Legacy one-time payment field.
    orderId: {
      type: String,
      default: null,
    },

    // ==========================================
    // PAYMENT DETAILS
    // ==========================================

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
        "captured",
        "failed",
        "refunded",
      ],
      default: "captured",
    },

    // Example:
    // payment.captured
    // payment.failed
    // subscription.charged
    eventType: {
      type: String,
      default: null,
    },

    // Razorpay webhook event ID.
    // Used for webhook idempotency.
    webhookEventId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },

    paidAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports =
  mongoose.model("Payment", paymentSchema);