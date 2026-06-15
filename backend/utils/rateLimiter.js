const lastCallMap = new Map();

const MIN_DELAY_MS = 1500; // 1.5s between actions per IG account

async function rateLimit(accountId) {
  const now = Date.now();
  const lastCall = lastCallMap.get(accountId) || 0;

  const diff = now - lastCall;

  if (diff < MIN_DELAY_MS) {
    await new Promise((resolve) =>
      setTimeout(resolve, MIN_DELAY_MS - diff)
    );
  }

  lastCallMap.set(accountId, Date.now());
}

module.exports = { rateLimit };