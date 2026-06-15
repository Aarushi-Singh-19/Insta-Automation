const express = require("express");
const router = express.Router();

const {
  verifyWebhook,
  receiveWebhook,
} = require("../controllers/webhookController");

router.get("/instagram", verifyWebhook);

// actual events
router.post("/instagram", receiveWebhook); 

module.exports = router;