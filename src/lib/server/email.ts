import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY;
const smtpFrom = process.env.SMTP_FROM || "renungan@gracedaily.my.id";

let resendInstance: Resend | null = null;

function getResend() {
  if (resendInstance) return resendInstance;

  if (!resendApiKey) {
    console.warn(
      "[Email Server] RESEND_API_KEY tidak dikonfigurasi. Pengiriman email dinonaktifkan."
    );
    return null;
  }

  resendInstance = new Resend(resendApiKey);
  return resendInstance;
}

function getSenderEmail(): string {
  if (process.env.RESEND_FROM) {
    return process.env.RESEND_FROM;
  }
  const smtpFrom = process.env.SMTP_FROM;
  if (smtpFrom) {
    const lower = smtpFrom.toLowerCase();
    const publicDomains = ["@gmail.com", "@googlemail.com", "@yahoo.com", "@outlook.com", "@hotmail.com", "@icloud.com", "@aol.com", "@msn.com"];
    const isPublic = publicDomains.some(domain => lower.endsWith(domain));
    if (!isPublic) {
      return smtpFrom;
    }
  }
  return "renungan@gracedaily.my.id";
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
  const resend = getResend();
  if (!resend) {
    return false;
  }

  try {
    const sender = getSenderEmail();
    const from = `Grace Daily <${sender}>`;
    
    // Resend requires a valid 'to' recipient. If empty, fallback to the sender email
    const toField = to ? (Array.isArray(to) ? to : [to]) : [sender];
    const bccField = bcc ? (Array.isArray(bcc) ? bcc : [bcc]) : undefined;

    const response = await resend.emails.send({
      from,
      to: toField,
      bcc: bccField,
      subject,
      html,
    });

    if (response.error) {
      console.error("[Email Server] Gagal mengirim email via Resend:", response.error);
      return false;
    }

    console.log(`[Email Server] Email terkirim via Resend. ID: ${response.data?.id}`);
    return true;
  } catch (error) {
    console.error("[Email Server] Gagal mengirim email via Resend:", error);
    return false;
  }
}

export async function sendNewsletterBlast({
  subject,
  htmlTemplate,
  preferenceKey,
}: {
  subject: string;
  htmlTemplate: string;
  preferenceKey: "devotion" | "article";
}): Promise<{ sentCount: number; failedCount: number }> {
  const resend = getResend();
  if (!resend) {
    return { sentCount: 0, failedCount: 0 };
  }

  const { getAdminDb } = await import("./firebase-admin");
  const db = getAdminDb();
  if (!db) {
    console.warn("[Email Server] Database tidak tersedia untuk memproses blast.");
    return { sentCount: 0, failedCount: 0 };
  }

  try {
    const crypto = await import("node:crypto");
    const emails: string[] = [];
    const tokenMap = new Map<string, string>();

    // 1. Fetch registered users who might want devotions/articles
    try {
      const usersSnap = await db.collection("users").get();
      usersSnap.forEach((doc) => {
        const email = doc.data()?.email;
        if (email && typeof email === "string" && email.trim() !== "") {
          emails.push(email.trim().toLowerCase());
        }
      });
    } catch (err) {
      console.warn("[Email Server] Gagal memuat email user registered:", err);
    }

    // 2. Fetch public subscribers who have enabled this category and are active
    try {
      const fieldName = preferenceKey === "devotion" ? "devotionEnabled" : "articleEnabled";
      const subSnap = await db
        .collection("emailSubscribers")
        .where("active", "==", true)
        .where(fieldName, "==", true)
        .get();

      subSnap.forEach((doc) => {
        const data = doc.data();
        const email = data.email;
        if (email && typeof email === "string" && email.trim() !== "") {
          const lowerEmail = email.trim().toLowerCase();
          emails.push(lowerEmail);
          if (data.unsubscribeToken) {
            tokenMap.set(lowerEmail, data.unsubscribeToken);
          }
        }
      });
    } catch (err) {
      console.warn("[Email Server] Gagal memuat emailSubscribers:", err);
    }

    const uniqueEmails = Array.from(new Set(emails));
    if (uniqueEmails.length === 0) {
      console.log("[Email Server] Tidak ada penerima email ditemukan.");
      return { sentCount: 0, failedCount: 0 };
    }

    // 3. For any recipient who doesn't have an unsubscribe token, auto-create one
    // So that they can unsubscribe easily.
    const batch = db.batch();
    let batchOperations = 0;

    for (const email of uniqueEmails) {
      if (!tokenMap.has(email)) {
        const token = crypto.randomBytes(32).toString("hex");
        const docRef = db.collection("emailSubscribers").doc(email);
        
        batch.set(docRef, {
          email,
          devotionEnabled: preferenceKey === "devotion",
          articleEnabled: preferenceKey === "article",
          active: true,
          unsubscribeToken: token,
          createdAt: new Date(),
          updatedAt: new Date(),
        }, { merge: true });

        tokenMap.set(email, token);
        batchOperations++;
      }
    }

    if (batchOperations > 0) {
      await batch.commit();
      console.log(`[Email Server] Membuat ${batchOperations} record subscriber baru untuk auto-unsubscribe token.`);
    }

    // 4. Send email to each recipient sequentially with a delay to avoid rate limits (Resend free tier limit is 10/sec)
    let sentCount = 0;
    let failedCount = 0;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.gracedaily.my.id";

    for (const email of uniqueEmails) {
      const token = tokenMap.get(email) || "";
      const unsubscribeUrl = `${appUrl}/unsubscribe?token=${token}`;
      
      const footerUnsub = `
        <hr style="border: 0; border-top: 1px solid #E5D5C0; margin-top: 30px; margin-bottom: 20px;" />
        <p style="font-size: 11px; text-align: center; color: #8F8476; margin-top: 20px; font-family: sans-serif;">
          Anda menerima email ini dari Grace Daily.<br/>
          <a href="${unsubscribeUrl}" style="color: #9C7C54; text-decoration: underline;">Berhenti Berlangganan</a> | 
          <a href="${appUrl}/notification-preferences?token=${token}" style="color: #9C7C54; text-decoration: underline;">Atur Preferensi</a>
        </p>
      `;

      const personalizedHtml = htmlTemplate.includes("<!-- UNSUBSCRIBE_LINK_PLACEHOLDER -->")
        ? htmlTemplate.replace("<!-- UNSUBSCRIBE_LINK_PLACEHOLDER -->", footerUnsub)
        : htmlTemplate + footerUnsub;

      const success = await sendEmail({
        to: email,
        subject,
        html: personalizedHtml,
      });

      if (success) {
        sentCount++;
      } else {
        failedCount++;
      }

      // Delay 150ms between sends to respect Resend's free tier rate limit
      await new Promise((resolve) => setTimeout(resolve, 150));
    }

    console.log(`[Email Server] Selesai mengirim newsletter blast. Terkirim: ${sentCount}, Gagal: ${failedCount}`);
    return { sentCount, failedCount };
  } catch (error) {
    console.error("[Email Server] Kesalahan fatal saat memproses blast:", error);
    return { sentCount: 0, failedCount: 0 };
  }
}


