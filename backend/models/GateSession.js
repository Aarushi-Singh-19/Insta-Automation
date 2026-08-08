const mongoose = require("mongoose");

const actionSnapshotSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
    },

    username: String,

    recipientId: String,

    message: String,

    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Campaign",
    },

    ruleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Rule",
    },
  },
  {
    _id: false,
  }
);

const gateSessionSchema = new mongoose.Schema(
  {
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Campaign",
      required: true,
      index: true,
    },


    verificationToken: {
  type: String,
  required: true,
  unique: true,
  index: true,
},

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    ruleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Rule",
      required: true,
      index: true,
    },

    instagramAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InstagramAccount",
      default: null,
    },

    commentId: {
      type: String,
      required: true,
      index: true,
    },

    commenterId: {
      type: String,
      required: true,
      index: true,
    },

    recipientId: {
      type: String,
      required: true,
      index: true,
    },

    username: {
      type: String,
      required: true,
      trim: true,
    },

    gateType: {
      type: String,
      enum: ["FOLLOW"],
      required: true,
    },

    // Snapshot of actions waiting to resume
    actions: {
  type: [actionSnapshotSchema],
  default: [],
},
    status: {
      type: String,
      enum: [
        "WAITING",
        "PROCESSING",
        "COMPLETED",
        "EXPIRED",
      ],
      default: "WAITING",
      index: true,
    },

    completedAt: {
      type: Date,
      default: null,
    },

    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
  },
  {
    timestamps: {
      createdAt: true,
      updatedAt: false,
    },
  }
);

gateSessionSchema.index({ campaignId: 1, status: 1 });
gateSessionSchema.index({ commenterId: 1, campaignId: 1 });
gateSessionSchema.index({ recipientId: 1, status: 1 });

module.exports = mongoose.model("GateSession", gateSessionSchema);