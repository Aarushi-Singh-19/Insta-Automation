const express = require("express");

const router = express.Router();

const FollowVerificationController = require("../controllers/followVerification.controller");

router.post(
    "/verify-follow",
    FollowVerificationController.verify
);

module.exports = router;