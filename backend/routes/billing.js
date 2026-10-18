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

    // =========================================
    // BLOCK SUBSCRIPTION DURING FREE TRIAL
    // =========================================

    if (
      user.subscriptionStatus === "trial" &&
      user.trialEndDate &&
      new Date(user.trialEndDate) > new Date()
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Your 7-day free trial is still active. No payment is required yet.",
      });
    }

    // =========================================
    // ALREADY ACTIVE
    // =========================================

    if (user.subscriptionStatus === "active") {
      return res.status(400).json({
        success: false,
        message: "Subscription already active",
      });
    }

    // =========================================
    // REUSE A PENDING SUBSCRIPTION
    // Avoid creating multiple Razorpay subscriptions
    // when a user retries checkout.
    // =========================================

    if (user.razorpaySubscriptionId) {
      let existingSubscription;
      try {
        existingSubscription = await razorpay.subscriptions.fetch(
          user.razorpaySubscriptionId
        );
      } catch (fetchError) {
        console.error("EXISTING SUBSCRIPTION LOOKUP ERROR:", fetchError);
        return res.status(502).json({
          success: false,
          message: "Could not verify your existing subscription. Please retry shortly.",
        });
      }

      if (["created", "authenticated", "pending"].includes(existingSubscription.status)) {
        return res.json({
          success: true,
          subscription: {
            id: existingSubscription.id,
            planId: existingSubscription.plan_id,
            status: existingSubscription.status,
            startAt: existingSubscription.start_at,
          },
        });
      }
    }

    const planId = process.env.RAZORPAY_MONTHLY_PLAN_ID;
    if (!planId) {
      console.error("RAZORPAY_MONTHLY_PLAN_ID is not configured");
      return res.status(503).json({
        success: false,
        message: "Subscription billing is temporarily unavailable.",
      });
    }

    // =========================================
    // CREATE RAZORPAY SUBSCRIPTION
    // ONLY AFTER TRIAL ENDS
    // =========================================

    const subscription =
      await razorpay.subscriptions.create({
        plan_id: planId,

        total_count: 120,

        quantity: 1,

        customer_notify: true,

        notes: {
          userId: user._id.toString(),
          email: user.email,
        },
      });

    // =========================================
    // SAVE RAZORPAY SUBSCRIPTION ID
    // =========================================

    user.razorpaySubscriptionId =
      subscription.id;

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
      message: err.message,
    });
  }
};

const getPaymentHistory = async (req, res) => {
  try {
    const payments = await Payment.find({
      userId: req.user.id,
    }).sort({ createdAt: -1 });

    return res.json({
      success: true,
      payments,
    });
  } catch (err) {
    console.error(
      "PAYMENT HISTORY ERROR:",
      err
    );

    return res.status(500).json({
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