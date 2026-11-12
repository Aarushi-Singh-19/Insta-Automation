// Construct a deterministic, session-bound Follow Gate prompt. No Graph side effects.
export function buildFollowPrompt({ sessionId, profileUrl }) {
  if (typeof sessionId !== "string" || !/^follow:comment:[0-9]+:[0-9]+$/.test(sessionId)) {
    throw new TypeError("INVALID_FOLLOW_SESSION");
  }
  let url;
  try { url = new URL(profileUrl); } catch { throw new TypeError("INVALID_PROFILE_URL"); }
  if (url.protocol !== "https:" || !["instagram.com", "www.instagram.com"].includes(url.hostname) ||
      !/^\/[A-Za-z0-9._]+\/?$/.test(url.pathname) || url.username || url.password || url.search || url.hash) {
    throw new TypeError("INVALID_PROFILE_URL");
  }
  return {
    text: "Follow our Instagram account, then tap I've Followed to continue.",
    buttons: [
      { type: "web_url", title: "Visit Profile", url: url.toString() },
      { type: "postback", title: "I've Followed", payload: "VERIFY:" + sessionId }
    ]
  };
}
