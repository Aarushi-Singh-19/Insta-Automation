const mongoose = require("mongoose");

const gateSessionSchema = new mongoose.Schema(
  {
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Campaign",
      required: true,
      index: true,
    },

instagramAccountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "InstagramAccount",
    required: false,
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

    status: {
      type: String,
      enum: ["WAITING", "COMPLETED", "EXPIRED"],
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