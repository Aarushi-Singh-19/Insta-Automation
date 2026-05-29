const Rule = require("../models/Rule");

const getRules = async (req, res) => {
  try {
    const rules = await Rule.find().sort({ priority: -1 });

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
      userId,
      postId,
      priority,
      triggerType,
      triggerKeywords,
      replyMode,
      replies,
      isActive,
    } = req.body;

    if (!ruleName || !userId || !postId) {
      return res.status(400).json({
        success: false,
        message: "ruleName, userId, postId are required",
      });
    }

    if (!replies || replies.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one reply is required",
      });
    }

    const rule = await Rule.create({
      ruleName,
      userId,
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
      message: "Rule created successfully",
      data: rule,
    });
  } catch (error) {
    console.log("CREATE RULE ERROR:", error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const updateRule = async (req, res) => {
  try {
    const rule = await Rule.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    res.json(rule);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteRule = async (req, res) => {
  try {
    await Rule.findByIdAndDelete(req.params.id);

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