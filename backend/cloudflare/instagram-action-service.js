// Fetch-based Instagram action service for Cloudflare Workers.
// Does not import Mongoose, BullMQ or Node HTTP libraries.
const GRAPH_VERSION = "v23.0";
function requireValue(value, name) {
  if (typeof value !== "string" || !value.trim()) throw new TypeError(name + " required");
  return value;
}
export function createInstagramActionService({ fetchImpl = fetch, graphBase = "https://graph.instagram.com" } = {}) {
  return {
    async execute(action, context = {}) {
      if (!["reply", "send_dm"].includes(action?.type)) throw new TypeError("Unsupported action type");
      const account = context.instagramAccount;
      if (!account || account.status !== "active") throw new Error("NO_ACTIVE_INSTAGRAM_ACCOUNT");
      const message = requireValue(action.message, "message");
      let path, payload, token;
      if (action.type === "reply") {
        token = requireValue(account.accessToken || account.pageAccessToken, "accessToken");
        path = encodeURIComponent(requireValue(String(context.commentId || ""), "commentId")) + "/replies";
        payload = { message };
      } else {
        token = requireValue(account.pageAccessToken || account.accessToken, "accessToken");
        path = encodeURIComponent(requireValue(account.instagramBusinessId, "instagramBusinessId")) + "/messages";
        const recipient = context.isGateResume
          ? { id: requireValue(action.recipientId, "recipientId") }
          : { comment_id: requireValue(String(context.commentId || ""), "commentId") };
        payload = { recipient, message: { text: message } };
      }
      const response = await fetchImpl(graphBase.replace(/\\/$/, "") + "/" + GRAPH_VERSION + "/" + path, {
        method: "POST",
        headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.error) {
        const err = new Error("INSTAGRAM_GRAPH_API_FAILED_" + response.status);
        err.status = response.status;
        throw err;
      }
      return result;
    },
  };
}
