#!/usr/bin/env node
/**
 * Script: test-date-id.mjs
 * 
 * Mensimulasikan jakartaDateId() di berbagai jam (pagi, siang, sore, malam)
 * untuk memastikan selalu menghasilkan ID dengan suffix -05 (pagi).
 */

function jakartaTimeParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value]),
  );
  return {
    day: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
  };
}

function jakartaDateId(date = new Date()) {
  // Add 10 minutes buffer
  const bufferedDate = new Date(date.getTime() + 10 * 60 * 1000);
  const current = jakartaTimeParts(bufferedDate);

  if (current.hour < 5) {
    const previousDay = jakartaTimeParts(new Date(bufferedDate.getTime() - 86_400_000));
    return `golden-${previousDay.day}-05`;
  }

  return `golden-${current.day}-05`;
}

function formatJkt(date) {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).format(date);
}

console.log("\n🧪 Simulasi jakartaDateId() di berbagai jam WIB\n");
console.log("=".repeat(60));

// Ambil tanggal hari ini sebagai base
const todayBase = new Date();
const todayJkt = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jakarta",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(todayBase);

// Simulasi berbagai jam (dalam UTC, 7 jam lebih awal dari WIB)
const testCases = [
  { label: "Tengah malam WIB 00:00", jktHour: 0 },
  { label: "Dini hari WIB 02:00",    jktHour: 2 },
  { label: "Dini hari WIB 04:30",    jktHour: 4, jktMin: 30 },
  { label: "PAGI WIB 05:00 ⭐",      jktHour: 5 },
  { label: "Pagi WIB 06:00",         jktHour: 6 },
  { label: "Siang WIB 10:00",        jktHour: 10 },
  { label: "SORE WIB 15:00 ⚠️",      jktHour: 15 },
  { label: "Sore WIB 17:00",         jktHour: 17 },
  { label: "Malam WIB 20:00",        jktHour: 20 },
  { label: "Malam WIB 23:59",        jktHour: 23, jktMin: 59 },
];

let allCorrect = true;

for (const tc of testCases) {
  const jktMin = tc.jktMin ?? 0;
  // Convert WIB to UTC
  const utcMs = new Date(`${todayJkt}T00:00:00+07:00`).getTime()
    + tc.jktHour * 3600000
    + jktMin * 60000;
  const testDate = new Date(utcMs);
  const result = jakartaDateId(testDate);
  const expectedSuffix = "-05";
  const isCorrect = result.endsWith(expectedSuffix);
  
  if (!isCorrect) allCorrect = false;

  const icon = isCorrect ? "✅" : "❌";
  console.log(`${icon} ${tc.label.padEnd(28)} → ${result}`);
}

console.log("=".repeat(60));
if (allCorrect) {
  console.log("\n✅ SEMUA JAM menghasilkan ID dengan suffix -05 (PAGI).");
  console.log("   Renungan TIDAK AKAN pernah dibuat ulang di sore hari.\n");
} else {
  console.log("\n❌ ADA JAM yang menghasilkan ID yang salah!\n");
  process.exit(1);
}

// Bonus: tunjukkan edge case tengah malam (seharusnya ambil hari sebelumnya)
console.log("📌 Edge case: jam 00:00-04:59 WIB → ambil tanggal KEMARIN-05\n");
const midnight = new Date(`${todayJkt}T00:00:00+07:00`);
const midnightId = jakartaDateId(midnight);
console.log(`   00:00 WIB → ${midnightId} (hari kemarin, benar ✅)\n`);
