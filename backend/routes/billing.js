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
    // CHECK CURRENT SUBSCRIPTION / TRIAL STATE
    // ==========================================

    // Active subscription already exists
    if (user.subscriptionStatus === "active") {
      return res.status(400).json({
        success: false,
        message: "Subscription already active",
      });
    }

    // Make sure the user's 7-day trial exists.
    // Signup normally creates these dates.
    if (!user.trialStartDate || !user.trialEndDate) {
      user.trialStartDate = now;

      const trialEndDate = new Date(now);
      trialEndDate.setDate(trialEndDate.getDate() + 7);

      user.trialEndDate = trialEndDate;
      user.subscriptionStatus = "trial";
      user.currentPlan = "trial";

      await user.save();
    }

    // ==========================================
    // PREVENT DUPLICATE RAZORPAY SUBSCRIPTIONS
    // ==========================================

    if (user.razorpaySubscriptionId) {
      try {
        const existingSubscription =
          await razorpay.subscriptions.fetch(
            user.razorpaySubscriptionId
          );

        const existingStatus =
          existingSubscription.status;

        // These states mean a subscription already exists
        // and should not be duplicated.
        if (
          [
            "created",
            "authenticated",
            "active",
            "pending",
          ].includes(existingStatus)
        ) {
          return res.json({
            success: true,
            existing: true,
            message:
              "Subscription already created. Continue with Razorpay checkout.",
            subscription: {
              id: existingSubscription.id,
              planId: existingSubscription.plan_id,
              status: existingSubscription.status,
              startAt: existingSubscription.start_at,
              shortUrl: existingSubscription.short_url,
            },
          });
        }

        // If the previous subscription is terminal,
        // allow the user to create a new one.
        if (
          [
            "cancelled",
            "completed",
            "expired",
            "halted",
          ].includes(existingStatus)
        ) {
          user.razorpaySubscriptionId = null;
          await user.save();
        }
      } catch (fetchError) {
        console.warn(
          "Could not fetch existing Razorpay subscription:",
          fetchError.message
        );

        // Clear stale local ID so a new subscription
        // can be created.
        user.razorpaySubscriptionId = null;
        await user.save();
      }
    }

    // ==========================================
    // VERIFY RAZORPAY PLAN ID
    // ==========================================

    if (!process.env.RAZORPAY_MONTHLY_PLAN_ID) {
      return res.status(500).json({
        success: false,
        message:
          "Razorpay monthly plan is not configured",
      });
    }

    // ==========================================
    // TRIAL END → RAZORPAY SUBSCRIPTION START
    // ==========================================

    const startAt = Math.floor(
      new Date(user.trialEndDate).getTime() / 1000
    );

    // Razorpay does not allow a past start_at.
    if (startAt <= Math.floor(Date.now() / 1000)) {
      return res.status(400).json({
        success: false,
        message:
          "Your free trial has expired. Please start your paid subscription.",
      });
    }

    // ==========================================
    // CREATE RAZORPAY SUBSCRIPTION
    // ==========================================

    const subscription =
      await razorpay.subscriptions.create({
        plan_id:
          process.env.RAZORPAY_MONTHLY_PLAN_ID,

        // 120 monthly cycles = 10 years maximum.
        // We can later change this if needed.
        total_count: 120,

        quantity: 1,

        customer_notify: true,

        // First paid billing period starts
        // when the 7-day TriggerDM trial ends.
        start_at: startAt,

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

    // IMPORTANT:
    // Do NOT mark the user active here.
    //
    // Razorpay webhook events are the source of truth.
    // The subscription will become active only after
    // Razorpay confirms the appropriate lifecycle event.
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
        shortUrl: subscription.short_url || null,
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
        err?.error?.description ||
        err?.message ||
        "Failed to create subscription",
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