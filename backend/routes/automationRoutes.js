const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");


const {
  createAutomation,
  getAutomations,
} = require("../controllers/automationController");

router.post(
  "/",
  authMiddleware,
  createAutomation
);

router.get(
  "/",
  authMiddleware,
  getAutomations
);

module.exports = router;