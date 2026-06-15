const { executeInstagramAction } = require("../executors/instagramExecutor");

async function processJob(job) {
  try {
    const result = await executeInstagramAction(job);

    return {
      success: true,
      result,
    };
  } catch (err) {
    console.error("Job failed:", err.message);

    throw err; // important for BullMQ retry system
  }
}

module.exports = { processJob };