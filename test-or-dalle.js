const apiKey = "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";
fetch("https://openrouter.ai/api/v1/chat/completions", {
  method: "POST",
  headers: {
    "Authorization": "Bearer " + apiKey,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    model: "openai/dall-e-3",
    messages: [{ role: "user", content: "Generate an image of a cat" }]
  })
}).then(res => res.json()).then(res => console.log(JSON.stringify(res, null, 2))).catch(console.error);
