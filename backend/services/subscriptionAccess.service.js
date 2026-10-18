const User = require("../models/User");

const hasSubscriptionAccess = (user, now = new Date()) => {
  if (!user) return false;

  const trialActive =
    user.subscriptionStatus === "trial" &&
    user.trialEndDate &&
    new Date(user.trialEndDate) > now;

  const paidPeriodActive =
    ["active", "cancelled"].includes(user.subscriptionStatus) &&
    user.planEndDate &&
    new Date(user.planEndDate) > now;

  return Boolean(trialActive || paidPeriodActive);
};

const getUserSubscriptionAccess = async (userId) => {
  const user = await User.findById(userId);

  return {
    user,
    hasAccess: hasSubscriptionAccess(user),
  };
};

module.exports = {
  hasSubscriptionAccess,
  getUserSubscriptionAccess,
};