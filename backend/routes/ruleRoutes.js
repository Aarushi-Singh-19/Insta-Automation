const express = require("express");
const router = express.Router();

const {
  getRules,
  createRule,
} = require("../controllers/ruleController");

router.get("/", getRules);
router.post("/", createRule);

module.exports = router;