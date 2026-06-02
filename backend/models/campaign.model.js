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

instagramAccountId: {
  type: String,
  required: false
},

    postId: {
      type: String,
      required: true,
    },

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
      minDelaySeconds: { type: Number, default: 10 },
      maxDelaySeconds: { type: Number, default: 40 },
    },

    metrics: {
      commentsProcessed: { type: Number, default: 0 },
      dmsSent: { type: Number, default: 0 },
      repliesSent: { type: Number, default: 0 },
      errors: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Campaign", campaignSchema);