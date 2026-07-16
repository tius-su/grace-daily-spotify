import { getAdminDb } from "@/lib/server/firebase-admin";
import Link from "next/link";

export const dynamic = "force-dynamic";

type UnsubscribePageProps = {
  searchParams: Promise<{ token?: string }>;
};

export default async function UnsubscribePage({ searchParams }: UnsubscribePageProps) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <main className="min-h-screen bg-[#f7f4ee] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white border border-[#dfd8ca] rounded-2xl p-8 text-center shadow-xl">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-2xl">⚠️</span>
          </div>
          <h1 className="text-2xl font-bold text-[#14213d] mb-3">Tautan Tidak Valid</h1>
          <p className="text-sm text-[#52606d] mb-6 leading-relaxed">
            Tautan berhenti berlangganan Anda tidak lengkap atau sudah kedaluwarsa. Silakan periksa kembali tautan di email Anda.
          </p>
          <Link
            href="/"
            className="inline-block rounded-md bg-[#2a6f6f] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#1a4a4a] shadow"
          >
            Kembali ke Beranda
          </Link>
        </div>
      </main>
    );
  }

  const db = getAdminDb();
  let success = false;
  let errorMsg = "";

  if (db) {
    try {
      const snap = await db
        .collection("emailSubscribers")
        .where("unsubscribeToken", "==", token)
        .limit(1)
        .get();

      if (!snap.empty) {
        const docRef = snap.docs[0].ref;
        await docRef.update({
          active: false,
          updatedAt: new Date(),
        });
        success = true;
      } else {
        errorMsg = "Token tidak ditemukan. Kemungkinan Anda sudah berhenti berlangganan atau tautan tidak valid.";
      }
    } catch (err: any) {
      console.error("[Unsubscribe Error]:", err);
      errorMsg = "Terjadi kesalahan sistem saat memproses permintaan Anda.";
    }
  } else {
    errorMsg = "Layanan database tidak tersedia saat ini.";
  }

  return (
    <main className="min-h-screen bg-[#f7f4ee] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-[#dfd8ca] rounded-2xl p-8 text-center shadow-xl">
        {success ? (
          <>
            <div className="w-16 h-16 bg-[#e9f5db] rounded-full flex items-center justify-center mx-auto mb-6 border border-[#284b3a]/10">
              <svg className="w-8 h-8 text-[#284b3a]" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-[#14213d] mb-3">Berhasil Berhenti Berlangganan</h1>
            <p className="text-sm text-[#52606d] mb-6 leading-relaxed">
              Kami telah memperbarui sistem. Anda tidak akan menerima email renungan atau artikel baru dari Grace Daily lagi.
            </p>
            <div className="flex flex-col gap-3">
              <Link
                href={`/notification-preferences?token=${token}`}
                className="inline-block rounded-md border border-[#dfd8ca] px-6 py-3 text-sm font-semibold text-[#14213d] hover:bg-[#f7f4ee] transition"
              >
                Atur Preferensi Notifikasi
              </Link>
              <Link
                href="/"
                className="inline-block rounded-md bg-[#2a6f6f] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#1a4a4a] shadow"
              >
                Kembali ke Beranda
              </Link>
            </div>
          </>
        ) : (
          <>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-2xl">❌</span>
            </div>
            <h1 className="text-2xl font-bold text-[#14213d] mb-3">Gagal Memproses</h1>
            <p className="text-sm text-red-700 bg-red-50 p-4 rounded-lg border border-red-200 mb-6 leading-relaxed text-left">
              {errorMsg}
            </p>
            <Link
              href="/"
              className="inline-block rounded-md bg-[#2a6f6f] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#1a4a4a] shadow"
            >
              Kembali ke Beranda
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
