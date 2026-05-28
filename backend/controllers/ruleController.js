const Rule = require("../models/Rule");

const getRules = async (req, res) => {
  try {
    const rules = await Rule.find().sort({ priority: -1 });

    res.status(200).json({
      success: true,
      count: rules.length,
      data: rules,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching rules",
      error: error.message,
    });
  }
};

const createRule = async (req, res) => {
  try {
    const rule = await Rule.create(req.body);

    res.status(201).json({
      success: true,
      message: "Rule created successfully",
      data: rule,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error creating rule",
      error: error.message,
    });
  }
};

const updateRule = async (req, res) => {
  try {
    const rule = await Rule.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!rule) {
      return res.status(404).json({
        success: false,
        message: "Rule not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Rule updated successfully",
      data: rule,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating rule",
      error: error.message,
    });
  }
};

const deleteRule = async (req, res) => {
  try {
    const rule = await Rule.findByIdAndDelete(req.params.id);

    if (!rule) {
      return res.status(404).json({
        success: false,
        message: "Rule not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Rule deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting rule",
      error: error.message,
    });
  }
};

module.exports = {
  getRules,
  createRule,
  updateRule,
  deleteRule,
};