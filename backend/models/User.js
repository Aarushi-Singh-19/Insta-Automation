const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
    name: String,
    email: { type: String, unique: true },
    password: String,
    },

    email: {
      type: String,
      required: true,
      unique: true,
    },

    password: {
      type: String,
      required: true,
    },

    instagramConnected: {
      type: Boolean,
      default: false,
    },

    instagramBusinessId: {
      type: String,
      default: null,
    },

    subscriptionStatus: {
  type: String,
  enum: ["trial", "active", "expired"],
  default: "trial",
},

currentPlan: {
  type: String,
  default: "trial",
},

trialStartDate: {
  type: Date,
},

trialEndDate: {
  type: Date,
},

planEndDate: {
  type: Date,
},

    facebookPageId: {
      type: String,
      default: null,
    },

    accessToken: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);



module.exports = mongoose.model("User", userSchema);