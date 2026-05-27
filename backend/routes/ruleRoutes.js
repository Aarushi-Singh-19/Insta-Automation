const express = require("express");
const router = express.Router();

const {
  getRules,
  createRule,
  updateRule,
  deleteRule,
} = require("../controllers/ruleController");

router.get("/", getRules);
router.post("/", createRule);
router.put("/:id", updateRule);
router.delete("/:id", deleteRule);

module.exports = router;