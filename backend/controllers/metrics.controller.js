const TrendService = require("../services/trend.service");

const getTrend = async (req, res) => {
  try {
    const { campaignId } = req.query;

    if (!campaignId) {
      return res.status(400).json({ error: "campaignId required" });
    }

    const data = await TrendService.getTrendData(campaignId);

    res.json({
      success: true,
      data,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};

module.exports = { getTrend };