const mongoose = require("mongoose");
const crypto = require("crypto");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      default: "",
    },

    email: {
      type: String,
      required: true,
      unique: true,
    },

    password: {
      type: String,
      required: true,
    },

    referralCode: { type: String, unique: true, sparse: true, index: true, default: () => crypto.randomBytes(5).toString("hex").toUpperCase() },
    referredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },

    passwordResetTokenHash: {
      type: String,
      default: null,
    },

    passwordResetExpires: {
      type: Date,
      default: null,
    },

    instagramConnected: {
      type: Boolean,
      default: false,
    },

    instagramBusinessId: {
      type: String,
      default: null,
    },

    // =========================
    // SUBSCRIPTION
    // =========================

    subscriptionStatus: {
      type: String,
      enum: [
        "trial",
        "active",
        "expired",
        "past_due",
        "cancelled",
        "halted",
      ],
      default: "trial",
    },

    currentPlan: {
      type: String,
      default: "trial",
    },

    trialStartDate: {
      type: Date,
      default: null,
    },

    trialEndDate: {
      type: Date,
      default: null,
    },

    planEndDate: {
      type: Date,
      default: null,
    },

    razorpaySubscriptionId: {
      type: String,
      default: null,
      index: true,
    },

    razorpayCustomerId: {
      type: String,
      default: null,
    },

    subscriptionCurrentStart: {
      type: Date,
      default: null,
    },

    subscriptionCurrentEnd: {
      type: Date,
      default: null,
    },

    // =========================
    // INSTAGRAM
    // =========================

    facebookPageId: {
      type: String,
      default: null,
    },

    accessToken: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("User", userSchema);