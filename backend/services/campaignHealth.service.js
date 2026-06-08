const ActionLog = require("../models/EventLog");
const FailedJob = require("../models/failedJob.model");
const mongoose = require("mongoose");
const classifyError = (err) => ({
  type: "unknown",
  message: err?.message || "unknown error",
});

class CampaignHealthService {
  /**
   * Get raw metrics for campaign
   */
  async getRawMetrics(campaignId, timeWindowHours = 24) {
    const since = new Date(Date.now() - timeWindowHours * 60 * 60 * 1000);

    const logs = await ActionLog.find({
      campaignId: new mongoose.Types.ObjectId(campaignId),
      createdAt: { $gte: since },
    });

    const failedJobs = await FailedJob.find({
      campaignId,
      createdAt: { $gte: since },
    });

    return { logs, failedJobs };
  }

  /**
   * Compute health score + breakdown
   */
  async getCampaignHealth(campaignId) {
    const { logs, failedJobs } = await this.getRawMetrics(campaignId);

    let success = 0;
    let failed = 0;

    const failureReasons = {};

    for (const log of logs) {
      if (log.status === "success") {
        success++;
      } else {
        failed++;

        const reason =
          log.errorType || classifyError(log.error)?.type || "unknown";

        failureReasons[reason] = (failureReasons[reason] || 0) + 1;
      }
    }

    const total = success + failed || 1;

    const successRate = success / total;
    const failureRate = failed / total;

    // dominant failure detection
    let dominantFailure = null;
    let maxCount = 0;

    for (const [reason, count] of Object.entries(failureReasons)) {
      if (count > maxCount) {
        maxCount = count;
        dominantFailure = reason;
      }
    }

    const dominantFailureRatio = maxCount / total;

    // simple scoring
    let healthScore =
      successRate * 0.7 +
      (1 - failureRate) * 0.2 +
      (failedJobs.length === 0 ? 0.1 : 0);

    // clamp
    healthScore = Math.min(1, Math.max(0, healthScore));

    // status classification
    let status = "HEALTHY";

    if (healthScore < 0.5 || dominantFailureRatio > 0.6) {
      status = "FAILING";
    } else if (healthScore < 0.8) {
      status = "DEGRADED";
    }

    return {
      campaignId,
      healthScore,
      status,
      successRate,
      failureRate,
      totalActions: total,
      failureReasons,
      dominantFailure,
      failedJobs: failedJobs.length,
    };
  }
}

module.exports = new CampaignHealthService();