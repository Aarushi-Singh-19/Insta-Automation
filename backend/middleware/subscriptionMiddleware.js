const User = require("../models/User");

const subscriptionMiddleware = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

const today = new Date();

console.log("========== SUBSCRIPTION CHECK ==========");

console.log({
  userId: user._id.toString(),
  subscriptionStatus: user.subscriptionStatus,
  trialEndDate: user.trialEndDate,
  planEndDate: user.planEndDate,
  today,
});

const trialActive =
  user.subscriptionStatus === "trial" &&
  user.trialEndDate &&
  new Date(user.trialEndDate) > today;

    const paidActive =
      user.subscriptionStatus === "active" &&
      user.planEndDate &&
new Date(user.planEndDate).getTime() > Date.now()
new Date(user.trialEndDate).getTime() > Date.now()

    if (trialActive || paidActive) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: "Subscription required",
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

module.exports = subscriptionMiddleware;