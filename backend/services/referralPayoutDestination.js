const crypto = require("node:crypto");

function key() {
  const raw = process.env.REFERRAL_PAYOUT_ENCRYPTION_KEY || "";
  if (!/^[a-f0-9]{64}$/i.test(raw)) {
    throw new Error("REFERRAL_PAYOUT_ENCRYPTION_KEY must be 64 hex characters.");
  }
  return Buffer.from(raw, "hex");
}

function validateUpi(value) {
  const upi = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (upi.length > 100 || !/^[a-z0-9][a-z0-9._-]{1,63}@[a-z][a-z0-9.-]{1,63}$/.test(upi)) {
    const error = new Error("Enter a valid UPI ID, such as name@bank.");
    error.statusCode = 400;
    throw error;
  }
  return upi;
}

function validateAccountName(value) {
  const name = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  if (name.length < 2 || name.length > 100 || !/^[\p{L}\p{M} .'-]+$/u.test(name)) {
    const error = new Error("Enter the UPI account holder name (2–100 letters).");
    error.statusCode = 400;
    throw error;
  }
  return name;
}

function encryptUpi(upi) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([cipher.update(upi, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString("base64url")).join(".");
}

function decryptUpi(value) {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 3) throw new Error("Invalid encrypted payout destination.");
  const [iv, tag, data] = parts.map((part) => Buffer.from(part, "base64url"));
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

module.exports = { validateUpi, validateAccountName, encryptUpi, decryptUpi };
