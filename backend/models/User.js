const mongoose = require("mongoose");

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