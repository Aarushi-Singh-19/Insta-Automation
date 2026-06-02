const { Worker } = require("bullmq");
const IORedis = require("ioredis");
const ActionService = require("../services/action.service");

const connection = new IORedis({
  maxRetriesPerRequest: null,
});

const worker = new Worker(
  "action-queue",
  async (job) => {
    const { action, campaign } = job.data;

    console.log("🚀 Processing job:", job.id);

    const campaignId = campaign?._id?.toString();

// simple in-memory throttle (temporary)
global.campaignLastRun = global.campaignLastRun || {};

const lastRun = global.campaignLastRun[campaignId] || 0;
const now = Date.now();

const MIN_GAP = 15000; // 15 sec between actions per campaign

if (now - lastRun < MIN_GAP) {
  const waitTime = MIN_GAP - (now - lastRun);
  console.log("🛑 Rate limit hit. Waiting:", waitTime);

  await new Promise(res => setTimeout(res, waitTime));
}

global.campaignLastRun[campaignId] = Date.now();

const delay = (ms) => new Promise(res => setTimeout(res, ms));

// basic random delay between 3–8 seconds
const randomDelay = Math.floor(Math.random() * 5000) + 3000;

console.log("⏳ Safety delay:", randomDelay);

await delay(randomDelay);

await ActionService.execute(action, campaign);
  },
  { connection }
);

console.log("⚙️ Action Worker Running...");

module.exports = worker;