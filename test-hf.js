const token = "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";
fetch("https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell", {
  method: "POST",
  headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
  body: JSON.stringify({ inputs: "A cat", parameters: { width: 512, height: 512 } })
})
  .then(res => {
    console.log(res.status, res.headers.get("content-type"));
    return res.arrayBuffer();
  })
  .then(buffer => console.log("Buffer length:", buffer.byteLength));
