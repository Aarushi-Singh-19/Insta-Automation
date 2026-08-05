const mongoose = require("mongoose");


const processedEventSchema = new mongoose.Schema(
  {
    eventId: { type: String, required: true, unique: true }, // commentId or messageId
    type: { type: String, required: true }, // "comment"
    status: { type: String, enum: ["processed", "queued"], default: "processed" },
    createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 7 } // auto cleanup in 7 days
  },
  { versionKey: false }
);

module.exports = mongoose.model("ProcessedEvent", processedEventSchema);