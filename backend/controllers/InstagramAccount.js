const mongoose = require("mongoose");

const instagramAccountSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    instagramUserId: {
      type: String,
      required: true,
    },

    username: {
      type: String,
      required: true,
    },

    accessToken: {
      type: String,
      required: true,
    },

    tokenType: {
      type: String,
    },

    permissions: {
      type: [String],
      default: [],
    },

    connectedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "InstagramAccount",
  instagramAccountSchema
);