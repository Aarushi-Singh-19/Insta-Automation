const router = require("express").Router();
const CampaignHealthService = require("../services/campaignHealth.service");

router.get("/:campaignId", async (req, res) => {
  try {
    const data = await CampaignHealthService.getCampaignHealth(
      req.params.campaignId
    );

    res.json(data);
  } catch (err) {
    res.status(500).json({
      message: "Failed to fetch campaign health",
      error: err.message,
    });
  }
});

module.exports = router;