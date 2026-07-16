const apiKey = "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";
fetch("https://openrouter.ai/api/v1/chat/completions", {
  method: "POST",
  headers: {
    "Authorization": "Bearer " + apiKey,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    model: "openai/dall-e-3",
    messages: [{ role: "user", content: "A cat" }]
  })
}).then(res => res.json()).then(console.log).catch(console.error);

fetch("https://openrouter.ai/api/v1/images/generations", {
  method: "POST",
  headers: {
    "Authorization": "Bearer " + apiKey,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    model: "openai/dall-e-3",
    prompt: "A cat",
    n: 1,
    size: "1024x1024"
  })
}).then(res => res.json()).then(console.log).catch(console.error);
