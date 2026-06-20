const mongoose = require("mongoose");

const automationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    triggerType: {
      type: String,
      default: "any-post",
    },

    keywords: {
      type: [String],
      default: [],
    },

    matchType: {
      type: String,
      enum: ["any", "all"],
      default: "any",
    },

    dmMessage: {
      type: String,
      required: true,
    },

    commentReplyEnabled: {
      type: Boolean,
      default: false,
    },

    commentReplyMessage: {
      type: String,
      default: "",
    },

    followGate: {
      type: Boolean,
      default: false,
    },

    status: {
      type: String,
      enum: ["active", "paused"],
      default: "active",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Automation", automationSchema);