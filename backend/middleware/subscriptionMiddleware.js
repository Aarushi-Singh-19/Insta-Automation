
const {
  getUserSubscriptionAccess,
} = require("../services/subscriptionAccess.service");

const subscriptionMiddleware = async (req, res, next) => {
  try {
    const { user, hasAccess } =
      await getUserSubscriptionAccess(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (hasAccess) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: "Subscription required",
    });
  } catch (error) {
    console.error("SUBSCRIPTION MIDDLEWARE ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

module.exports = subscriptionMiddleware;
