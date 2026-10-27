const express = require("express");
const mongoose = require("mongoose");
const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");
const ReferralEarning = require("../models/ReferralEarning");
const ReferralPayoutRequest = require("../models/ReferralPayoutRequest");
const User = require("../models/User");

const router = express.Router();
const MINIMUM_PAYOUT = 199;

router.get("/requests", authMiddleware, async (req, res) => {
  try {
    const requests = await ReferralPayoutRequest.find({ referrerId: req.user.id })
      .sort({ requestedAt: -1 }).lean();
    return res.json({ success: true, requests });
  } catch (error) {
    console.error("REFERRAL PAYOUT HISTORY ERROR:", error);
    return res.status(500).json({ success: false, message: "Unable to load payout history." });
  }
});

router.post("/requests", authMiddleware, async (req, res) => {
  const session = await mongoose.startSession();
  try {
    let created;
    await session.withTransaction(async () => {
      const earnings = await ReferralEarning.find({ referrerId: req.user.id, status: "eligible" }).session(session);
      const amount = Number(earnings.reduce((sum, earning) => sum + earning.commissionAmount, 0).toFixed(2));
      if (amount < MINIMUM_PAYOUT) {
        const error = new Error("You need at least ₹199 in eligible earnings to request a payout.");
        error.statusCode = 400;
        throw error;
      }

      const earningIds = earnings.map((earning) => earning._id);
      const reserved = await ReferralEarning.updateMany(
        { _id: { $in: earningIds }, referrerId: req.user.id, status: "eligible" },
        { $set: { status: "requested" } },
        { session }
      );
      if (reserved.modifiedCount !== earningIds.length) {
        const error = new Error("Your eligible balance changed. Refresh and try again.");
        error.statusCode = 409;
        throw error;
      }

      [created] = await ReferralPayoutRequest.create([{
        referrerId: req.user.id, earningIds, amount, status: "requested"
      }], { session });
    });
    return res.status(201).json({ success: true, request: created });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
    console.error("REFERRAL PAYOUT REQUEST ERROR:", error);
    return res.status(500).json({ success: false, message: "Unable to request payout. No funds were intentionally transferred." });
  } finally {
    await session.endSession();
  }
});

router.get("/admin/requests", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const requests = await ReferralPayoutRequest.find({})
      .populate("referrerId", "name email").sort({ requestedAt: -1 }).lean();
    return res.json({ success: true, requests });
  } catch (error) {
    console.error("ADMIN REFERRAL PAYOUT LIST ERROR:", error);
    return res.status(500).json({ success: false, message: "Unable to load payout requests." });
  }
});

router.patch("/admin/requests/:id", authMiddleware, adminMiddleware, async (req, res) => {
  const { action } = req.body || {};
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: "Invalid payout request ID." });
  }
  if (!["approve", "reject", "paid"].includes(action)) {
    return res.status(400).json({ success: false, message: "Action must be approve, reject, or paid." });
  }
  const session = await mongoose.startSession();
  try {
    let updated;
    await session.withTransaction(async () => {
      const payout = await ReferralPayoutRequest.findById(req.params.id).session(session);
      if (!payout) {
        const error = new Error("Payout request not found."); error.statusCode = 404; throw error;
      }
      if (action === "approve" || action === "reject") {
        if (payout.status !== "requested") {
          const error = new Error("Only requested payouts can be approved or rejected."); error.statusCode = 409; throw error;
        }
        payout.status = action === "approve" ? "approved" : "rejected";
        payout.reviewedAt = new Date();
        payout.reviewedBy = req.user.id;
        payout.adminNote = typeof req.body.note === "string" ? req.body.note.trim().slice(0, 500) : null;
        if (action === "reject") {
          await ReferralEarning.updateMany(
            { _id: { $in: payout.earningIds }, referrerId: payout.referrerId, status: "requested" },
            { $set: { status: "eligible" } }, { session }
          );
        }
      } else {
        if (payout.status !== "approved") {
          const error = new Error("Only approved payouts can be marked paid."); error.statusCode = 409; throw error;
        }
        const reference = String(req.body.transferReference || "").trim().slice(0, 160);
        if (!reference) {
          const error = new Error("Enter the confirmed bank transfer reference before marking paid."); error.statusCode = 400; throw error;
        }
        const earnings = await ReferralEarning.find({
          _id: { $in: payout.earningIds }, referrerId: payout.referrerId, status: "requested"
        }).session(session);
        if (earnings.length !== payout.earningIds.length) {
          const error = new Error("Payout earnings changed or are no longer reserved; review manually."); error.statusCode = 409; throw error;
        }
        const currentReservedAmount = Number(earnings.reduce((sum, earning) => sum + earning.commissionAmount, 0).toFixed(2));
        if (currentReservedAmount !== payout.amount) {
          const error = new Error("Reserved earnings changed after a refund. Do not pay this request; review and reconcile it manually."); error.statusCode = 409; throw error;
        }
        await ReferralEarning.updateMany(
          { _id: { $in: payout.earningIds }, referrerId: payout.referrerId, status: "requested" },
          { $set: { status: "paid", paidAt: new Date() } }, { session }
        );
        payout.status = "paid";
        payout.completedAt = new Date();
        payout.transferReference = reference;
        payout.reviewedAt = payout.reviewedAt || new Date();
        payout.reviewedBy = req.user.id;
      }
      await payout.save({ session });
      updated = payout;
    });
    return res.json({ success: true, request: updated });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
    console.error("ADMIN REFERRAL PAYOUT UPDATE ERROR:", error);
    return res.status(500).json({ success: false, message: "Unable to update payout request." });
  } finally {
    await session.endSession();
  }
});

module.exports = router;
