type SendEmailInput = {
  to: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
};

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

function getBaseUrl(): string {
  return process.env.APP_BASE_URL || "http://localhost:5000";
}

async function sendEmail(input: SendEmailInput): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY;
  const fromEmail = process.env.BREVO_FROM_EMAIL;
  const fromName = process.env.BREVO_FROM_NAME || "MapleLedger";

  if (!apiKey || !fromEmail) {
    console.log("[email:fallback]", { to: input.to, subject: input.subject });
    return;
  }

  const payload = {
    sender: { email: fromEmail, name: fromName },
    to: [{ email: input.to }],
    subject: input.subject,
    htmlContent: input.htmlContent,
    textContent: input.textContent || input.subject,
  };

  const res = await fetch(BREVO_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`BREVO_SEND_FAILED ${res.status} ${body}`);
  }
}

export async function sendVerificationEmail(to: string, token: string): Promise<void> {
  const verifyUrl = `${getBaseUrl()}/verify-email?token=${encodeURIComponent(token)}`;
  await sendEmail({
    to,
    subject: "Verify your MapleLedger email",
    htmlContent: `<p>Welcome to MapleLedger.</p><p>Verify your email by clicking this link:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p>`,
    textContent: `Verify your email: ${verifyUrl}`,
  });
}

export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  const resetUrl = `${getBaseUrl()}/reset-password?token=${encodeURIComponent(token)}`;
  await sendEmail({
    to,
    subject: "MapleLedger password reset",
    htmlContent: `<p>We received a password reset request.</p><p>Reset your password here:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>This link expires in 30 minutes.</p>`,
    textContent: `Reset your password: ${resetUrl} (expires in 30 minutes)`,
  });
}
