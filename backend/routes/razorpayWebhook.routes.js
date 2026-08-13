const express = require("express");

const router = express.Router();

const {
  handleRazorpayWebhook,
} = require(
  "../controllers/subscriptionWebhook.controller.js"
);

router.post(
  "/",
  express.raw({
    type: "application/json",
  }),
  handleRazorpayWebhook
);

module.exports = router;