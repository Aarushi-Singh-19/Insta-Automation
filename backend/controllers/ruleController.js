const Rule = require("../models/Rule");

const getRules = async (req, res) => {
  try {
    const rules = await Rule.find({ userId: req.user.id }).sort({ priority: -1 });

    res.status(200).json({
      success: true,
      data: rules,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const createRule = async (req, res) => {
  try {
    const {
      ruleName,
      postId,
      priority,
      triggerType,
      triggerKeywords,
      replyMode,
      replies,
      isActive,
    } = req.body;

    const rule = await Rule.create({
      ruleName,
      userId: req.user.id, // from JWT middleware
      postId,
      priority,
      triggerType,
      triggerKeywords,
      replyMode,
      replies,
      isActive,
    });

    res.status(201).json({
      success: true,
      data: rule,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.message });
  }
};

const updateRule = async (req, res) => {
  try {
    const rule = await Rule.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      req.body,
      { new: true, runValidators: true }
    );

    if (!rule) {
      return res.status(404).json({ message: "Rule not found" });
    }

    res.json(rule);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


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

module.exports = {
  getRules,
  createRule,
  updateRule,
  deleteRule,
};