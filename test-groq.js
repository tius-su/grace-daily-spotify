const apiKey = "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";
fetch("https://api.groq.com/openai/v1/chat/completions", {
  method: "POST",
  headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" },
  body: JSON.stringify({
    model: "llama-3.3-70b-versatile",
    messages: [{ role: "user", content: "Test" }]
  })
})
  .then(res => res.json())
  .then(data => console.log(JSON.stringify(data, null, 2)));
