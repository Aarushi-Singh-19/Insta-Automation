// Cloudflare-compatible Instagram Graph transport. This module never sends
// anything unless a caller explicitly invokes a function with an access token.
// Authorization, quotas, deduplication and Follow Gate must be enforced upstream.
const GRAPH = "https://graph.instagram.com/v25.0";
const digits = value => /^\d+$/.test(String(value ?? ""));
function requiredText(value) {
  if (typeof value !== "string" || !value.trim() || value.length > 2000) throw new TypeError("INVALID_MESSAGE");
  return value;
}
function validateToken(token) {
  if (typeof token !== "string" || !token.trim()) throw new TypeError("INSTAGRAM_TOKEN_REQUIRED");
}
function messagePayload(message, buttons = []) {
  requiredText(message);
  if (!Array.isArray(buttons) || buttons.length > 3) throw new TypeError("INVALID_BUTTONS");
  if (!buttons.length) return { text: message };
  return { attachment: { type: "template", payload: {
    template_type: "button", text: message,
    buttons: buttons.map(button => {
      if (!button || typeof button.title !== "string" || !button.title.trim() ||
          button.title.trim().length > 20 || typeof button.url !== "string") throw new TypeError("INVALID_BUTTON");
      let url;
      try { url = new URL(button.url); } catch { throw new TypeError("INVALID_BUTTON_URL"); }
      if (url.protocol !== "https:" || !url.hostname) throw new TypeError("INVALID_BUTTON_URL");
      return { type: "web_url", title: button.title.trim(), url: url.toString() };
    })
  } } };
}
async function postGraph(path, accessToken, body, fetchImpl = fetch) {
  validateToken(accessToken);
  if (typeof fetchImpl !== "function") throw new TypeError("FETCH_REQUIRED");
  const response = await fetchImpl(GRAPH + path, {
    method: "POST",
    headers: { Authorization: "Bearer " + accessToken, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  // Never return raw Graph error responses: they may contain sensitive details.
  if (!response?.ok) {
    const error = new Error("INSTAGRAM_GRAPH_REQUEST_FAILED");
    error.status = response?.status || 502;
    throw error;
  }
  const data = await response.json();
  if (!data || typeof data !== "object" || data.error) throw new Error("INSTAGRAM_GRAPH_INVALID_RESPONSE");
  return data;
}
export async function replyToInstagramComment({ accessToken, commentId, message, fetchImpl }) {
  if (!digits(commentId)) throw new TypeError("INVALID_COMMENT_ID");
  requiredText(message);
  validateToken(accessToken);
  // Existing Render implementation posts a form/query payload; use form encoding
  // while keeping credentials out of the URL and logs.
  const response = await (fetchImpl || fetch)(GRAPH + "/" + commentId + "/replies", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ message, access_token: accessToken }).toString()
  });
  if (!response?.ok) throw new Error("INSTAGRAM_REPLY_FAILED");
  const data = await response.json();
  if (!data || data.error || !data.id) throw new Error("INSTAGRAM_REPLY_NOT_CONFIRMED");
  return { id: String(data.id) };
}
export async function sendInstagramDM({ accessToken, instagramBusinessId, commentId, recipientId, message, buttons = [], fetchImpl }) {
  if (!digits(instagramBusinessId)) throw new TypeError("INVALID_INSTAGRAM_ACCOUNT");
  const recipient = commentId ? { comment_id: String(commentId) } :
    recipientId ? { id: String(recipientId) } : null;
  if (!recipient || (commentId && !digits(commentId)) || (!commentId && !digits(recipientId))) {
    throw new TypeError("INVALID_DM_RECIPIENT");
  }
  const payload = { recipient, message: messagePayload(message, buttons) };
  const data = await postGraph("/" + instagramBusinessId + "/messages", accessToken, payload, fetchImpl);
  if (!data.message_id && !data.id) throw new Error("INSTAGRAM_DM_NOT_CONFIRMED");
  return { messageId: String(data.message_id || data.id) };
}
export async function getInstagramFollowerStatus({ accessToken, instagramScopedUserId, fetchImpl }) {
  if (!digits(instagramScopedUserId)) throw new TypeError("INVALID_INSTAGRAM_USER");
  validateToken(accessToken);
  const url = GRAPH + "/" + instagramScopedUserId + "?fields=is_user_follow_business";
  const response = await (fetchImpl || fetch)(url, { headers: { Authorization: "Bearer " + accessToken } });
  if (!response?.ok) throw new Error("INSTAGRAM_FOLLOW_STATUS_UNAVAILABLE");
  const data = await response.json();
  if (typeof data?.is_user_follow_business !== "boolean") throw new Error("INSTAGRAM_FOLLOW_STATUS_UNVERIFIED");
  return { followsBusiness: data.is_user_follow_business };
}
