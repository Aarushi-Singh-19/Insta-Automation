const mongoose = require("mongoose");

const ruleSchema = new mongoose.Schema(
  {
    ruleName: {
      type: String,
      required: true,
      trim: true,
    },

    postId: {
  type: String,
  required: true,
  trim: true,
},

    priority: {
      type: Number,
      default: 1,
    },

    triggerType: {
      type: String,
      enum: ["keywords", "any"],
      default: "keywords",
    },

    triggerKeywords: {
      type: [String],
      default: [],
    },

    replyMode: {
      type: String,
      enum: ["single", "random"],
      default: "single",
    },

    replies: {
      type: [String],
      required: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Rule", ruleSchema);