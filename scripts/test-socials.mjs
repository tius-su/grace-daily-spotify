import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.gracedaily.my.id";

// Bluesky Credentials
const BSKY_IDENTIFIER = process.env.BLUESKY_IDENTIFIER;
const BSKY_APP_PASSWORD = process.env.BLUESKY_APP_PASSWORD;

// Mastodon Credentials
const MASTODON_SERVER = process.env.MASTODON_SERVER || "https://mastodon.social";
const MASTODON_ACCESS_TOKEN = process.env.MASTODON_ACCESS_TOKEN;

// Discord Webhook
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK;

console.log("=== SOCIAL INTEGRATION TEST ===");
console.log("Bluesky Configured:", !!(BSKY_IDENTIFIER && BSKY_APP_PASSWORD));
console.log("Mastodon Configured:", !!(MASTODON_SERVER && MASTODON_ACCESS_TOKEN));
console.log("Discord Configured:", !!DISCORD_WEBHOOK);
console.log("===============================");

// Mock Data
const devotion = {
  id: "test-devotion-id",
  title: "Kekuatan Baru di Tengah Lelah",
  verseRef: "Yesaya 40:31",
  verseText: "tetapi orang-orang yang menanti-nantikan TUHAN mendapat kekuatan baru: mereka seumpama rajawali yang naik terbang dengan kekuatan sayapnya; mereka berlari dan tidak menjadi lesu, mereka berjalan dan tidak menjadi lelah.",
  body: "Saat kita menanti-nantikan Tuhan, Dia memperbarui kekuatan kita. Hari ini, mari percaya bahwa tangan-Nya memimpin setiap langkah kita.",
  imageUrl: "/Grace-Daily.jpg" // Local image path in public folder
};

// 1. Test Discord Webhook
async function testDiscord() {
  if (!DISCORD_WEBHOOK) {
    console.log("Discord not configured, skipping.");
    return;
  }
  console.log("\n[Discord] Posting test embed...");
  try {
    const payload = {
      content: `🌅 **Renungan Harian Baru!** — *${devotion.title}*`,
      embeds: [
        {
          title: devotion.title,
          description: `**Ayat:** 📖 ${devotion.verseRef}\n*"${devotion.verseText}"*\n\n${devotion.body}\n\n[**Baca Selengkapnya di Website**](${APP_URL}/renungan/${devotion.id})`,
          url: `${APP_URL}/renungan/${devotion.id}`,
          color: 10255444, // #9C7C54
          image: { url: `${APP_URL}${devotion.imageUrl}` },
          footer: { text: "Grace Daily" },
          timestamp: new Date().toISOString()
        }
      ]
    };

    const res = await fetch(DISCORD_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      console.log("✅ Discord webhook posted successfully!");
    } else {
      console.error("❌ Discord webhook failed:", res.status, await res.text());
    }
  } catch (e) {
    console.error("❌ Discord exception:", e);
  }
}

// 2. Test Mastodon
async function testMastodon() {
  if (!MASTODON_ACCESS_TOKEN) {
    console.log("Mastodon not configured, skipping.");
    return;
  }
  console.log("\n[Mastodon] Posting status update...");
  try {
    const text = [
      `🌅 Renungan Harian — ${devotion.title}`,
      "",
      `📖 Ayat: ${devotion.verseRef}`,
      `"${devotion.verseText.substring(0, 120)}..."`,
      "",
      devotion.body,
      "",
      `✨ Baca lengkap: ${APP_URL}/renungan/${devotion.id}`,
      "#RenunganHarian #GraceDaily #RohaniKristen"
    ].join("\n");

    const res = await fetch(`${MASTODON_SERVER}/api/v1/statuses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MASTODON_ACCESS_TOKEN}`
      },
      body: JSON.stringify({ status: text.substring(0, 490) })
    });

    if (res.ok) {
      const data = await res.json();
      console.log("✅ Mastodon posted successfully! Status ID:", data.id);
    } else {
      console.error("❌ Mastodon post failed:", res.status, await res.text());
    }
  } catch (e) {
    console.error("❌ Mastodon exception:", e);
  }
}

// 3. Test Bluesky (AT Protocol)
async function testBluesky() {
  if (!BSKY_IDENTIFIER || !BSKY_APP_PASSWORD) {
    console.log("Bluesky not configured, skipping.");
    return;
  }
  console.log("\n[Bluesky] Authenticating and posting...");
  try {
    // Session
    const cleanIdentifier = BSKY_IDENTIFIER.startsWith("@") ? BSKY_IDENTIFIER.substring(1) : BSKY_IDENTIFIER;
    const sessionRes = await fetch("https://bsky.social/xrpc/com.atproto.server.createSession", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: cleanIdentifier,
        password: BSKY_APP_PASSWORD
      })
    });

    if (!sessionRes.ok) {
      console.error("❌ Bluesky Auth failed:", sessionRes.status, await sessionRes.text());
      return;
    }

    const session = await sessionRes.json();
    const { accessJwt, did } = session;
    console.log("Authenticated as:", did);

    // Create post record
    const postText = `🌅 Renungan Harian — ${devotion.title}\n📖 ${devotion.verseRef}\n\nBaca renungan hari ini selengkapnya di Grace Daily ✨\n${APP_URL}/renungan/${devotion.id}`;
    
    const embed = {
      $type: "app.bsky.embed.external",
      external: {
        uri: `${APP_URL}/renungan/${devotion.id}`,
        title: `🌅 Renungan Harian: ${devotion.title}`,
        description: `${devotion.verseRef} - ${devotion.body}`
      }
    };

    const postRes = await fetch("https://bsky.social/xrpc/com.atproto.repo.createRecord", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessJwt}`
      },
      body: JSON.stringify({
        repo: did,
        collection: "app.bsky.feed.post",
        record: {
          $type: "app.bsky.feed.post",
          text: postText,
          createdAt: new Date().toISOString(),
          embed
        }
      })
    });

    if (postRes.ok) {
      const data = await postRes.json();
      console.log("✅ Bluesky posted successfully! Post URI:", data.uri);
    } else {
      console.error("❌ Bluesky post failed:", postRes.status, await postRes.text());
    }
  } catch (e) {
    console.error("❌ Bluesky exception:", e);
  }
}

async function runAll() {
  await testDiscord();
  await testMastodon();
  await testBluesky();
  console.log("\n=== TEST COMPLETED ===");
}

runAll();
