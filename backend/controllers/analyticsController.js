const ActionLog = require("../models/EventLog");

exports.getTrends = async (req, res) => {
  try {
    const stats = await ActionLog.aggregate([
      {
        $match: {
          userId: req.user.id,
        },
      },
      {
        $group: {
          _id: "$status",
          total: { $sum: 1 },
        },
      },
    ]);

    const result = {
      queued: 0,
      success: 0,
      failed: 0,
    };

    stats.forEach((item) => {
      result[item._id] = item.total;
    });

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Failed to load analytics",
    });
  }
};