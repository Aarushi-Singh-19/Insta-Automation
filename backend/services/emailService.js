const sendEmail = async ({ to, subject, html }) => {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    console.warn("Email not sent: configure RESEND_API_KEY and EMAIL_FROM in the backend environment.");
    return false;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });

  if (!response.ok) {
    const details = await response.text();
    console.error("Email provider rejected message:", response.status, details);
    return false;
  }

  return true;
};

const sendWelcomeEmail = ({ name, email, trialEndDate }) => {
  const appUrl = (process.env.APP_URL || "https://triggerdm.in").replace(/\/$/, "");
  const formattedEnd = new Date(trialEndDate).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return sendEmail({
    to: email,
    subject: "Welcome to TriggerDM — your 7-day trial starts now",
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#1f2937">
      <h1 style="color:#9333ea">Welcome to TriggerDM, ${escapeHtml(name || "there")}!</h1>
      <p>Your account is ready. Your <strong>7-day free trial</strong> has started and you do not need to enter payment details during the trial.</p>
      <p>Your trial is scheduled to end on <strong>${formattedEnd}</strong>.</p>
      <p><a href="${appUrl}/dashboard" style="display:inline-block;background:#9333ea;color:white;padding:12px 20px;border-radius:8px;text-decoration:none">Open TriggerDM</a></p>
      <p>Need help? Reply to this email and our team will help.</p>
      <p>— The TriggerDM team</p>
    </div>`,
  });
};

const sendPasswordResetEmail = ({ email, resetUrl }) =>
  sendEmail({
    to: email,
    subject: "Reset your TriggerDM password",
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#1f2937">
      <h1 style="color:#9333ea">Password reset</h1>
      <p>We received a request to reset your TriggerDM password. This link expires in 30 minutes and can be used once.</p>
      <p><a href="${resetUrl}" style="display:inline-block;background:#9333ea;color:white;padding:12px 20px;border-radius:8px;text-decoration:none">Reset password</a></p>
      <p>If you did not request this, you can ignore this email.</p>
    </div>`,
  });

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

module.exports = { sendWelcomeEmail, sendPasswordResetEmail };