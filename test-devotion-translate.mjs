async function test() {
  try {
    const res = await fetch("http://localhost:3000/api/translate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        text: "Kunci Kemenangan Iman",
        to: "zh",
        type: "devotion",
        id: "2024-03-15" // Let's check a typical devotion ID format
      })
    });
    console.log("Status:", res.status);
    const data = await res.json();
    console.log("Data:", JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Test failed:", err);
  }
}

test();
