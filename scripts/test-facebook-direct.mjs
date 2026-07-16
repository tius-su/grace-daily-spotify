import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const FB_PAGE_ID = process.env.FACEBOOK_PAGE_ID;
const FB_PAGE_ACCESS_TOKEN = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;

async function testPost() {
  if (!FB_PAGE_ID || !FB_PAGE_ACCESS_TOKEN) {
    console.error("Missing credentials");
    return;
  }

  const message = "Test post from automated script: " + new Date().toISOString();
  const link = "https://www.gracedaily.my.id";

  try {
    const url = `https://graph.facebook.com/v19.0/${FB_PAGE_ID}/feed?access_token=${FB_PAGE_ACCESS_TOKEN}`;
    console.log("Posting to:", url);
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        link
      }),
    });

    const status = response.status;
    const data = await response.json();
    console.log("Status:", status);
    console.log("Response data:", JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Fetch error:", error);
  }
}

testPost();
