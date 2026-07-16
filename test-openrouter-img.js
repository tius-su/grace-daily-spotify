const apiKey = "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";
fetch("https://openrouter.ai/api/v1/chat/completions", {
  method: "POST",
  headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" },
  body: JSON.stringify({
    model: "google/gemini-2.5-flash-image",
    messages: [{ role: "user", content: "Generate an image of a biblical scene: Jesus feeding the 5000." }]
  })
})
  .then(res => res.json())
  .then(data => {
    console.log(JSON.stringify(data, null, 2));
  });
