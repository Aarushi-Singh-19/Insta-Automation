const express = require("express");
const router = express.Router();

const {
  verifyWebhook,
  handleWebhook,
} = require("../controllers/webhookController");

// verification (Meta setup step)
router.get("/instagram", verifyWebhook);

// actual events
router.post("/instagram", handleWebhook);

module.exports = router;