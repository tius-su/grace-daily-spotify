const url = "https://image.pollinations.ai/prompt/A%20serene%2C%20painterly%20scene%20of%20a%20glowing%20figure%20gently%20wiping%20tears%20from%20a%20joyful%20soul%2C%20surrounded%20by%20soft%20golden%20light%20and%20blooming%20flowers%2C%20symbolizing%20eternal%20peace%20and%20the%20absence%20of%20sorrow.?width=1024&height=1024&nologo=true&seed=847392&t=" + Date.now();

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  console.log("Starting Pollinations fetch retry test...");
  for (let attempt = 1; attempt <= 10; attempt++) {
    console.log(`Attempt ${attempt}: Fetching...`);
    try {
      const res = await fetch(url);
      console.log(`Status: ${res.status}`);
      if (res.status === 200) {
        console.log("Success! Image generated successfully.");
        return;
      }
      const text = await res.text();
      console.log(`Body (truncated): ${text.substring(0, 200)}`);
    } catch (err) {
      console.error("Fetch error:", err);
    }
    console.log("Waiting 2 seconds before retrying...");
    await delay(2000);
  }
  console.log("All 10 attempts failed.");
}

run();
