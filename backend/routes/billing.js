const crypto = require("crypto")
const razorpay = require("../services/razorpayService");
const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const User = require("../models/User");

const Payment = require("../models/Payment");

// Temporary placeholder for future Razorpay integration
const createOrder = async (req, res) => {
  try {
const options = {
  amount: 19900,
  currency: "INR",
  receipt: `receipt_${Date.now()}`,
  notes: {
    userId: req.user.id,
  },
};
    const order = await razorpay.orders.create(options);

    res.json({
      success: true,
      order,
    });
  } catch (err) {
    console.error("Razorpay Order Error:", err);

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

const verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    const generatedSignature = crypto
      .createHmac(
        "sha256",
        process.env.RAZORPAY_KEY_SECRET
      )
      .update(
        razorpay_order_id + "|" + razorpay_payment_id
      )
      .digest("hex");

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Invalid signature",
      });
    }



const user = await User.findById(req.user.id);

if (!user) {
  return res.status(404).json({
    success: false,
    message: "User not found",
  });
}

const planEndDate = new Date();
planEndDate.setDate(planEndDate.getDate() + 30);

user.subscriptionStatus = "active";
user.currentPlan = "starter";
user.planEndDate = planEndDate;

await user.save();

const existingPayment = await Payment.findOne({
  paymentId: razorpay_payment_id,
});

if (!existingPayment) {
  await Payment.create({
    userId: user._id,
    orderId: razorpay_order_id,
    paymentId: razorpay_payment_id,
    amount: 199,
    status: "success",
  });
}

res.json({
  success: true,
  message: "Payment verified successfully",
  user,
});
  } catch (err) {
    res.status(500).json({
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
  "/create-order",
  authMiddleware,
  createOrder
);

router.post(
  "/verify-payment",
  authMiddleware,
  verifyPayment
);

router.get(
  "/history",
  authMiddleware,
  getPaymentHistory
);

module.exports = router;
