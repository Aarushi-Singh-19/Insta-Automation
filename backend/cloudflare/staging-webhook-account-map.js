// Only map an explicitly approved Meta webhook owner to its Graph API account.
// The HMAC is verified against the ORIGINAL bytes before this normalization.
// A mismatched or missing configuration never admits another account.
export function mapApprovedStagingWebhookEvents(events, env) {
  const graphId = String(env?.STAGING_SEND_INSTAGRAM_BUSINESS_ID || "");
  const webhookId = String(env?.STAGING_WEBHOOK_ENTRY_ID || graphId);
  if (!/^\d+$/.test(graphId) || !/^\d+$/.test(webhookId)) {
    throw new Error("STAGING_ACCOUNT_MAPPING_REQUIRED");
  }
  const map = rows => rows
    .filter(event => String(event.entryId) === webhookId)
    .map(event => ({ ...event, webhookEntryId: webhookId, entryId: graphId }));
  return { comments: map(events.comments || []), postbacks: map(events.postbacks || []) };
}
