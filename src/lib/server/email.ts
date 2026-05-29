import nodemailer from "nodemailer";

const smtpHost = process.env.SMTP_HOST;
const smtpPort = Number(process.env.SMTP_PORT) || 587;
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASSWORD;
const smtpFrom = process.env.SMTP_FROM || "no-reply@gracedaily.com";

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (transporter) return transporter;

  if (!smtpHost || !smtpUser || !smtpPass) {
    console.warn(
      "[Email Server] SMTP tidak dikonfigurasi lengkap (SMTP_HOST, SMTP_USER, SMTP_PASSWORD). Pengiriman email dinonaktifkan."
    );
    return null;
  }

  transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465, // true untuk port 465, false untuk port lain
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  return transporter;
}

export async function sendEmail({
  to,
  bcc,
  subject,
  html,
}: {
  to?: string | string[];
  bcc?: string | string[];
  subject: string;
  html: string;
}): Promise<boolean> {
  const mailTransporter = getTransporter();
  if (!mailTransporter) {
    return false;
  }

  try {
    const info = await mailTransporter.sendMail({
      from: `"Grace Daily" <${smtpFrom}>`,
      to: to || smtpFrom, // Default kirim ke pengirim jika to kosong
      bcc: bcc, // Menggunakan BCC agar email anggota lain tidak saling terlihat
      subject: subject,
      html: html,
    });

    console.log(`[Email Server] Email terkirim ke: ${info.accepted.join(", ")}. MessageId: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error("[Email Server] Gagal mengirim email:", error);
    return false;
  }
}
