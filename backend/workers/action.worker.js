const worker = new Worker(
  "action-queue",
  async (job) => {
    return await ActionService.execute(job.data);
  },
  {
    connection,

    // 🔁 RETRY CONFIG
    attempts: 5, // total tries

    backoff: {
      type: "exponential",
      delay: 2000, // 2s base delay → grows exponentially
    },

    removeOnComplete: {
      count: 100, // keep last 100 successful jobs
    },

    removeOnFail: false, // IMPORTANT for debugging + DLQ later
  }
);