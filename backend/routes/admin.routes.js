const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const User = require("../models/User");
const Payment = require("../models/Payment");
const InstagramAccount = require("../models/InstagramAccount");
const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");


router.get("/users", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 25));
    const search = String(req.query.search || "").trim().slice(0, 120);
    const status = String(req.query.status || "").trim();
    const from = String(req.query.from || "").trim();
    const to = String(req.query.to || "").trim();

    const filter = {};
    if (["trial", "active", "expired", "past_due", "cancelled", "halted"].includes(status)) {
      filter.subscriptionStatus = status;
    }
    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\\]\\\\]/g, String.fromCharCode(92) + "$&"), "i");
      filter.$or = [{ name: regex }, { email: regex }];
    }
    if (from || to) {
      filter.createdAt = {};
      if (from && !Number.isNaN(Date.parse(from))) {
        filter.createdAt.$gte = new Date(from + "T00:00:00.000Z");
      }
      if (to && !Number.isNaN(Date.parse(to))) {
        filter.createdAt.$lte = new Date(to + "T23:59:59.999Z");
      }
      if (Object.keys(filter.createdAt).length === 0) delete filter.createdAt;
    }

    const [total, users] = await Promise.all([
      User.countDocuments(filter),
      User.find(filter)
        .select("name email subscriptionStatus currentPlan createdAt trialStartDate trialEndDate planEndDate")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
    ]);

    const userIds = users.map((user) => user._id);
    const connectedIds = await InstagramAccount.distinct("userId", {
      userId: { $in: userIds },
      status: "active",
    });
    const connected = new Set(connectedIds.map((id) => String(id)));

    return res.json({
      users: users.map((user) => ({
        ...user,
        instagramConnected: connected.has(String(user._id)),
      })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("ADMIN USERS ERROR:", error);
    return res.status(500).json({ message: "Unable to load filtered users." });
  }
});

router.get("/overview", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const now = new Date();

    const [
      totalUsers,
      connectedInstagramUserIds,
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
      InstagramAccount.distinct("userId", { status: "active" }),
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

    const connectedUserIds = new Set(connectedInstagramUserIds.map((id) => String(id)));
    const usersWithCorrectInstagramStatus = recentUsers.map((user) => ({
      ...user,
      instagramConnected: connectedUserIds.has(String(user._id)),
    }));

    return res.json({
      generatedAt: now.toISOString(),
      metrics: {
        totalUsers,
        instagramConnected: connectedInstagramUserIds.length,
        activeTrials,
        expiredTrials,
        activePaidSubscribers,
        pastDueSubscribers,
        cancelledSubscribers,
        haltedSubscribers,
        capturedPayments: capturedRevenue[0]?.count || 0,
        capturedRevenuePaise: capturedRevenue[0]?.total || 0
      },
      recentUsers: usersWithCorrectInstagramStatus
    });
  } catch (error) {
    console.error("ADMIN OVERVIEW ERROR:", error);
    return res.status(500).json({ message: "Unable to load admin overview." });
  }
});

module.exports = router;
