import { ObjectId } from "mongodb";
import { validateStagingMongoConfig } from "./staging-mongodb.js";

// Native Cloudflare /api/auth/me implementation, isolated to staging.
// Mirrors the existing Express response while never returning credential fields.
export async function getStagingCurrentUser({ env, MongoClient, authenticatedUserId }) {
  const { uri, dbName } = validateStagingMongoConfig(env);
  if (typeof authenticatedUserId !== "string" || !/^[a-f0-9]{24}$/i.test(authenticatedUserId)) {
    throw new TypeError("AUTHENTICATED_USER_REQUIRED");
  }
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 1 });
  try {
    await client.connect();
    const user = await client.db(dbName).collection("users").findOne(
      { _id: new ObjectId(authenticatedUserId) },
      { projection: { password: 0, accessToken: 0, passwordResetTokenHash: 0,
        passwordResetExpires: 0, razorpaySubscriptionId: 0, razorpayCustomerId: 0 } }
    );
    if (!user) return null;
    const now = Date.now();
    const result = { ...user, _id: String(user._id) };
    if (result.subscriptionStatus === "active" &&
        (!result.planEndDate || new Date(result.planEndDate).getTime() <= now)) {
      result.subscriptionStatus = "expired";
    }
    if (result.subscriptionStatus === "trial" && result.trialEndDate &&
        new Date(result.trialEndDate).getTime() <= now) {
      result.subscriptionStatus = "expired";
    }
    return result;
  } finally {
    await client.close();
  }
}
