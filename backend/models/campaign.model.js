const mongoose = require("mongoose");

const campaignSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    triggerType: {
  type: String,
  enum: ["any-post", "specific-post", "next-post"],
  default: "any-post",
},

    instagramMediaId: {
  type: String,
  default: "",
},

    // Keeps the execution configuration associated with the automation that
    // created this campaign. Existing campaigns continue to work without it.
    automationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Automation",
      required: false,
    },

    instagramAccountId: {
      type: String,
      required: false,
    },

    // =========================
    // FIX: SUPPORT MULTIPLE POSTS
    // =========================
    postIds: [
      {
        type: String,
        required: true,
      },
    ],

    status: {
      type: String,
      enum: ["draft", "active", "paused", "completed"],
      default: "draft",
    },

    ruleIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Rule",
      },
    ],

    settings: {
      enableDM: { type: Boolean, default: true },
      enableReply: { type: Boolean, default: true },
      dmMessage: { type: String, default: "" },
      minDelaySeconds: { type: Number, default: 10 },
      maxDelaySeconds: { type: Number, default: 40 },
    },

    metrics: {
      commentsProcessed: { type: Number, default: 0 },
      repliesSent: { type: Number, default: 0 },
      dmsSent: { type: Number, default: 0 },
      errors: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

// =========================
// BACKWARD COMPATIBILITY
// =========================
campaignSchema.virtual("primaryPostId").get(function () {
  return this.postIds?.[0] || null;
});

module.exports = mongoose.model("Campaign", campaignSchema);
