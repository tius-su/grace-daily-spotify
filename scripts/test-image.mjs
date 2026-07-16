const url = "https://image.pollinations.ai/prompt/A%20serene%2C%20painterly%20scene%20of%20a%20glowing%20figure%20gently%20wiping%20tears%20from%20a%20joyful%20soul%2C%20surrounded%20by%20soft%20golden%20light%20and%20blooming%20flowers%2C%20symbolizing%20eternal%20peace%20and%20the%20absence%20of%20sorrow.?width=1024&height=1024&nologo=true&seed=847392&t=" + Date.now();

async function run() {
  console.log("Fetching from gen.pollinations.ai...");
  try {
    const res = await fetch(url);
    console.log("Status:", res.status);
    console.log("Headers:", Object.fromEntries(res.headers.entries()));
    const text = await res.text();
    console.log("Body length:", text.length);
    if (res.status === 200) {
      console.log("Response is OK (image content)!");
    } else {
      console.log("Body content:", text.substring(0, 500));
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

run();
