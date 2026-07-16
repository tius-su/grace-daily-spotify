import DonationCards from '@/app/components/DonationCards';
import { getCollectionWithFallback } from '@/lib/server/db-fallback';
import { plans as staticPlans } from '@/lib/data';

export const metadata = {
  title: 'Kemitraan Pelayanan - Grace Daily',
  description: 'Dukung Pelayanan Digital Grace Daily dan bantu kami menyediakan akses Firman Tuhan berbasis AI bagi ribuan jemaat.',
};

export const revalidate = 300; // Cache for 5 minutes

export default async function DonasiPage() {
  let plans = staticPlans;
  try {
    const loadedPlans = await getCollectionWithFallback<any>("plans", "plans.json");
    if (loadedPlans && loadedPlans.length > 0) {
      plans = loadedPlans.map(data => ({
        name: data.name ?? "",
        price: typeof data.price === 'number' ? `Rp${data.price.toLocaleString("id-ID")}` : (data.price ?? ""),
        durationDays: Number(data.durationDays) || 0,
        aiRequests: Number(data.aiRequests) || 0,
        features: Array.isArray(data.features) ? data.features : (data.features ? String(data.features).split(",").map(f => f.trim()) : []),
        allowedModes: data.allowedModes || [],
      }));
    }
  } catch (e) {
    console.error("Failed to fetch plans for donasi page:", e);
  }

  return (
    <main className="min-h-screen bg-[#0d1b2a]">
      <DonationCards plans={plans} />
    </main>
  );
}
