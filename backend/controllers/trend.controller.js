const { getTrendData } = require("../services/trend.service");

// GET /api/trend/:campaignId
const getTrend = async (req, res) => {
  try {
    const { campaignId } = req.params;

    if (!campaignId) {
      return res.status(400).json({
        success: false,
        message: "campaignId is required",
      });
    }

    const data = await getTrendData(campaignId);

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Trend API error:", error.message);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  getTrend,
};