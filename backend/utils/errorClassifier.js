function classifyError(error) {
  const message = error.message?.toLowerCase() || "";

  if (message.includes("rate limit")) {
    return "RATE_LIMIT";
  }

  if (message.includes("timeout")) {
    return "TIMEOUT";
  }

  if (message.includes("network")) {
    return "NETWORK_ERROR";
  }

  if (message.includes("unauthorized")) {
    return "AUTH_ERROR";
  }

  if (message.includes("duplicate")) {
    return "DUPLICATE_ACTION";
  }

  return "UNKNOWN_ERROR";
}

module.exports = { classifyError };