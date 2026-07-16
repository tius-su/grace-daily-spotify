import { getAdminDb, getAdminMessaging } from "./firebase-admin";

export type PushPreferenceType = "devotion" | "article" | "reminder" | "update" | "general";

interface SendPushParams {
  preferenceKey: PushPreferenceType;
  title: string;
  body: string;
  url?: string;
}

export async function sendPushNotification({
  preferenceKey,
  title,
  body,
  url,
}: SendPushParams): Promise<{ success: boolean; sentCount: number; failedCount: number }> {
  const db = getAdminDb();
  const messaging = getAdminMessaging();

  if (!db || !messaging) {
    console.error("Firebase Admin or Messaging not initialized.");
    return { success: false, sentCount: 0, failedCount: 0 };
  }

  try {
    console.log(`Push Notification: Fetching tokens targeting preference: ${preferenceKey}`);
    const snapshot = await db.collection("fcm_tokens").get();
    const tokens: string[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      const prefs = data.preferences || {};
      
      // Default to true if preference is undefined/unset
      const isEnabled = prefs[preferenceKey] !== false;
      
      if (isEnabled && data.token) {
        tokens.push(data.token);
      }
    });

    if (tokens.length === 0) {
      console.log(`Push Notification: No registered tokens found for preference '${preferenceKey}'.`);
      return { success: true, sentCount: 0, failedCount: 0 };
    }

    console.log(`Push Notification: Broadcasting to ${tokens.length} target tokens...`);

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://www.gracedaily.my.id").replace(/\/$/, "");
    const clickAction = url?.startsWith("http") ? url : `${appUrl}${url || "/"}`;
    const messages = tokens.map((token) => ({
      token,
      notification: {
        title,
        body,
      },
      data: {
        click_action: clickAction,
        url: clickAction,
      },
      webpush: {
        headers: {
          Urgency: "high",
        },
        fcmOptions: {
          link: clickAction,
        },
        notification: {
          title,
          body,
          icon: "/logo.png",
        },
      },
    }));

    let totalSuccess = 0;
    let totalFailure = 0;
    const tokensToDelete: string[] = [];

    // Process in chunks of 500 (Firebase Admin maximum payload size per call)
    const chunkSize = 500;
    for (let i = 0; i < messages.length; i += chunkSize) {
      const chunk = messages.slice(i, i + chunkSize);
      const response = await messaging.sendEach(chunk);

      totalSuccess += response.successCount;
      totalFailure += response.failureCount;

      response.responses.forEach((res, idx) => {
        if (!res.success) {
          const errorCode = res.error?.code;
          const token = chunk[idx].token;
          if (
            errorCode === "messaging/registration-token-not-registered" ||
            errorCode === "messaging/invalid-registration-token"
          ) {
            tokensToDelete.push(token);
          } else {
            console.error(`FCM Token ${token.slice(0, 10)}... failed with error:`, res.error);
          }
        }
      });
    }

    console.log(`Push Notification Result: ${totalSuccess} sent successfully, ${totalFailure} failed.`);

    // Async prune invalid/expired tokens
    if (tokensToDelete.length > 0) {
      console.log(`Push Notification: Pruning ${tokensToDelete.length} inactive/unregistered tokens...`);
      const batch = db.batch();
      tokensToDelete.forEach((token) => {
        batch.delete(db.collection("fcm_tokens").doc(token));
      });
      await batch.commit();
      console.log("Push Notification: Finished pruning.");
    }

    return { success: true, sentCount: totalSuccess, failedCount: totalFailure };
  } catch (error) {
    console.error("Failed to send push notifications:", error);
    return { success: false, sentCount: 0, failedCount: 0 };
  }
}
