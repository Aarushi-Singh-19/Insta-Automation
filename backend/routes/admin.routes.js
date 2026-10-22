const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const User = require("../models/User");
const Payment = require("../models/Payment");
const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");

router.get("/overview", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const now = new Date();

    const [
      totalUsers,
      instagramConnected,
      activeTrials,
      expiredTrials,
      activePaidSubscribers,
      pastDueSubscribers,
      cancelledSubscribers,
      haltedSubscribers,
      recentUsers,
      capturedRevenue
    ] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ instagramConnected: true }),
      User.countDocuments({
        subscriptionStatus: "trial",
        trialEndDate: { $gt: now }
      }),
      User.countDocuments({
        $or: [
          { subscriptionStatus: "expired" },
          { subscriptionStatus: "trial", trialEndDate: { $lte: now } }
        ]
      }),
      User.countDocuments({
        subscriptionStatus: "active",
        planEndDate: { $gt: now }
      }),
      User.countDocuments({ subscriptionStatus: "past_due" }),
      User.countDocuments({ subscriptionStatus: "cancelled" }),
      User.countDocuments({ subscriptionStatus: "halted" }),
      User.find({})
        .select("name email subscriptionStatus currentPlan instagramConnected createdAt trialStartDate trialEndDate planEndDate")
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
      Payment.aggregate([
        { $match: { status: "captured" } },
        { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } }
      ])
    ]);

    return res.json({
      generatedAt: now.toISOString(),
      metrics: {
        totalUsers,
        instagramConnected,
        activeTrials,
        expiredTrials,
        activePaidSubscribers,
        pastDueSubscribers,
        cancelledSubscribers,
        haltedSubscribers,
        capturedPayments: capturedRevenue[0]?.count || 0,
        capturedRevenuePaise: capturedRevenue[0]?.total || 0
      },
      recentUsers
    });
  } catch (error) {
    console.error("ADMIN OVERVIEW ERROR:", error);
    return res.status(500).json({ message: "Unable to load admin overview." });
  }
});

module.exports = router;
