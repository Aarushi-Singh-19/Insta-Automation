const express = require("express");
const crypto = require("crypto");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const User = require("../models/User");
const ReferralEarning = require("../models/ReferralEarning");

async function getOrCreatePersistedReferralCode(userId) {
  // Read from the raw collection so Mongoose schema defaults cannot make an
  // unsaved referralCode look like a persisted one.
  const collection = User.collection;
  const existing = await collection.findOne(
    { _id: userId },
    { projection: { referralCode: 1 } }
  );

  if (existing?.referralCode) return existing.referralCode;

  // Persist the code only if another request has not already done so.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = crypto.randomBytes(5).toString("hex").toUpperCase();
    try {
      await collection.updateOne(
        {
          _id: userId,
          $or: [
            { referralCode: { $exists: false } },
            { referralCode: null },
            { referralCode: "" },
          ],
        },
        { $set: { referralCode: code } }
      );
      const saved = await collection.findOne(
        { _id: userId },
        { projection: { referralCode: 1 } }
      );
      if (saved?.referralCode) return saved.referralCode;
    } catch (error) {
      // A rare unique-index collision can be retried with a new code.
      if (error.code !== 11000) throw error;
    }
  }

  throw new Error("Could not persist a unique referral code.");
}

router.get("/summary", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("_id");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const referralCode = await getOrCreatePersistedReferralCode(user._id);
    const referrals = await User.find({ referredBy: user._id }).select("name createdAt subscriptionStatus currentPlan").sort({ createdAt: -1 }).lean();
    const earnings = await ReferralEarning.find({ referrerId: user._id }).sort({ createdAt: -1 }).lean();
    const sum = (statuses) => earnings.filter((e) => statuses.includes(e.status)).reduce((n, e) => n + e.commissionAmount, 0);
    const eligibleBalance = Number(sum(["eligible"]).toFixed(2));
    return res.json({ success: true, referralCode, referralLink: "https://triggerdm.in/signup?ref=" + encodeURIComponent(referralCode), commissionRate: 20, subscriptionPrice: 199, commissionPerPayment: 39.8, minimumPayout: 199, totalReferrals: referrals.length, payingReferrals: referrals.filter((u) => u.subscriptionStatus === "active").length, totalEarned: Number(sum(["paid"]).toFixed(2)), eligibleBalance, pendingBalance: Number(sum(["requested"]).toFixed(2)), canRequestPayout: eligibleBalance >= 199, referrals: referrals.map((u) => ({ id: u._id, name: u.name || "TriggerDM user", joinedAt: u.createdAt, subscriptionStatus: u.subscriptionStatus, currentPlan: u.currentPlan })), earnings: earnings.map((e) => ({ id: e._id, grossAmount: e.grossAmount, commissionAmount: e.commissionAmount, status: e.status, createdAt: e.createdAt, paidAt: e.paidAt })) });
  } catch (error) {
    console.error("REFERRAL SUMMARY ERROR:", error);
    return res.status(500).json({ success: false, message: "Unable to load referral summary." });
  }
});

module.exports = router;
