const Campaign = require("../models/campaign.model");
const ActionLog = require("../models/EventLog");

const getHealth = async (req, res) => {
  try {
    const { id } = req.params;

    const campaign = await Campaign.findById(id);

    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    const logs = await ActionLog.find({ campaignId: id })
      .sort({ createdAt: -1 })
      .limit(10);

    const metrics = campaign.metrics || {};

    const total = metrics.commentsProcessed || 0;

    const success =
      (metrics.repliesSent || 0) + (metrics.dmsSent || 0);

    const errors = metrics.errors || 0;

    const successRate =
      total > 0 ? (success / total) * 100 : 0;

    const failureRate =
      total > 0 ? (errors / total) * 100 : 0;

    const healthScore =
      total > 0 ? successRate / 100 : 0;

    let status = "HEALTHY";
    if (healthScore < 0.7) status = "DEGRADED";
    if (healthScore < 0.4) status = "FAILING";

    res.json({
      success: true,
      data: {
        metrics,
        successRate,
        failureRate,
        healthScore,
        status,
        last10Actions: logs,
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};

module.exports = { getHealth };