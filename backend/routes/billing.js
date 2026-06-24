const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const User = require("../models/User");

// Temporary placeholder for future Razorpay integration
const createOrder = async (req, res) => {
  res.json({
    message: "Razorpay integration coming soon",
  });
};

router.post("/create-order", authMiddleware, createOrder);

router.post("/activate-test", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const planEndDate = new Date();
    planEndDate.setDate(planEndDate.getDate() + 30);

    user.subscriptionStatus = "active";
    user.currentPlan = "starter";
    user.planEndDate = planEndDate;

    await user.save();

    const userObj = user.toObject();
    delete userObj.password;

    res.json({
      success: true,
      user: userObj,
    });
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
});

module.exports = router;