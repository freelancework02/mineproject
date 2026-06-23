import { requireEnv } from "./env";

export function hasSendGridServerEnv() {
  return Boolean(process.env.SENDGRID_API_KEY && process.env.SENDGRID_FROM_EMAIL);
}

export async function sendEmail({ to, subject, body, customArgs = {} }) {
  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireEnv("SENDGRID_API_KEY")}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      personalizations: [
        {
          to: [{ email: to }],
          custom_args: customArgs
        }
      ],
      from: {
        email: requireEnv("SENDGRID_FROM_EMAIL"),
        name: process.env.SENDGRID_FROM_NAME || "Marketing CRM"
      },
      subject,
      content: [
        {
          type: "text/plain",
          value: body
        }
      ],
      tracking_settings: {
        click_tracking: { enable: true, enable_text: true },
        open_tracking: { enable: true }
      }
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "SendGrid rejected the email request.");
  }

  return {
    messageId: response.headers.get("x-message-id")
  };
}
