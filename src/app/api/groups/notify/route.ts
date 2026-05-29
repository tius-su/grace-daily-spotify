import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/server/firebase-admin";
import { sendEmail } from "@/lib/server/email";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { groupId, type, authorName, content, verseRef, postId, postContent } = body;

    if (!groupId || !type || !authorName || !content) {
      return NextResponse.json({ error: "Required fields are missing" }, { status: 400 });
    }

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ error: "Database connection failed" }, { status: 500 });
    }

    // 1. Ambil detail grup
    const groupSnap = await db.collection("devotion_groups").doc(groupId).get();
    if (!groupSnap.exists) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }
    const groupData = groupSnap.data() || {};
    const groupName = groupData.name || groupId;

    // 2. Ambil seluruh anggota grup
    const membersSnap = await db.collection("devotion_groups").doc(groupId).collection("members").get();
    if (membersSnap.empty) {
      return NextResponse.json({ success: true, message: "No members to notify" });
    }

    const emails: string[] = [];
    const userIdsWithNoEmail: string[] = [];

    membersSnap.forEach((doc) => {
      const data = doc.data();
      if (data.isPending) {
        if (data.email) {
          emails.push(data.email);
        }
      } else {
        if (data.email) {
          emails.push(data.email);
        } else {
          // Cadangan jika email tidak disimpan di dokumen member
          userIdsWithNoEmail.push(doc.id);
        }
      }
    });

    // 3. Fallback: Ambil email dari koleksi users jika data email kosong di dokumen member
    if (userIdsWithNoEmail.length > 0) {
      for (const uid of userIdsWithNoEmail) {
        try {
          const userSnap = await db.collection("users").doc(uid).get();
          if (userSnap.exists) {
            const userData = userSnap.data();
            if (userData?.email) {
              emails.push(userData.email);
            }
          }
        } catch (err) {
          console.error(`Failed to fetch email for user ${uid}:`, err);
        }
      }
    }

    // Filter email yang unik dan valid
    const uniqueEmails = Array.from(new Set(emails.map(e => e.trim().toLowerCase()))).filter(Boolean);

    if (uniqueEmails.length === 0) {
      return NextResponse.json({ success: true, message: "No valid member emails found" });
    }

    // 4. Rancang draf email
    let subject = "";
    let htmlContent = "";

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://grace-daily.vercel.app";
    const groupLink = `${appUrl}/grup-renungan?groupId=${groupId}`;

    if (type === "post") {
      subject = `[Grace Daily] Diskusi Baru di Grup: ${groupName}`;
      htmlContent = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #dfd8ca; border-radius: 8px; background-color: #f7f4ee; color: #1f2933;">
          <h2 style="color: #14213d; margin-top: 0; border-bottom: 2px solid #2a6f6f; padding-bottom: 10px;">👥 Diskusi Baru di ${groupName}</h2>
          <p style="font-size: 16px; font-weight: bold; color: #2a6f6f; margin-bottom: 5px;">${authorName} membagikan refleksi baru:</p>
          <div style="background-color: #ffffff; padding: 15px; border-radius: 6px; border-left: 4px solid #f4a261; margin-bottom: 20px; font-style: italic;">
            "${content}"
          </div>
          ${verseRef ? `<p style="font-size: 14px; margin-bottom: 20px;"><strong>Tautan Ayat:</strong> <a href="${appUrl}/alkitab?search=${encodeURIComponent(verseRef)}" style="color: #2a6f6f; font-weight: bold; text-decoration: none;">${verseRef}</a></p>` : ""}
          <div style="text-align: center; margin-top: 25px;">
            <a href="${groupLink}" style="background-color: #14213d; color: #ffffff; text-decoration: none; padding: 12px 24px; font-weight: bold; border-radius: 5px; display: inline-block;">Ikut Berdiskusi</a>
          </div>
          <hr style="border: 0; border-top: 1px solid #dfd8ca; margin: 30px 0 15px 0;" />
          <p style="font-size: 11px; color: #52606d; text-align: center;">Email ini dikirim otomatis kepada seluruh anggota grup ${groupName} di Grace Daily.</p>
        </div>
      `;
    } else if (type === "comment") {
      subject = `[Grace Daily] Komentar Baru di Diskusi ${groupName}`;
      htmlContent = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #dfd8ca; border-radius: 8px; background-color: #f7f4ee; color: #1f2933;">
          <h2 style="color: #14213d; margin-top: 0; border-bottom: 2px solid #2a6f6f; padding-bottom: 10px;">💬 Komentar Baru di ${groupName}</h2>
          <p style="font-size: 14px; color: #52606d; margin-bottom: 15px;">Konteks kiriman diskusi:</p>
          <div style="background-color: #ffffff; padding: 10px 15px; border-radius: 6px; font-size: 13px; color: #52606d; margin-bottom: 20px; border-left: 2px solid #dfd8ca;">
            "${postContent || "Refleksi diskusi..."}"
          </div>
          <p style="font-size: 16px; font-weight: bold; color: #2a6f6f; margin-bottom: 5px;">${authorName} menanggapi:</p>
          <div style="background-color: #ffffff; padding: 15px; border-radius: 6px; border-left: 4px solid #ffd166; margin-bottom: 20px; font-style: italic;">
            "${content}"
          </div>
          <div style="text-align: center; margin-top: 25px;">
            <a href="${groupLink}" style="background-color: #14213d; color: #ffffff; text-decoration: none; padding: 12px 24px; font-weight: bold; border-radius: 5px; display: inline-block;">Lihat Percakapan Lengkap</a>
          </div>
          <hr style="border: 0; border-top: 1px solid #dfd8ca; margin: 30px 0 15px 0;" />
          <p style="font-size: 11px; color: #52606d; text-align: center;">Email ini dikirim otomatis kepada seluruh anggota grup ${groupName} di Grace Daily.</p>
        </div>
      `;
    }

    // 5. Kirim email dengan BCC ke seluruh anggota
    const emailSent = await sendEmail({
      bcc: uniqueEmails,
      subject: subject,
      html: htmlContent,
    });

    return NextResponse.json({
      success: emailSent,
      recipientCount: uniqueEmails.length,
      message: emailSent ? "Notifications sent successfully" : "Failed to send emails via SMTP",
    });
  } catch (error: any) {
    console.error("[Groups Notify API Error]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
