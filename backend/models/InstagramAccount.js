const mongoose = require("mongoose");

const instagramAccountSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    instagramBusinessId: {
      type: String,
      required: true,
      index: true,
    },

    pageId: {
      type: String,
      required: true,
    },

    username: {
      type: String,
      default: null,
    },

    accessToken: {
      type: String,
      required: true,
    },

    pageAccessToken: {
      type: String,
      required: true,
    },

    tokenExpiresAt: {
      type: Date,
      default: null,
    },

    status: {
      type: String,
      enum: ["active", "expired", "revoked"],
      default: "active",
    },

    connectedAt: {
      type: Date,
      default: Date.now,
    },

    lastSyncedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// prevent duplicate IG account per user
instagramAccountSchema.index(
  { userId: 1, instagramBusinessId: 1 },
  { unique: true }
);

module.exports = mongoose.model(
  "InstagramAccount",
  instagramAccountSchema
);