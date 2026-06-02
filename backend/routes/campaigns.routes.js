const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");

const {
  createCampaign,
  getCampaigns,
  updateCampaign,
  deleteCampaign,
  attachRulesToCampaign,
} = require("../controllers/campaign.controller");

// Routes
router.post("/", authMiddleware, createCampaign);
router.get("/", authMiddleware, getCampaigns);
router.put("/:id", authMiddleware, updateCampaign);
router.delete("/:id", authMiddleware, deleteCampaign);

// attach rules
router.patch("/:id/rules", authMiddleware, attachRulesToCampaign);

module.exports = router;