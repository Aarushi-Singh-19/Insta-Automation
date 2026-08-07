const express = require("express");

const router = express.Router();

const {
  testFollowStatus,
} = require("../controllers/test.controller");

const authMiddleware = require("../middleware/authMiddleware");

router.get(
  "/follow-status/:userId",
  authMiddleware,
  testFollowStatus
);

module.exports = router;