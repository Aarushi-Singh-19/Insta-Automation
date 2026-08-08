const FollowVerificationService = require("../services/followVerification.service");
const ResumeWorkflowService = require("../services/resumeWorkflow.service");

class FollowVerificationController {
  async verify(req, res) {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({
          success: false,
          message: "Verification token is required.",
        });
      }

      const result = await FollowVerificationService.verify(token);

      if (!result.verified) {
        return res.status(200).json({
          success: true,
          verified: false,
          message: "User is not following the account.",
        });
      }

      await ResumeWorkflowService.resume(token);

      return res.status(200).json({
        success: true,
        verified: true,
        message: "Workflow resumed successfully.",
      });

    } catch (err) {
      console.error(err);

      return res.status(500).json({
        success: false,
        message: err.message,
      });
    }
  }
}

module.exports = new FollowVerificationController();