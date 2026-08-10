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

    instagramMediaId: {
  type: String,
  default: "",
},
keywords: {
  type: [String],
  default: [],
},

commentTriggerType: {
  type: String,
  enum: ["keyword", "any_comment"],
  default: "keyword",
},

// Keep this temporarily for backward compatibility.
// It is no longer used by the new UI.
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