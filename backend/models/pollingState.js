const mongoose = require("mongoose");

const pollingStateSchema = new mongoose.Schema(
  {
    initialized: {
      type: Boolean,
      default: false,
    },

    initializedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "PollingState",
  pollingStateSchema
);