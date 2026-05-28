const express = require("express");
const router = express.Router();

const {
  createRule,
} = require("../controllers/ruleController");

router.post("/", createRule);

module.exports = router;