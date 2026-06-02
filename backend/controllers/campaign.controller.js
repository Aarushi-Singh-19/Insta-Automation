const Campaign = require("../models/campaign.model");

// CREATE CAMPAIGN
const createCampaign = async (req, res) => {
  try {
    const campaign = await Campaign.create({
      ...req.body,
      userId: req.user.id,
    });

    res.status(201).json({
      success: true,
      data: campaign,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET CAMPAIGNS
const getCampaigns = async (req, res) => {
  try {
    const campaigns = await Campaign.find({ userId: req.user.id });

    res.json({
      success: true,
      data: campaigns,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// UPDATE CAMPAIGN
const updateCampaign = async (req, res) => {
  try {
    const campaign = await Campaign.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      req.body,
      { new: true }
    );

    if (!campaign) {
      return res.status(404).json({ message: "Not found" });
    }

    res.json({ success: true, data: campaign });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// DELETE CAMPAIGN
const deleteCampaign = async (req, res) => {
  try {
    const campaign = await Campaign.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!campaign) {
      return res.status(404).json({ message: "Not found" });
    }

    res.json({ message: "Deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const attachRulesToCampaign = async (req, res) => {
  try {
    const { ruleIds } = req.body;

    const campaign = await Campaign.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { $set: { ruleIds } },
      { new: true }
    );

    res.json({
      success: true,
      data: campaign,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


module.exports = {
   attachRulesToCampaign,
  createCampaign,
  getCampaigns,
  updateCampaign,
  deleteCampaign,
};