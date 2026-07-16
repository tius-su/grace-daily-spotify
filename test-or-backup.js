const apiKey = "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";
fetch("https://openrouter.ai/api/v1/chat/completions", {
  method: "POST",
  headers: {
    "Authorization": "Bearer " + apiKey,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    model: "openai/gpt-3.5-turbo",
    messages: [{ role: "user", content: "Test" }]
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
}).then(res => res.text()).then(console.log).catch(console.error);
