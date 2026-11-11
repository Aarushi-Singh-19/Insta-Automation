// Cloudflare-compatible Graph API action service, matching TriggerDM's live API contract.
const GRAPH_VERSION = "v25.0";
const required = (v, name) => { if (typeof v !== "string" || !v.trim()) throw new TypeError(name + " required"); return v; };
export function createInstagramActionService({ fetchImpl = fetch, graphBase = "https://graph.instagram.com" } = {}) {
  return {
    async execute(action, context = {}) {
      if (!["reply", "send_dm"].includes(action?.type)) throw new TypeError("Unsupported action type");
      const account = context.instagramAccount;
      if (!account || account.status !== "active") throw new Error("NO_ACTIVE_INSTAGRAM_ACCOUNT");
      const message = required(action.message, "message");
      const base = graphBase.replace(/\/$/, "") + "/" + GRAPH_VERSION + "/";
      let url, payload, token;
      if (action.type === "reply") {
        token = required(account.accessToken || account.pageAccessToken, "accessToken");
        url = base + encodeURIComponent(required(String(context.commentId || ""), "commentId")) + "/replies";
        payload = new URLSearchParams({ message });
      } else {
        token = required(account.pageAccessToken || account.accessToken, "accessToken");
        url = base + encodeURIComponent(required(account.instagramBusinessId, "instagramBusinessId")) + "/messages";
        const recipient = context.isGateResume
          ? { id: required(action.recipientId, "recipientId") }
          : { comment_id: required(String(context.commentId || ""), "commentId") };
        const buttons = Array.isArray(action.buttons) ? action.buttons.slice(0, 3).filter(b =>
          typeof b?.title === "string" && b.title.trim().length > 0 && b.title.trim().length <= 20 &&
          typeof b?.url === "string" && b.url.trim().toLowerCase().startsWith("https://")) : [];
        const outgoing = buttons.length ? { attachment: { type: "template", payload: {
          template_type: "button", text: message,
          buttons: buttons.map(b => ({ type: "web_url", title: b.title.trim(), url: b.url.trim() }))
        } } } : { text: message };
        payload = JSON.stringify({ recipient, message: outgoing });
      }
      // Keep access tokens out of query strings and application logs.
      const response = await fetchImpl(url, { method: "POST",
        headers: { Authorization: "Bearer " + token,
          "Content-Type": action.type === "reply" ? "application/x-www-form-urlencoded" : "application/json" },
        body: payload });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.error) throw new Error("INSTAGRAM_GRAPH_API_FAILED_" + response.status);
      return result;
    },
  };
}
