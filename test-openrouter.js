const apiKey = "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";
fetch("https://openrouter.ai/api/v1/models", { headers: { Authorization: "Bearer " + apiKey } })
  .then(res => res.json())
  .then(data => {
    const fluxModels = data.data.filter(m => m.id.toLowerCase().includes("flux") || m.id.toLowerCase().includes("image") || m.id.toLowerCase().includes("diffusion"));
    console.log(JSON.stringify(fluxModels, null, 2));
  });
