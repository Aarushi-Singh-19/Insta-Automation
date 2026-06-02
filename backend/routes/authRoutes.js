const express = require("express");


const router = express.Router();

// TEMP test routes (replace later with real auth logic)
router.post("/signup", (req, res) => {
  res.json({ message: "Signup working" });
});

router.post("/login", (req, res) => {
  res.json({ message: "Login working" });
});

module.exports = router;