import Image from "next/image";
import Link from "next/link";
import {
  blogCategories as staticBlogCategories,
  features,
  plans as staticPlans,
  testimonials,
  songRecommendations,
} from "@/lib/data";
import { getLatestDevotion } from "@/lib/server/daily-devotion";
import { getAdminDb, reportDbFailure } from "@/lib/server/firebase-admin";
import { fetchCollectionFromRest, fetchDocFromRest, fetchPublishedBlogsFromRest } from "@/lib/server/firestore-rest";
import { DevotionCard } from "@/app/components/DevotionCard";
import { AdPopup } from "@/app/components/AdPopup";

const demoMessages = [
  {
    label: "Kamu",
    text: "Bagaimana saya tetap percaya saat doa belum dijawab?",
  },
  {
    label: "Pendeta",
    text: "Mulailah dari kejujuran di hadapan Tuhan. Mazmur mengajarkan bahwa iman tidak menolak air mata, tetapi membawa air mata itu kepada Allah.",
  },
];

export const dynamic = "force-dynamic";

export default async function Home() {
  const devotion = await getLatestDevotion();
  
  let dynamicBlogCategories = staticBlogCategories;
  let dynamicSongs = songRecommendations;
  let dynamicPlans = staticPlans;
  let bulletin: any = null;
  let adsConfig: any = null;
  let dynamicPosts: any[] = [];

  const adminDb = getAdminDb();

  // 1. Fetch Blog categories and latest articles
  let blogFetched = false;
  try {
    const restCats = await fetchDocFromRest("settings", "blog_categories");
    if (restCats && Array.isArray(restCats.list) && restCats.list.length > 0) {
      dynamicBlogCategories = restCats.list;
    }

    const restPosts = await fetchPublishedBlogsFromRest();
    if (restPosts.length > 0) {
      const loadedPosts: any[] = [];
      restPosts.forEach(data => {
        loadedPosts.push({
          id: data.id,
          title: data.title ?? "",
          excerpt: data.excerpt ?? "",
          imageUrl: data.imageUrl ?? "",
          category: data.category ?? "",
          createdAt: data.createdAt,
        });
      });

      // Sort posts in memory (newest first)
      loadedPosts.sort((a, b) => {
        const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
        const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
        return timeB - timeA;
      });

      dynamicPosts = loadedPosts.slice(0, 3);
      blogFetched = true;
    }
  } catch (e) {
    console.error("Failed to fetch blog categories & posts via REST:", e);
  }

  if (!blogFetched && adminDb) {
    try {
      const blogCatsSnap = await adminDb.collection("settings").doc("blog_categories").get();
      if (blogCatsSnap.exists) {
        const catList = blogCatsSnap.data()?.list;
        if (Array.isArray(catList) && catList.length > 0) {
          dynamicBlogCategories = catList;
        }
      }

      const blogSnapshot = await adminDb.collection("blog_posts").get();
      if (!blogSnapshot.empty) {
        const loadedPosts: any[] = [];
        blogSnapshot.forEach(doc => {
          const data = doc.data();
          if (data.status === "published") {
            loadedPosts.push({
              id: doc.id,
              title: data.title ?? "",
              excerpt: data.excerpt ?? "",
              imageUrl: data.imageUrl ?? "",
              category: data.category ?? "",
              createdAt: data.createdAt,
            });
          }
        });

        loadedPosts.sort((a, b) => {
          const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
          const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
          return timeB - timeA;
        });

        dynamicPosts = loadedPosts.slice(0, 3);
      }
      blogFetched = true;
    } catch (e) {
      console.error("Failed to fetch blog categories & posts via Admin SDK:", e);
      reportDbFailure();
    }
  }

  // 2. Fetch Songs
  let songsFetched = false;
  try {
    const restSongs = await fetchCollectionFromRest("songs");
    if (restSongs.length > 0) {
      dynamicSongs = restSongs.map(s => ({
        title: s.title ?? "",
        artist: s.artist ?? "",
        url: s.url ?? "",
      }));
      songsFetched = true;
    }
  } catch (e) {
    console.error("Failed to fetch songs via REST:", e);
  }

  if (!songsFetched && adminDb) {
    try {
      const songSnapshot = await adminDb.collection("songs").get();
      if (!songSnapshot.empty) {
        dynamicSongs = songSnapshot.docs.map(doc => ({
           title: doc.data().title,
           artist: doc.data().artist,
           url: doc.data().url,
        }));
      }
      songsFetched = true;
    } catch (e) {
      console.error("Failed to fetch songs via Admin SDK:", e);
      reportDbFailure();
    }
  }

  // 3. Fetch Bulletin
  let bulletinFetched = false;
  try {
    const restBulletin = await fetchDocFromRest("settings", "bulletin");
    if (restBulletin) {
      bulletin = restBulletin;
      bulletinFetched = true;
    }
  } catch (e) {
    console.error("Failed to fetch bulletin via REST:", e);
  }

  if (!bulletinFetched && adminDb) {
    try {
      const bulletinSnap = await adminDb.collection("settings").doc("bulletin").get();
      if (bulletinSnap.exists) {
        bulletin = bulletinSnap.data();
      }
      bulletinFetched = true;
    } catch (e) {
      console.error("Failed to fetch bulletin via Admin SDK:", e);
      reportDbFailure();
    }
  }

  // 4. Fetch Plans (Packages)
  let plansFetched = false;
  try {
    const restPlans = await fetchCollectionFromRest("plans");
    if (restPlans.length > 0) {
      dynamicPlans = restPlans.map(data => {
        return {
          name: data.name ?? "",
          price: typeof data.price === 'number' ? `Rp${data.price.toLocaleString("id-ID")}` : (data.price ?? ""),
          durationDays: Number(data.durationDays) || 0,
          aiRequests: Number(data.aiRequests) || 0,
          features: Array.isArray(data.features) ? data.features : (data.features ? String(data.features).split(",").map(f => f.trim()) : []),
          allowedModes: data.allowedModes || [],
        };
      });
      plansFetched = true;
    }
  } catch (e) {
    console.error("Failed to fetch plans via REST:", e);
  }

  if (!plansFetched && adminDb) {
    try {
      const planSnapshot = await adminDb.collection("plans").get();
      if (!planSnapshot.empty) {
        dynamicPlans = planSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            name: data.name ?? "",
            price: typeof data.price === 'number' ? `Rp${data.price.toLocaleString("id-ID")}` : (data.price ?? ""),
            durationDays: Number(data.durationDays) || 0,
            aiRequests: Number(data.aiRequests) || 0,
            features: Array.isArray(data.features) ? data.features : (data.features ? String(data.features).split(",").map(f => f.trim()) : []),
            allowedModes: data.allowedModes || [],
          };
        });
      }
      plansFetched = true;
    } catch (e) {
      console.error("Failed to fetch plans via Admin SDK:", e);
      reportDbFailure();
    }
  }

  // 5. Fetch Ads Configuration
  let adsFetched = false;
  try {
    const restAds = await fetchDocFromRest("settings", "ads");
    if (restAds) {
      adsConfig = restAds;
      adsFetched = true;
    }
  } catch (e) {
    console.error("Failed to fetch ads config via REST:", e);
  }

  if (!adsFetched && adminDb) {
    try {
      const adsSnap = await adminDb.collection("settings").doc("ads").get();
      if (adsSnap.exists) {
        adsConfig = adsSnap.data();
      }
      adsFetched = true;
    } catch (e) {
      console.error("Failed to fetch ads config via Admin SDK:", e);
      reportDbFailure();
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f4ee] text-[#1f2933]">
      <AdPopup adConfig={adsConfig} />
      {bulletin?.isActive && (
        <div className="bg-[#ffd166] px-5 py-3 text-center text-[#14213d] sm:px-8 shadow-sm relative z-50">
          <p className="text-sm font-bold uppercase tracking-[0.1em]">{bulletin.title}</p>
          <p className="mt-1 text-sm font-medium">{bulletin.content}</p>
          {bulletin.url && (
            <a href={bulletin.url} target="_blank" rel="noreferrer" className="mt-2 inline-block rounded-md bg-[#14213d] px-4 py-1.5 text-xs font-bold text-white transition hover:bg-[#2a6f6f]">
              Buka Tautan
            </a>
          )}
        </div>
      )}
      <section className="relative isolate overflow-hidden bg-[#14213d] text-white">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_20%,rgba(244,162,97,0.28),transparent_34%),linear-gradient(135deg,#14213d_0%,#25415f_52%,#2a6f6f_100%)]" />

        <div className="mx-auto grid min-h-[calc(100vh-84px)] max-w-7xl items-center gap-10 px-5 pb-14 pt-6 sm:px-8 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="max-w-3xl">
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.28em] text-[#ffd166]">
              Renungan harian Kristen
            </p>
            <h1 className="text-5xl font-semibold leading-tight sm:text-6xl lg:text-7xl">
              Grace Daily
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/82">
              Ruang teduh digital Anda. Temukan inspirasi ayat harian, ruang doa, bimbingan rohani, dan komunitas yang mendukung pertumbuhan iman Anda setiap hari.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href="#mulai"
                className="rounded-md bg-white px-5 py-3 text-center font-semibold text-[#14213d] transition hover:bg-[#e9f5db]"
              >
                Buka Renungan Hari Ini
              </a>
              <a
                href="/tanya-pendeta"
                className="rounded-md border border-white/35 px-5 py-3 text-center font-semibold text-white transition hover:bg-white/10"
              >
                Tanya Pendeta
              </a>
            </div>
          </div>

          <div className="grid gap-4" id="mulai">
            <DevotionCard devotion={devotion} />
            <div
              id="demo"
              className="rounded-lg border border-white/15 bg-[#f7f4ee] p-5 text-[#1f2933] shadow-2xl"
            >
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#2a6f6f]">
                Layanan Bimbingan Rohani
              </p>
              <div className="mt-4 grid gap-3">
                {demoMessages.map((message) => (
                  <div key={message.label} className="rounded-md bg-white p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#2a6f6f]">
                      {message.label}
                    </p>
                    <p className="mt-2 leading-7 text-[#334155]">
                      {message.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="fitur" className="px-5 py-16 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#2a6f6f]">
              Fitur utama
            </p>
            <h2 className="mt-3 text-3xl font-semibold text-[#14213d] sm:text-4xl">
              Dibangun untuk rutinitas rohani harian.
            </h2>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <article
                key={feature.title}
                className="rounded-lg border border-[#dfd8ca] bg-white p-5 shadow-sm"
              >
                <h3 className="text-xl font-semibold text-[#14213d]">
                  {feature.title}
                </h3>
                <p className="mt-3 leading-7 text-[#52606d]">
                  {feature.description}
                </p>
                <Link
                  href={
                    feature.title === "Jurnal Spiritual"
                      ? "/jurnal"
                      : feature.title === "Komunitas Doa"
                        ? "/komunitas-doa"
                        : feature.title === "Grup Renungan"
                          ? "/grup-renungan"
                          : feature.title === "Ayat Emas"
                            ? "/alkitab"
                            : feature.title === "Pendeta"
                              ? "/tanya-pendeta"
                              : feature.title === "PDF Devotional"
                                ? "/ai?mode=devotional_pdf"
                                : "/ai"
                  }
                  className="mt-5 inline-flex rounded-md bg-[#2a6f6f] px-4 py-2 font-semibold text-white"
                >
                  Buka fitur
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#102c3a] px-5 py-16 text-white sm:px-8">
        <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#ffd166]">
              Alkitab Online
            </p>
            <h2 className="mt-3 text-3xl font-semibold">
              Fokus Penuh pada Firman Tuhan.
            </h2>
            <p className="mt-4 max-w-3xl leading-8 text-white/75">
              Pelajari dan renungkan kebenaran firman Tuhan melalui ruang baca yang dirancang khusus untuk meminimalisasi distraksi. Temukan ayat spesifik, baca perikop secara utuh, dan telusuri berbagai tema rohani dengan terjemahan Alkitab yang akurat.
            </p>
          </div>
          <Link
            href="/alkitab"
            className="rounded-md bg-[#ffd166] px-5 py-3 text-center font-semibold text-[#102c3a]"
          >
            Buka Alkitab
          </Link>
        </div>
      </section>

      <section id="lagu" className="bg-[#e9f5db] px-5 py-16 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#2a6f6f]">
              Pujian & Penyembahan
            </p>
            <h2 className="mt-3 text-3xl font-semibold text-[#14213d] sm:text-4xl">
              Rekomendasi Lagu Rohani
            </h2>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {dynamicSongs.map((song) => (
              <a
                href={song.url}
                target="_blank"
                rel="noreferrer"
                key={song.title}
                className="group flex items-center gap-4 rounded-lg border border-[#dfd8ca] bg-white p-4 shadow-sm transition hover:shadow-md"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#14213d] text-[#ffd166] transition group-hover:bg-[#2a6f6f]">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
                    <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-[#14213d] group-hover:text-[#2a6f6f]">{song.title}</h3>
                  <p className="text-sm text-[#52606d]">{song.artist}</p>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section id="blog" className="px-5 py-16 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#2a6f6f]">
                Artikel & Wawasan
              </p>
              <h2 className="mt-3 text-3xl font-semibold text-[#14213d]">
                Dapatkan inspirasi dan hikmat dari berbagai topik rohani.
              </h2>
            </div>
            <a
              href="https://wa.me/?text=Grace%20Daily%20-%20renungan%20harian%20Kristen"
              className="rounded-md bg-[#2a6f6f] px-4 py-3 text-center font-semibold text-white"
            >
              Share WhatsApp
            </a>
            <Link
              href="/blog"
              className="rounded-md border border-[#dfd8ca] bg-white px-4 py-3 text-center font-semibold text-[#14213d]"
            >
              Buka Blog
            </Link>
          </div>
          {/* Category Navigation Bar (Horizontal scroll on mobile) */}
          <div 
            className="mt-6 flex overflow-x-auto gap-2 pb-4 -mx-5 px-5 sm:mx-0 sm:px-0 scrollbar-thin"
            style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}
          >
            {dynamicBlogCategories.map((category) => (
              <Link
                href={`/blog?category=${encodeURIComponent(category)}`}
                key={category}
                className="shrink-0 rounded-md border border-[#dfd8ca] bg-white px-4 py-2 text-sm font-semibold text-[#334155] transition hover:bg-[#2a6f6f] hover:text-white"
              >
                {category}
              </Link>
            ))}
          </div>

          {/* Latest 3 Articles Card Grid */}
          {dynamicPosts.length > 0 ? (
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {dynamicPosts.map((post) => (
                <Link
                  href={`/blog/${post.id}`}
                  key={post.id}
                  className="group flex flex-col overflow-hidden rounded-xl border border-[#dfd8ca] bg-white shadow-sm transition hover:shadow-md"
                >
                  {post.imageUrl ? (
                    <img
                      src={post.imageUrl}
                      alt={post.title}
                      className="h-44 w-full object-cover transition duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-44 w-full flex-col items-center justify-center bg-[#102c3a] gap-2">
                      <img src="/logo.jpg" alt="Logo" className="h-10 w-10 rounded-full object-cover border border-[#ffd166]/30" />
                      <span className="text-sm font-bold uppercase tracking-widest text-[#ffd166]">Grace Daily</span>
                    </div>
                  )}
                  <div className="flex flex-1 flex-col p-5">
                    <p className="text-xs font-semibold uppercase tracking-widest text-[#2a6f6f]">{post.category}</p>
                    <h3 className="mt-3 text-lg font-semibold leading-tight text-[#14213d] group-hover:text-[#2a6f6f]">{post.title}</h3>
                    {post.excerpt && (
                      <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-[#52606d]">{post.excerpt}</p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="mt-8 text-[#52606d] italic text-center">Belum ada artikel terbaru.</p>
          )}
        </div>
      </section>

      {/* Landing Ad Banner */}
      {adsConfig?.isActive && adsConfig?.placement === "landing" && adsConfig?.imageUrl && (
        <section className="px-5 py-6 sm:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="overflow-hidden rounded-2xl border border-[#dfd8ca] bg-white shadow-sm">
              {adsConfig.targetUrl ? (
                <a href={adsConfig.targetUrl} target="_blank" rel="noreferrer" className="block">
                  <img src={adsConfig.imageUrl} alt={adsConfig.title || "Promosi"} className="w-full h-auto object-cover max-h-[320px] transition duration-300 hover:opacity-95" />
                </a>
              ) : (
                <img src={adsConfig.imageUrl} alt={adsConfig.title || "Promosi"} className="w-full h-auto object-cover max-h-[320px]" />
              )}
            </div>
          </div>
        </section>
      )}

      <section id="paket" className="bg-[#14213d] px-5 py-16 text-white sm:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#ffd166]">
              Membership premium
            </p>
            <h2 className="mt-3 text-3xl font-semibold">
              Paket berbasis durasi dan limit kuota.
            </h2>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {dynamicPlans.map((plan) => (
              <article
                key={plan.name}
                className="rounded-lg border border-white/15 bg-white/10 p-5"
              >
                <h3 className="text-2xl font-semibold">{plan.name}</h3>
                <p className="mt-3 text-3xl font-bold text-[#ffd166]">
                  {plan.price}
                </p>
                <p className="mt-2 text-white/72">
                  {plan.durationDays} hari, {plan.aiRequests} interaksi
                </p>
                <ul className="mt-5 grid gap-2 text-white/84">
                  {plan.features.map((feature) => (
                    <li key={feature}>- {feature}</li>
                  ))}
                </ul>
                <Link
                  href="/login"
                  className="mt-5 inline-flex rounded-md bg-[#ffd166] px-4 py-2 font-semibold text-[#14213d]"
                >
                  Pilih paket
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white px-5 py-16 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-3xl font-semibold text-[#14213d]">
            Review pengguna
          </h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {testimonials.map((item) => (
              <article
                key={item.name}
                className="rounded-lg border border-[#dfd8ca] bg-[#f7f4ee] p-5"
              >
                <p className="leading-7 text-[#334155]">
                  &ldquo;{item.quote}&rdquo;
                </p>
                <p className="mt-4 font-semibold text-[#14213d]">
                  {item.name}
                </p>
                <p className="text-sm text-[#52606d]">{item.role}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <footer className="border-t border-[#dfd8ca] bg-white px-5 py-8 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-sm text-[#52606d]">
            &copy; {new Date().getFullYear()} Grace Daily. All rights reserved.
          </p>
          <div className="flex flex-wrap gap-6 text-sm text-[#52606d]">
            <Link href="/kontak" className="hover:text-[#2a6f6f] hover:underline">
              Hubungi Kami
            </Link>
            <Link href="/tanya-pendeta" className="hover:text-[#2a6f6f] hover:underline">
              Tanya Pendeta
            </Link>
            <Link href="/syarat-dan-ketentuan" className="hover:text-[#2a6f6f] hover:underline">
              Syarat dan Ketentuan
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
