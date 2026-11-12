import test from "node:test";
import assert from "node:assert/strict";
import { mapApprovedStagingWebhookEvents } from "./staging-webhook-account-map.js";

const env = {
  STAGING_SEND_INSTAGRAM_BUSINESS_ID: "27759473043638911",
  STAGING_WEBHOOK_ENTRY_ID: "17841467727075219"
};
test("maps only the explicitly allowed webhook owner to the Graph account", () => {
  const result = mapApprovedStagingWebhookEvents({
    comments: [
      { entryId: "17841467727075219", eventId: "1", postId: "18086476910566599" },
      { entryId: "999999999999", eventId: "2" }
    ],
    postbacks: [{ entryId: "17841467727075219", senderId: "3" }]
  }, env);
  assert.equal(result.comments.length, 1);
  assert.equal(result.comments[0].entryId, "27759473043638911");
  assert.equal(result.comments[0].webhookEntryId, "17841467727075219");
  assert.equal(result.postbacks[0].entryId, "27759473043638911");
});
test("missing allowlist never imports unrelated accounts", () => {
  assert.throws(() => mapApprovedStagingWebhookEvents({ comments: [] }, {}), /STAGING_ACCOUNT_MAPPING_REQUIRED/);
});
