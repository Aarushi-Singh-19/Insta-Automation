const ActionLog = require("../models/EventLog");

const getTrendData = async (campaignId) => {
  const now = new Date();

  const last1hTime = new Date(now.getTime() - 60 * 60 * 1000);
  const last24hTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [last1hStats, last24hStats] = await Promise.all([
    ActionLog.aggregate([
      {
        $match: {
          campaignId,
          createdAt: { $gte: last1hTime },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          success: {
            $sum: {
              $cond: [{ $eq: ["$status", "success"] }, 1, 0],
            },
          },
          failed: {
            $sum: {
              $cond: [{ $eq: ["$status", "failed"] }, 1, 0],
            },
          },
        },
      },
    ]),

    ActionLog.aggregate([
      {
        $match: {
          campaignId,
          createdAt: { $gte: last24hTime },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          success: {
            $sum: {
              $cond: [{ $eq: ["$status", "success"] }, 1, 0],
            },
          },
          failed: {
            $sum: {
              $cond: [{ $eq: ["$status", "failed"] }, 1, 0],
            },
          },
        },
      },
    ]),
  ]);

  const format = (data) => {
    const d = data?.[0] || { total: 0, success: 0, failed: 0 };

    return {
      total: d.total,
      success: d.success,
      failed: d.failed,
      successRate: d.total ? (d.success / d.total) * 100 : 0,
    };
  };

  const last1h = format(last1hStats);
  const last24h = format(last24hStats);

  const expectedHourlyFailure = last24h.failed / 24;

  const failureSpike =
    last1h.failed > expectedHourlyFailure * 1.5;

  return {
    last1h,
    last24h,
    failureSpike,
    trend: {
      successRateDelta:
        last1h.successRate - last24h.successRate,
      failureRateDelta:
        last1h.failed - expectedHourlyFailure,
    },
  };
};

module.exports = { getTrendData };