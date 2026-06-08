const express = require("express");
const router = express.Router();

const MetricsController = require("../controllers/metrics.controller");

router.get("/trend", MetricsController.getTrend);

module.exports = router;