const express = require("express");
const router = express.Router();

const subscriptionMiddleware = require("../middleware/subscriptionMiddleware");

const authMiddleware = require("../middleware/authMiddleware");

const {
  createCampaign,
  getCampaigns,
  updateCampaign,
  deleteCampaign,
  attachRulesToCampaign,
} = require("../controllers/campaign.controller");

const { getHealth } = require("../controllers/campaignHealth.controller");

// Routes
router.post(
  "/",
  authMiddleware,
  subscriptionMiddleware,
  createCampaign
);
router.get("/", authMiddleware, getCampaigns);
router.put(
  "/:id",
  authMiddleware,
  subscriptionMiddleware,
  updateCampaign
);
router.delete("/:id", authMiddleware, deleteCampaign);

// attach rules
router.patch(
  "/:id/rules",
  authMiddleware,
  subscriptionMiddleware,
  attachRulesToCampaign
);

// 🔥 NEW HEALTH ROUTE
router.get("/:id/health", authMiddleware, getHealth);

module.exports = router;