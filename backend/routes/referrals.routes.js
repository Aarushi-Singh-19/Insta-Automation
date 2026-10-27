const express = require("express");
const crypto = require("crypto");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const User = require("../models/User");
const ReferralEarning = require("../models/ReferralEarning");

router.get("/summary", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    if (!user.referralCode) { user.referralCode = crypto.randomBytes(5).toString("hex").toUpperCase(); await user.save(); }
    const referrals = await User.find({ referredBy: user._id }).select("name createdAt subscriptionStatus currentPlan").sort({ createdAt: -1 }).lean();
    const earnings = await ReferralEarning.find({ referrerId: user._id }).sort({ createdAt: -1 }).lean();
    const sum = (statuses) => earnings.filter((e) => statuses.includes(e.status)).reduce((n, e) => n + e.commissionAmount, 0);
    const eligibleBalance = Number(sum(["eligible"]).toFixed(2));
    return res.json({ success: true, referralCode: user.referralCode, referralLink: "https://triggerdm.in/signup?ref=" + encodeURIComponent(user.referralCode), commissionRate: 20, subscriptionPrice: 199, commissionPerPayment: 39.8, minimumPayout: 199, totalReferrals: referrals.length, payingReferrals: referrals.filter((u) => u.subscriptionStatus === "active").length, totalEarned: Number(sum(["paid"]).toFixed(2)), eligibleBalance, pendingBalance: Number(sum(["requested"]).toFixed(2)), canRequestPayout: eligibleBalance >= 199, referrals: referrals.map((u) => ({ id: u._id, name: u.name || "TriggerDM user", joinedAt: u.createdAt, subscriptionStatus: u.subscriptionStatus, currentPlan: u.currentPlan })), earnings: earnings.map((e) => ({ id: e._id, grossAmount: e.grossAmount, commissionAmount: e.commissionAmount, status: e.status, createdAt: e.createdAt, paidAt: e.paidAt })) });
  } catch (error) { console.error("REFERRAL SUMMARY ERROR:", error); return res.status(500).json({ success: false, message: "Unable to load referral summary." }); }
});
module.exports = router;
