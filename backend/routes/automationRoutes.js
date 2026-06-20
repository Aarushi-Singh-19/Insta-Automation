const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");

const {
  createAutomation,
} = require("../controllers/automationController");

router.post(
  "/",
  authMiddleware,
  createAutomation
);

module.exports = router;