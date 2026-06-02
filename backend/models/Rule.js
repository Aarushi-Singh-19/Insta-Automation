const mongoose = require("mongoose");

const ruleSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    ruleName: String,
    postId: String,
    priority: { type: Number, default: 1 },
   triggerType: {
  type: String,
  enum: ["keyword", "any_comment"],
  default: "keyword",
},
    triggerKeywords: { type: [String], default: [] },
    replyMode: { type: String, default: "single" },
    replies: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Rule", ruleSchema);