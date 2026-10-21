const ActionLog = require("../models/EventLog");
const Automation = require("../models/Automation");
const Campaign = require("../models/campaign.model");
const InstagramAccount = require("../models/InstagramAccount");

exports.getTrends = async (req, res) => {
  try {
    const stats = await ActionLog.aggregate([
      { $match: { userId: req.user.id } },
      { $group: { _id: "$status", total: { $sum: 1 } } },
    ]);

    const result = { queued: 0, success: 0, failed: 0 };
    stats.forEach((item) => {
      result[item._id] = item.total;
    });

    res.json(result);
  } catch (err) {
    console.error("Analytics trends error:", err);
    res.status(500).json({ message: "Failed to load analytics" });
  }
};

exports.getDashboardStats = async (req, res) => {
  try {
    const userId = req.user.id;

    const [activeAutomations, connectedAccounts, campaignMetrics] =
      await Promise.all([
        Automation.countDocuments({ user: userId, status: "active" }),
        InstagramAccount.countDocuments({ userId, status: "active" }),
        Campaign.aggregate([
          { $match: { userId: require("mongoose").Types.ObjectId.createFromHexString(userId) } },
          {
            $group: {
              _id: null,
              dmsSent: { $sum: { $ifNull: ["$metrics.dmsSent", 0] } },
              commentsProcessed: { $sum: { $ifNull: ["$metrics.commentsProcessed", 0] } },
            },
          },
        ]),
      ]);

    const totals = campaignMetrics[0] || { dmsSent: 0, commentsProcessed: 0 };

    res.json({
      activeAutomations,
      dmsSent: totals.dmsSent,
      commentsProcessed: totals.commentsProcessed,
      connectedAccounts,
    });
  } catch (err) {
    console.error("Dashboard stats error:", err);
    res.status(500).json({ message: "Failed to load dashboard statistics" });
  }
};
