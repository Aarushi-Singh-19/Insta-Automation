const protect = require("../middleware/authMiddleware");

const express = require("express");
const router = express.Router();

const {
  getRules,
  createRule,
  updateRule,
  deleteRule,
} = require("../controllers/ruleController");

router.get("/", protect, getRules);
router.post("/", protect, createRule);
router.put("/:id", protect, updateRule);
router.delete("/:id", protect, deleteRule);

module.exports = router;