// Converts a resolved TriggerDM campaign/rule into a side-effect-free action
// specification. No Graph requests, database writes, or quota consumption.
const text = value => typeof value === "string" ? value.trim() : "";
export function buildCommentActionSpec({ comment, campaign, rule }) {
  if (!comment || !campaign || !rule || !/^\d+$/.test(String(comment.eventId || "")) ||
      !/^\d+$/.test(String(comment.entryId || "")) ||
      campaign.status !== "active" || rule.isActive !== true) {
    return { ready: false, reason: "INVALID_OR_INACTIVE_CONTEXT" };
  }
  const settings = campaign.settings || {};
  const replyEnabled = settings.enableReply !== false;
  const dmEnabled = settings.enableDM !== false;
  const replies = Array.isArray(rule.replies) ? rule.replies.map(text).filter(Boolean) : [];
  // Deterministic reply selection avoids differing messages on retries.
  const replyIndex = replies.length ? [...String(comment.eventId)].reduce((sum, c) => sum + c.charCodeAt(0), 0) % replies.length : 0;
  const reply = replyEnabled ? replies[replyIndex] || null : null;
  const dmMessage = dmEnabled ? text(settings.dmMessage) : "";
  const buttons = Array.isArray(settings.dmButtons) ? settings.dmButtons : [];
  const followGate = campaign.gate?.gateType === "FOLLOW" && campaign.gate?.status === "enabled";
  if (followGate && dmEnabled && !dmMessage) return { ready: false, reason: "FOLLOW_GATE_DM_MISSING" };
  if (dmEnabled && !dmMessage && !reply) return { ready: false, reason: "NO_CONFIGURED_MESSAGE" };
  if (!reply && !dmEnabled) return { ready: false, reason: "NO_ENABLED_ACTION" };
  if (dmEnabled && !dmMessage) return { ready: false, reason: "DM_MESSAGE_MISSING" };
  if (buttons.length > 3 || buttons.some(b => !b || typeof b.title !== "string" ||
      !b.title.trim() || b.title.trim().length > 20 ||
      typeof b.url !== "string" || !b.url.startsWith("https://"))) {
    return { ready: false, reason: "INVALID_DM_BUTTONS" };
  }
  return { ready: true, spec: {
    eventId: String(comment.eventId), instagramBusinessId: String(comment.entryId),
    reply: reply ? { type: "reply", message: reply } : null,
    dm: dmEnabled ? { type: "send_dm", message: dmMessage, buttons } : null,
    followGateRequired: followGate && dmEnabled,
    requiresAtomicQuotaReservation: dmEnabled,
    authorized: false
  } };
}
