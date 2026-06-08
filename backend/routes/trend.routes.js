const express = require("express");
const router = express.Router();

const { getTrend } = require("../controllers/trend.controller");

// GET TREND DATA
router.get("/:campaignId", getTrend);

module.exports = router;