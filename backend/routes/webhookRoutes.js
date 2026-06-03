const express = require("express");
const router = express.Router();

const { receiveWebhook } = require("../controllers/webhookController");

// ONLY THIS
router.post("/", receiveWebhook);

module.exports = router;