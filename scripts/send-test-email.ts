import fs from 'fs';
import path from 'path';

// Load .env.local manually to simulate project runtime
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.\-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let value = match[2] || '';
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.substring(1, value.length - 1);
      } else if (value.startsWith("'") && value.endsWith("'")) {
        value = value.substring(1, value.length - 1);
      }
      process.env[match[1]] = value;
    }
  });
}

async function run() {
  const { sendEmail } = await import("../src/lib/server/email");

  const args = process.argv.slice(2);
  const recipient = args[0] || process.env.SMTP_FROM || 'tiuss168@gmail.com';

  console.log("=========================================");
  console.log("Grace Daily - Test Email Sending via Resend");
  console.log("=========================================");
  console.log("SMTP_FROM:", process.env.SMTP_FROM);
  console.log("RESEND_API_KEY:", process.env.RESEND_API_KEY ? "Configured" : "NOT Configured");
  console.log("Target Recipient:", recipient);
  console.log("-----------------------------------------");

  try {
    console.log("Sending test email...");
    const success = await sendEmail({
      to: recipient,
      subject: 'Grace Daily - Uji Coba Pengiriman Resend',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #dfd8ca; border-radius: 8px; background-color: #f7f4ee;">
          <h2 style="color: #2a6f6f; border-bottom: 2px solid #2a6f6f; padding-bottom: 10px; margin-top: 0;">📧 Uji Coba Integrasi Resend</h2>
          <p>Halo, ini adalah email uji coba untuk memverifikasi bahwa pengiriman email via Resend telah berjalan normal.</p>
          <p>Sistem berhasil mengalihkan pengirim (sender) ke domain terverifikasi Anda untuk menghindari penolakan dari server Resend.</p>
          <hr style="border: 0; border-top: 1px solid #dfd8ca; margin: 20px 0;" />
          <p style="font-size: 11px; color: #52606d; text-align: center;">Grace Daily System Test</p>
        </div>
      `
    });

    if (success) {
      console.log("✅ Sukses! Email berhasil dikirim.");
    } else {
      console.error("❌ Gagal mengirim email. Silakan periksa log di atas atau dashboard Resend.");
    }
  } catch (error) {
    console.error("❌ Terjadi kesalahan fatal:", error);
  }
}

run();
