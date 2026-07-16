const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => {
  const [k, v] = line.split('=');
  if (k && v) acc[k.trim()] = v.trim();
  return acc;
}, {});
const accountId = env.R2_ACCOUNT_ID;
const token = env.CLOUDFLARE_AI_TOKEN;

async function test() {
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/black-forest-labs/flux-1-schnell`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ prompt: "A test prompt of a cat" })
  });
  if (!res.ok) {
    const text = await res.text();
    console.error("Failed:", text);
  } else {
    const buffer = Buffer.from(await res.arrayBuffer());
    console.log("Success! Bytes:", buffer.length);
  }
}
test();
