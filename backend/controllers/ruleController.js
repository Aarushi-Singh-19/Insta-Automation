const Rule = require("../models/Rule");

// GET RULES
const getRules = async (req, res) => {
  try {
    const rules = await Rule.find({ userId: req.user.id }).sort({ priority: -1 });

    res.status(200).json({
      success: true,
      data: rules,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// CREATE RULE
const createRule = async (req, res) => {
  try {
    const rule = await Rule.create({
      ...req.body,
      userId: req.user.id,
    });

    res.status(201).json({ success: true, data: rule });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// UPDATE RULE
const updateRule = async (req, res) => {
  try {
    const rule = await Rule.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      req.body,
      { new: true }
    );

    if (!rule) {
      return res.status(404).json({ message: "Rule not found" });
    }

    res.json(rule);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// DELETE RULE
const deleteRule = async (req, res) => {
  try {
    const rule = await Rule.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!rule) {
      return res.status(404).json({ message: "Rule not found" });
    }

    res.json({ message: "Deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// TOGGLE RULE
const toggleRuleStatus = async (req, res) => {
  try {
    const rule = await Rule.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!rule) {
      return res.status(404).json({ message: "Rule not found" });
    }

    rule.isActive = !rule.isActive;
    await rule.save();

    res.json({ success: true, data: rule });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getRules,
  createRule,
  updateRule,
  deleteRule,
  toggleRuleStatus,
};