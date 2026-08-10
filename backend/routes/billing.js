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

    if (user.subscriptionStatus === "active") {
      return res.status(400).json({
        success: false,
        message: "Subscription already active",
      });
    }

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

    // Store subscription ID.
    // User is NOT active yet.
    user.razorpaySubscriptionId =
      subscription.id;

    await user.save();

    return res.json({
      success: true,
      subscription: {
        id: subscription.id,
        planId: subscription.plan_id,
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