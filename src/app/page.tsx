import {
  blogCategories as staticBlogCategories,
  plans as staticPlans,
  songRecommendations,
} from "@/lib/data";
import { getLatestDevotion } from "@/lib/server/daily-devotion";
import { getCollectionWithFallback, getDocWithFallback } from "@/lib/server/db-fallback";
import { HomeClient } from "@/app/components/HomeClient";
import { excerptFromArticle } from "@/lib/encyclopedia";

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

export const revalidate = 300; // Cache page for 5 minutes

export default async function Home() {
  const devotion = await getLatestDevotion();
  
  let dynamicBlogCategories = staticBlogCategories;
  let dynamicSongs = songRecommendations;
  let dynamicPlans = staticPlans;
  let bulletin: any = null;
  let adsConfig: any = null;
  let dynamicPosts: any[] = [];

  // 1. Fetch Blog categories and latest articles with fallback
  try {
    const blogCatsDoc = await getDocWithFallback<any>("settings", "blog_categories", "settings.json");
    if (blogCatsDoc && Array.isArray(blogCatsDoc.list) && blogCatsDoc.list.length > 0) {
      dynamicBlogCategories = blogCatsDoc.list;
    }

    const allPosts = await getCollectionWithFallback<any>("blog_posts", "blog_posts.json");
    if (allPosts && allPosts.length > 0) {
      const getMs = (createdAt: any) => {
        if (!createdAt) return 0;
        if (typeof createdAt === "number") return createdAt;
        if (typeof createdAt === "string") return new Date(createdAt).getTime();
        if (typeof createdAt.toMillis === "function") return createdAt.toMillis();
        if (typeof createdAt.toDate === "function") return createdAt.toDate().getTime();
        if (typeof createdAt.seconds === "number") return createdAt.seconds * 1000;
        if (createdAt._seconds) return createdAt._seconds * 1000;
        return 0;
      };

      const loadedPosts = allPosts
        .filter(data => data.status === "published")
        .map(data => ({
          id: data.id,
          title: data.title ?? "",
          title_en: data.title_en ?? "",
          title_zh: data.title_zh ?? "",
          excerpt: data.excerpt ?? "",
          excerpt_en: data.excerpt_en ?? "",
          excerpt_zh: data.excerpt_zh ?? "",
          imageUrl: data.imageUrl ?? "",
          category: data.category ?? "",
          createdAt: getMs(data.createdAt),
        }));

      loadedPosts.sort((a, b) => b.createdAt - a.createdAt);

      dynamicPosts = loadedPosts.slice(0, 3);
    }
  } catch (e) {
    console.error("Failed to fetch blog categories & posts fallback:", e);
  }

  // 2. Fetch Songs with fallback
  try {
    const loadedSongs = await getCollectionWithFallback<any>("songs", "songs.json");
    if (loadedSongs && loadedSongs.length > 0) {
      dynamicSongs = loadedSongs.map(s => ({
        title: s.title ?? "",
        artist: s.artist ?? "",
        url: s.url ?? "",
      }));
    }
  } catch (e) {
    console.error("Failed to fetch songs fallback:", e);
  }

  // 3. Fetch Bulletin & Ads & Plans with fallback
  try {
    bulletin = await getDocWithFallback<any>("settings", "bulletin", "settings.json");
    adsConfig = await getDocWithFallback<any>("settings", "ads", "settings.json");
    
    const loadedPlans = await getCollectionWithFallback<any>("plans", "plans.json");
    if (loadedPlans && loadedPlans.length > 0) {
      dynamicPlans = loadedPlans.map(data => ({
        name: data.name ?? "",
        price: typeof data.price === 'number' ? `Rp${data.price.toLocaleString("id-ID")}` : (data.price ?? ""),
        durationDays: Number(data.durationDays) || 0,
        aiRequests: Number(data.aiRequests) || 0,
        features: Array.isArray(data.features) ? data.features : (data.features ? String(data.features).split(",").map(f => f.trim()) : []),
        allowedModes: data.allowedModes || [],
      }));
    }
  } catch (e) {
    console.error("Failed to fetch configs or plans fallback:", e);
  }

  // 4. Fetch Encyclopedia statistics and sample list with fallback
  let encyclopediaStats: Record<string, number> = {
    tokoh: 0,
    tempat: 0,
    kamus: 0,
    mukjizat: 0,
    perumpamaan: 0,
    kitab: 0,
    kronologi: 0,
  };
  let encyclopediaSamples: any[] = [];
  let encyclopediaFetched = false;

  try {
    const ensiklopediaSnapshot = await getCollectionWithFallback<any>("ensiklopedia_cache", "tokoh.json"); // Just fetch a collection or try fallback
    const allDocs = ensiklopediaSnapshot;
    
    if (allDocs && allDocs.length > 0) {
      allDocs.forEach((data: any) => {
        const cat = data.kategori || "";
        if (encyclopediaStats[cat] !== undefined) {
          encyclopediaStats[cat]++;
        }
        if (encyclopediaSamples.length < 10) {
          encyclopediaSamples.push({
            id: data.id || data.slug || "",
            title: data.title || data.keyword || "",
            slug: data.slug || "",
            kategori: cat,
            summary: data.isi_artikel ? excerptFromArticle(data.isi_artikel, 120) : "",
          });
        }
      });
      encyclopediaFetched = true;
    }
  } catch (e) {
    console.error("Failed to fetch encyclopedia statistics fallback:", e);
  }

  // If fetching main collection failed, try downloading individual category JSONs from R2
  if (!encyclopediaFetched || encyclopediaSamples.length === 0) {
    try {
      const { downloadFromR2 } = await import("@/lib/server/backup-r2-service");
      const files = ["tokoh.json", "tempat.json", "istilah.json", "perumpamaan.json"];
      const results = await Promise.all(
        files.map(async file => {
          try {
            const dataStr = await downloadFromR2(file);
            return dataStr ? JSON.parse(dataStr) : [];
          } catch {
            return [];
          }
        })
      );
      const allDocs = results.flat();
      allDocs.forEach((doc: any) => {
        const cat = doc.kategori || "";
        if (encyclopediaStats[cat] !== undefined) {
          encyclopediaStats[cat]++;
        }
        if (encyclopediaSamples.length < 10) {
          encyclopediaSamples.push({
            id: doc.id || doc.slug || "",
            title: doc.title || doc.keyword || "",
            slug: doc.slug || "",
            kategori: cat,
            summary: doc.isi_artikel ? excerptFromArticle(doc.isi_artikel, 120) : "",
          });
        }
      });
    } catch (e) {
      console.error("Failed to fetch R2 encyclopedia stats fallback:", e);
    }
  }

  const homeData = JSON.parse(
    JSON.stringify({
      devotion,
      blogCategories: dynamicBlogCategories,
      songs: dynamicSongs,
      plans: dynamicPlans,
      bulletin,
      adsConfig,
      posts: dynamicPosts,
      encyclopediaStats,
      encyclopediaSamples,
    })
  );

  return <HomeClient serverData={homeData} />;
}
