const express = require("express");

const {
  verifyWebhook,
} = require("../controllers/webhookController");

const router = express.Router();

router.get("/", verifyWebhook);

module.exports = router;