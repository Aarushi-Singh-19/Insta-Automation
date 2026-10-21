const express = require("express");
const router = express.Router();

const analyticsController = require("../controllers/analyticsController");
const authMiddleware = require("../middleware/authMiddleware");

router.get("/trends", authMiddleware, analyticsController.getTrends);
router.get("/dashboard", authMiddleware, analyticsController.getDashboardStats);

module.exports = router;
