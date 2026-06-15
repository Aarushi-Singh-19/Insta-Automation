async function withRetry(fn, retries = 3, delay = 1000) {
  try {
    return await fn();
  } catch (err) {
    if (retries <= 0) throw err;

    await new Promise((r) => setTimeout(r, delay));

    return withRetry(fn, retries - 1, delay * 2);
  }
}

module.exports = { withRetry };