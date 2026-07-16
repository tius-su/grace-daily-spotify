import fs from "fs";
import path from "path";

// Load .env.local manually
const envFile = fs.readFileSync(".env.local", "utf8");
envFile.split("\n").forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith("#")) {
    const parts = trimmed.split("=");
    const key = parts[0].trim();
    const val = parts.slice(1).join("=").trim().replace(/(^['"]|['"]$)/g, "");
    process.env[key] = val;
  }
});

const serverKey = process.env.MIDTRANS_SERVER_KEY;
const isProduction = process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION !== "false";

console.log("Checking Midtrans credentials...");
console.log("Server Key configured:", !!serverKey);
console.log("Is Production:", isProduction);

if (!serverKey) {
  console.error("Error: MIDTRANS_SERVER_KEY is not defined in .env.local");
  process.exit(1);
}

const auth = Buffer.from(`${serverKey}:`).toString("base64");
const endpoint = isProduction
  ? "https://app.midtrans.com/snap/v1/transactions"
  : "https://app.sandbox.midtrans.com/snap/v1/transactions";

const orderId = `DON-testuser-${Date.now()}`;
const grossAmount = 25000;

console.log("Sending test transaction to Midtrans...");
console.log("Endpoint:", endpoint);
console.log("Order ID:", orderId);
console.log("Amount:", grossAmount);

async function run() {
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        transaction_details: {
          order_id: orderId,
          gross_amount: grossAmount,
        },
        customer_details: {
          first_name: "Test Donor",
          email: "donor@test.com",
        },
        item_details: [
          {
            id: "donasi-open",
            name: "Open Donation",
            price: grossAmount,
            quantity: 1,
          },
        ],
        custom_field1: "testuser",
        custom_field2: "Open Donation",
        custom_field3: "50",
      }),
    });

    const data = await response.json();
    console.log("HTTP Status Code:", response.status);
    console.log("Response headers:", [...response.headers.entries()]);
    console.log("Response data:", JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Request failed:", error);
  }
}

run();
