import { ObjectId } from "mongodb";
import bcrypt from "bcryptjs";
import { validateStagingMongoConfig } from "./staging-mongodb.js";

const failure = (status, message) => ({ status, body: { message } });
const referralCode = () => Array.from(crypto.getRandomValues(new Uint8Array(5)), b => b.toString(16).padStart(2, "0")).join("").toUpperCase();

export async function signupStagingUser({ env, MongoClient, name, email, password, referralCode: suppliedCode }) {
  const { uri, dbName } = validateStagingMongoConfig(env);
  if (typeof name !== "string" || typeof email !== "string" || typeof password !== "string" ||
      !name.trim() || !email.trim() || !password) return failure(400, "All fields required");
  const normalizedEmail = email.trim().toLowerCase();
  if (name.trim().length > 120 || normalizedEmail.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) ||
      password.length > 1024) return failure(400, "Invalid signup details");
  if (typeof suppliedCode !== "undefined" && typeof suppliedCode !== "string") return failure(400, "Invalid referral code.");
  const refCode = String(suppliedCode || "").trim().toUpperCase();
  if (refCode && !/^[A-Z0-9]{1,64}$/.test(refCode)) return failure(400, "Invalid referral code.");
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 1 });
  try {
    await client.connect();
    const users = client.db(dbName).collection("users");
    // Database-enforced uniqueness protects against simultaneous signup requests.
    await users.createIndex({ email: 1 }, { unique: true });
    if (await users.findOne({ email: normalizedEmail }, { projection: { _id: 1 } })) return failure(400, "User already exists");
    const referrer = refCode ? await users.findOne({ referralCode: refCode }, { projection: { _id: 1 } }) : null;
    if (refCode && !referrer) return failure(400, "Invalid referral code.");
    const hashedPassword = await bcrypt.hash(password, 10);
    const now = new Date();
    const trialEndDate = new Date(now.getTime() + 7 * 86400000);
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = referralCode();
      // Check collision even when legacy staging data lacks a referralCode index.
      if (await users.findOne({ referralCode: code }, { projection: { _id: 1 } })) continue;
      const user = { _id: new ObjectId(), name: name.trim(), email: normalizedEmail, password: hashedPassword,
        referralCode: code, referredBy: referrer?._id || null, subscriptionStatus: "trial",
        currentPlan: "trial", trialStartDate: now, trialEndDate, planEndDate: null,
        instagramConnected: false, createdAt: now, updatedAt: now };
      try {
        await users.insertOne(user);
        const { password: omitted, ...safeUser } = user;
        return { status: 201, body: { message: "User created successfully", user: { ...safeUser, _id: String(user._id) } } };
      } catch (error) {
        if (error?.code !== 11000) throw error;
        if (await users.findOne({ email: normalizedEmail }, { projection: { _id: 1 } })) return failure(400, "User already exists");
      }
    }
    return failure(503, "Unable to create account. Please retry later.");
  } finally { await client.close(); }
}
