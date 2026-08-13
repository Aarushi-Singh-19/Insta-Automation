const razorpay = require("../services/razorpayService");
const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const User = require("../models/User");
const Payment = require("../models/Payment");

const createSubscription = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const now = new Date();

    // ==========================================
    // USER IS STILL IN FREE TRIAL
    // ==========================================

    if (
      user.subscriptionStatus === "trial" &&
      user.trialEndDate &&
      new Date(user.trialEndDate) > now
    ) {
      const trialEnd = new Date(user.trialEndDate);

      const daysRemaining = Math.ceil(
        (trialEnd.getTime() - now.getTime()) /
          (1000 * 60 * 60 * 24)
      );

      return res.status(400).json({
        success: false,
        message: `Your free trial is still active. You can subscribe after your trial ends.`,
        trialEndDate: trialEnd,
        daysRemaining,
      });
    }

    // ==========================================
    // TRIAL HAS EXPIRED
    // ==========================================

    if (
      user.subscriptionStatus === "trial" &&
      user.trialEndDate &&
      new Date(user.trialEndDate) <= now
    ) {
      user.subscriptionStatus = "expired";
      await user.save();
    }

    // ==========================================
    // ALREADY ACTIVE
    // ==========================================

    if (user.subscriptionStatus === "active") {
      return res.status(400).json({
        success: false,
        message: "Subscription already active",
      });
    }

    // ==========================================
    // CREATE REAL RAZORPAY SUBSCRIPTION
    //
    // IMPORTANT:
    // NO start_at HERE.
    //
    // The trial has already ended.
    // The customer is now subscribing.
    // ==========================================

    const subscription =
      await razorpay.subscriptions.create({
        plan_id:
          process.env.RAZORPAY_MONTHLY_PLAN_ID,

        total_count: 120,

        quantity: 1,

        customer_notify: true,

        notes: {
          userId: user._id.toString(),
          email: user.email,
        },
      });

    // ==========================================
    // SAVE RAZORPAY SUBSCRIPTION ID
    // ==========================================

    user.razorpaySubscriptionId =
      subscription.id;

    user.currentPlan = "starter";

    await user.save();

    console.log(
      "✅ Razorpay Subscription Created:",
      subscription.id
    );

    return res.json({
      success: true,

      subscription: {
        id: subscription.id,
        planId: subscription.plan_id,
        status: subscription.status,
        startAt: subscription.start_at,
      },
    });
  } catch (err) {
    console.error(
      "CREATE SUBSCRIPTION ERROR:",
      err
    );

    return res.status(500).json({
      success: false,
      message:
        err.response?.error?.description ||
        err.message ||
        "Unable to create subscription",
    });
  }
};
const getPaymentHistory = async (req, res) => {
  try {
    const payments = await Payment.find({
      userId: req.user.id,
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      payments,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

router.post(
  "/create-subscription",
  authMiddleware,
  createSubscription
);

router.get(
  "/history",
  authMiddleware,
  getPaymentHistory
);

module.exports = router;