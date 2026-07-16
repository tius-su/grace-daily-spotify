import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { askDeepSeek } from "@/lib/ai";
import { getAdminDb, reportDbFailure, withDbTimeout } from "@/lib/server/firebase-admin";
import { dailyVerse } from "@/lib/data";
import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { fetchDocFromRest } from "@/lib/server/firestore-rest";
import { resolveDailyHeroImage, selectDailyHeroImage } from "@/lib/daily-hero-images";
import { buildSeoFields } from "@/lib/seo";
import { BIBLE_BOOKS, USE_WEB_BIBLE } from "@/lib/bible";
import { existsSync, readFileSync } from "fs";
import path from "path";

const r2AccountId = process.env.R2_ACCOUNT_ID;
const r2AccessKey = process.env.R2_ACCESS_KEY_ID;
const r2SecretKey = process.env.R2_SECRET_ACCESS_KEY;
const r2BucketName = process.env.R2_BUCKET_NAME;
const r2PublicUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;

let s3Client: S3Client | null = null;
if (r2AccountId && r2AccessKey && r2SecretKey) {
  s3Client = new S3Client({
    region: "auto",
    endpoint: `https://${r2AccountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: r2AccessKey,
      secretAccessKey: r2SecretKey,
    },
  });
}

export async function generateDailyImage(devotionId: string, _verseRef?: string, _verseText?: string, _options: { force?: boolean } = {}): Promise<string> {
  return selectDailyHeroImage(devotionId);
}

export async function generateDailyBanner(
  devotionId: string,
  title: string,
  verseRef: string,
  verseText: string,
  options: { force?: boolean } = {},
): Promise<string> {
  const key = `daily-banners/${devotionId}.webp`;

  if (!s3Client || !r2BucketName || !r2PublicUrl) {
    return "";
  }

  const publicUrl = `${r2PublicUrl}/${key}`;

  // Check if banner exists in R2 — SKIP check if force=true to regenerate fresh banner
  if (!options.force) {
    try {
      await s3Client.send(
        new HeadObjectCommand({
          Bucket: r2BucketName,
          Key: key,
        })
      );
      console.log(`[generateDailyBanner] Using cached R2 banner for ${devotionId}`);
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

      // Memastikan nama file 'key' dibaca dari variabel di atasnya yaitu `daily-banners/${devotionId}.webp`
      const currentKey = `daily-banners/${devotionId}.webp`;
      const proxyUrlBase = `${appUrl.replace(/\/$/, "")}/api/media/public?key=${encodeURIComponent(currentKey)}`;

      // Menambahkan timestamp unik agar browser handphone tidak nge-cache URL ini
      return `${proxyUrlBase}${proxyUrlBase.includes('?') ? '&' : '?'}t=${Date.now()}`;
    } catch (e: any) {
      // Proceed to generate
    }
  } else {
    console.log(`[generateDailyBanner] Force mode — skipping R2 cache, generating fresh banner for ${devotionId}`);
  }


  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

    const descText = verseRef.length > 40
      ? verseRef
      : `${verseRef} - "${verseText.substring(0, 80)}${verseText.length > 80 ? "..." : ""}"`;
    const bannerApiUrl = `${appUrl}/api/admin/generate-image?title=${encodeURIComponent(title)}&description=${encodeURIComponent(descText)}&icon=logo&bg=sage`;

    console.log(`[generateDailyBanner] Fetching banner from: ${bannerApiUrl.substring(0, 100)}...`);
    const imgResponse = await fetch(bannerApiUrl);
    if (!imgResponse.ok) {
      console.error(`[generateDailyBanner] Failed to fetch banner from API: ${imgResponse.status} ${imgResponse.statusText}`);
      return "";
    }

    const arrayBuffer = await imgResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let finalBuffer: any = buffer;
    let contentType = "image/png";

    try {
      const { optimizeToWebp } = await import("@/lib/server/image-optimizer");
      const optimized = await optimizeToWebp(buffer);
      finalBuffer = optimized.buffer;
      contentType = optimized.contentType;
    } catch (optErr) {
      console.error("[generateDailyBanner] WebP optimization failed, uploading original:", optErr);
    }

    await s3Client.send(
      new PutObjectCommand({
        Bucket: r2BucketName,
        Key: key,
        Body: finalBuffer,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000",
      })
    );

    console.log(`[generateDailyBanner] Successfully uploaded new banner to R2 for ${devotionId}`);
    const proxyUrlBase = `${appUrl.replace(/\/$/, "")}/api/media/public?key=${encodeURIComponent(key)}`;
    return `${proxyUrlBase}${proxyUrlBase.includes('?') ? '&' : '?'}t=${Date.now()}`;
  } catch (error) {
    console.error("[generateDailyBanner] Failed to generate/upload daily text banner to R2:", error);
    // As a fallback, return direct R2 public URL (may be blocked by some networks)
    return publicUrl ? `${publicUrl}?t=${Date.now()}` : "";
  }
}

export async function generateBlogBanner(
  slug: string,
  title: string,
  excerpt: string,
  options: { force?: boolean } = {},
): Promise<string> {
  const key = `blog-banners/${slug}.webp`;

  if (!s3Client || !r2BucketName || !r2PublicUrl) {
    return "";
  }

  const publicUrl = `${r2PublicUrl}/${key}`;

  if (!options.force) {
    try {
      await s3Client.send(
        new HeadObjectCommand({
          Bucket: r2BucketName,
          Key: key,
        })
      );
      console.log(`[generateBlogBanner] Using cached R2 banner for ${slug}`);
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

      const proxyUrlBase = `${appUrl.replace(/\/$/, "")}/api/media/public?key=${encodeURIComponent(key)}`;
      return `${proxyUrlBase}${proxyUrlBase.includes('?') ? '&' : '?'}t=${Date.now()}`;
    } catch (e: any) {
      // Proceed to generate
    }
  }

  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

    const bgColors = ["cream", "sage", "blue", "rose", "amber", "gray"];
    const randomBg = bgColors[Math.floor(Math.random() * bgColors.length)];

    const bannerApiUrl = `${appUrl}/api/admin/generate-image?title=${encodeURIComponent(title)}&description=${encodeURIComponent(excerpt)}&icon=logo&bg=${randomBg}`;

    console.log(`[generateBlogBanner] Fetching banner from: ${bannerApiUrl.substring(0, 100)}...`);
    const imgResponse = await fetch(bannerApiUrl);
    if (!imgResponse.ok) {
      console.error(`[generateBlogBanner] Failed to fetch banner from API: ${imgResponse.status} ${imgResponse.statusText}`);
      return "";
    }

    const arrayBuffer = await imgResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let finalBuffer: any = buffer;
    let contentType = "image/png";

    try {
      const { optimizeToWebp } = await import("@/lib/server/image-optimizer");
      const optimized = await optimizeToWebp(buffer);
      finalBuffer = optimized.buffer;
      contentType = optimized.contentType;
    } catch (optErr) {
      console.error("[generateBlogBanner] WebP optimization failed, uploading original:", optErr);
    }

    await s3Client.send(
      new PutObjectCommand({
        Bucket: r2BucketName,
        Key: key,
        Body: finalBuffer,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000",
      })
    );

    console.log(`[generateBlogBanner] Successfully uploaded new banner to R2 for ${slug}`);
    const proxyUrlBase = `${appUrl.replace(/\/$/, "")}/api/media/public?key=${encodeURIComponent(key)}`;
    return `${proxyUrlBase}${proxyUrlBase.includes('?') ? '&' : '?'}t=${Date.now()}`;
  } catch (error) {
    console.error("[generateBlogBanner] Failed to generate/upload blog banner to R2:", error);
    return publicUrl ? `${publicUrl}?t=${Date.now()}` : "";
  }
}



type DailyDevotion = {
  id: string;
  title: string;
  verseRef: string;
  verseText: string;
  body: string;
  prayer: string;
  status: string;
  provider?: string;
  imageUrl?: string;
  illustrationUrl?: string;
  bannerUrl?: string;
};

const scheduledVerses = [
  {
    ref: "Yohanes 3:16",
    text: "Karena Allah sangat mengasihi dunia ini, Ia memberikan Anak-Nya yang tunggal supaya setiap orang yang percaya kepada-Nya tidak binasa, melainkan memperoleh hidup yang kekal.",
  },
  {
    ref: "Mazmur 23:1",
    text: "TUHAN adalah gembalaku, aku tidak akan kekurangan.",
  },
  {
    ref: "Filipi 4:6",
    text: "Janganlah khawatir tentang apa pun juga. Namun, dalam segala sesuatu, nyatakan keinginanmu kepada Allah dalam doa dan permohonan dengan ucapan syukur.",
  },
  {
    ref: "Roma 8:28",
    text: "Kita tahu bahwa Allah turut bekerja dalam segala sesuatu untuk mendatangkan kebaikan bagi mereka yang mengasihi Dia.",
  },
  {
    ref: "Yesaya 41:10",
    text: "Jangan takut sebab Aku menyertai engkau; jangan bimbang sebab Aku ini Allahmu.",
  },
  {
    ref: "Matius 6:33",
    text: "Carilah dahulu Kerajaan Allah dan kebenarannya, dan semuanya itu akan ditambahkan kepadamu.",
  },
  {
    ref: "Amsal 3:5",
    text: "Percayalah kepada TUHAN dengan segenap hatimu, dan jangan bersandar kepada pengertianmu sendiri.",
  },
  {
    ref: "Yeremia 29:11",
    text: "Sebab Aku mengetahui rancangan-rancangan apa yang ada pada-Ku mengenai kamu, demikianlah firman TUHAN, yaitu rancangan damai sejahtera dan bukan rancangan kecelakaan, untuk memberikan kepadamu hari depan yang penuh harapan.",
  },
  {
    ref: "Mazmur 46:2",
    text: "Allah itu bagi kita tempat perlindungan dan kekuatan, sebagai penolong dalam kesesakan sangat terbukti.",
  },
  {
    ref: "Matius 11:28",
    text: "Marilah kepada-Ku, semua yang letih lesu dan berbeban berat, Aku akan memberi kelegaan kepadamu.",
  },
  {
    ref: "2 Korintus 12:9",
    text: "Cukuplah kasih karunia-Ku bagimu, sebab justru dalam kelemahanlah kuasa-Ku menjadi sempurna.",
  },
  {
    ref: "Mazmur 119:105",
    text: "Firman-Mu itu pelita bagi kakiku dan terang bagi jalanku.",
  },
  {
    ref: "Yosua 1:9",
    text: "Kuatkan dan teguhkanlah hatimu. Janganlah kecut dan tawar hati, sebab TUHAN, Allahmu, menyertai engkau ke mana pun engkau pergi.",
  },
  {
    ref: "1 Petrus 5:7",
    text: "Serahkanlah segala kekhawatiranmu kepada-Nya, sebab Ia yang memelihara kamu.",
  },
  {
    ref: "Kolose 3:23",
    text: "Apa pun juga yang kamu perbuat, perbuatlah dengan segenap hatimu seperti untuk Tuhan dan bukan untuk manusia.",
  },
  {
    ref: "Galatia 5:22-23",
    text: "Buah Roh ialah kasih, sukacita, damai sejahtera, kesabaran, kemurahan, kebaikan, kesetiaan, kelemahlembutan, penguasaan diri.",
  },
  {
    ref: "Ibrani 11:1",
    text: "Iman adalah dasar dari segala sesuatu yang kita harapkan dan bukti dari segala sesuatu yang tidak kita lihat.",
  },
  {
    ref: "Mazmur 121:1-2",
    text: "Aku melayangkan mataku ke gunung-gunung; dari manakah akan datang pertolonganku? Pertolonganku ialah dari TUHAN, yang menjadikan langit dan bumi.",
  },
  {
    ref: "Ratapan 3:22-23",
    text: "Tak berkesudahan kasih setia TUHAN, tak habis-habisnya rahmat-Nya, selalu baru tiap pagi; besar kesetiaan-Mu.",
  },
  {
    ref: "Efesus 2:8",
    text: "Sebab karena kasih karunia kamu diselamatkan oleh iman; itu bukan hasil usahamu, tetapi pemberian Allah.",
  },
  {
    ref: "Yakobus 1:5",
    text: "Apabila di antara kamu ada yang kekurangan hikmat, hendaklah ia memintakannya kepada Allah, yang memberikan kepada semua orang dengan murah hati.",
  },
  {
    ref: "Mikha 6:8",
    text: "Apakah yang dituntut TUHAN dari padamu: selain berlaku adil, mencintai kesetiaan, dan hidup dengan rendah hati di hadapan Allahmu?",
  },
  {
    ref: "1 Tesalonika 5:16-18",
    text: "Bersukacitalah senantiasa. Tetaplah berdoa. Mengucap syukurlah dalam segala hal, sebab itulah yang dikehendaki Allah di dalam Kristus Yesus bagi kamu.",
  },
  {
    ref: "Yesaya 40:31",
    text: "Orang-orang yang menanti-nantikan TUHAN mendapat kekuatan baru: mereka seumpama rajawali yang naik terbang dengan kekuatan sayapnya.",
  },
  {
    ref: "Mazmur 34:19",
    text: "TUHAN itu dekat kepada orang-orang yang patah hati, dan Ia menyelamatkan orang-orang yang remuk jiwanya.",
  },
  {
    ref: "Roma 12:2",
    text: "Janganlah kamu menjadi serupa dengan dunia ini, tetapi berubahlah oleh pembaharuan budimu.",
  },
  {
    ref: "Yohanes 14:27",
    text: "Damai sejahtera Kutinggalkan bagimu. Damai sejahtera-Ku Kuberikan kepadamu, dan apa yang Kuberikan tidak seperti yang diberikan oleh dunia kepadamu.",
  },
  {
    ref: "Mazmur 37:5",
    text: "Serahkanlah hidupmu kepada TUHAN dan percayalah kepada-Nya, dan Ia akan bertindak.",
  },
  {
    ref: "Filipi 4:13",
    text: "Segala perkara dapat kutanggung di dalam Dia yang memberi kekuatan kepadaku.",
  },
  {
    ref: "2 Timotius 1:7",
    text: "Allah memberikan kepada kita bukan roh ketakutan, melainkan roh yang membangkitkan kekuatan, kasih, dan ketertiban.",
  },
  {
    ref: "Matius 5:14-16",
    text: "Kamu adalah terang dunia. Demikianlah hendaknya terangmu bercahaya di depan orang, supaya mereka melihat perbuatanmu yang baik dan memuliakan Bapamu yang di sorga.",
  },
  {
    ref: "Roma 5:8",
    text: "Allah menunjukkan kasih-Nya kepada kita, oleh karena Kristus telah mati untuk kita, ketika kita masih berdosa.",
  },
  {
    ref: "1 Yohanes 4:18",
    text: "Di dalam kasih tidak ada ketakutan: kasih yang sempurna melenyapkan ketakutan.",
  },
  {
    ref: "Mazmur 27:1",
    text: "TUHAN adalah terangku dan keselamatanku, kepada siapakah aku harus takut? TUHAN adalah benteng hidupku, terhadap siapakah aku harus gemetar?",
  },
  {
    ref: "Ibrani 4:16",
    text: "Sebab itu marilah kita dengan penuh keberanian menghampiri takhta kasih karunia, supaya kita menerima rahmat dan menemukan kasih karunia untuk mendapat pertolongan kita pada waktunya.",
  },
  {
    ref: "2 Korintus 5:17",
    text: "Jadi siapa yang ada di dalam Kristus, ia adalah ciptaan baru: yang lama sudah berlalu, sesungguhnya yang baru sudah datang.",
  },
  {
    ref: "Efesus 6:10",
    text: "Akhirnya, hendaklah kamu kuat di dalam Tuhan, di dalam kekuatan kuasa-Nya.",
  },
  {
    ref: "Yakobus 4:8",
    text: "Mendekatlah kepada Allah, dan Ia akan mendekat kepadamu.",
  },
  {
    ref: "Mazmur 139:23-24",
    text: "Selidikilah aku, ya Allah, dan kenallah hatiku; ujilah aku dan kenallah pikiran-pikiranku; lihatlah, apakah jalanku serong, dan tuntunlah aku di jalan yang kekal.",
  },
  {
    ref: "Lukas 9:23",
    text: "Setiap orang yang mau mengikut Aku, ia harus menyangkal dirinya, memikul salibnya setiap hari dan mengikut Aku.",
  },
  {
    ref: "Yohanes 15:5",
    text: "Akulah pokok anggur dan kamulah ranting-rantingnya. Barangsiapa tinggal di dalam Aku dan Aku di dalam dia, ia berbuah banyak.",
  },
  {
    ref: "Roma 15:13",
    text: "Semoga Allah, sumber pengharapan, memenuhi kamu dengan segala sukacita dan damai sejahtera dalam iman kamu.",
  },
  {
    ref: "1 Korintus 13:4-7",
    text: "Kasih itu sabar; kasih itu murah hati; ia tidak cemburu. Ia tidak memegahkan diri dan tidak sombong.",
  },
  {
    ref: "Mazmur 19:15",
    text: "Mudah-mudahan Engkau berkenan akan ucapan mulutku dan renungan hatiku, ya TUHAN, gunung batuku dan penebusku.",
  },
  {
    ref: "Amsal 16:3",
    text: "Serahkanlah perbuatanmu kepada TUHAN, maka terlaksanalah segala rencanamu.",
  },
  {
    ref: "Yesaya 26:3",
    text: "Yang hatinya teguh Kaujagai dengan damai sejahtera, sebab kepada-Mulah ia percaya.",
  },
  {
    ref: "Matius 28:19-20",
    text: "Pergilah, jadikanlah semua bangsa murid-Ku dan baptislah mereka dalam nama Bapa dan Anak dan Roh Kudus.",
  },
  {
    ref: "Kisah Para Rasul 1:8",
    text: "Kamu akan menerima kuasa, kalau Roh Kudus turun ke atas kamu, dan kamu akan menjadi saksi-Ku.",
  },
  {
    ref: "Roma 10:17",
    text: "Iman timbul dari pendengaran, dan pendengaran oleh firman Kristus.",
  },
  {
    ref: "2 Korintus 4:16",
    text: "Sebab itu kami tidak tawar hati, tetapi meskipun manusia lahiriah kami semakin merosot, namun manusia batiniah kami dibaharui dari sehari ke sehari.",
  },
  {
    ref: "Galatia 2:20",
    text: "Aku telah disalibkan dengan Kristus; namun aku hidup, tetapi bukan lagi aku sendiri yang hidup, melainkan Kristus yang hidup di dalam aku.",
  },
  {
    ref: "Efesus 4:32",
    text: "Hendaklah kamu ramah seorang terhadap yang lain, penuh kasih mesra dan saling mengampuni, sebagaimana Allah di dalam Kristus telah mengampuni kamu.",
  },
  {
    ref: "Filipi 1:6",
    text: "Ia, yang memulai pekerjaan yang baik di antara kamu, akan meneruskannya sampai pada akhirnya pada hari Kristus Yesus.",
  },
  {
    ref: "Kolose 3:2",
    text: "Pikirkanlah perkara yang di atas, bukan yang di bumi.",
  },
  {
    ref: "1 Timotius 4:12",
    text: "Jadilah teladan bagi orang-orang percaya, dalam perkataanmu, dalam tingkah lakumu, dalam kasihmu, dalam kesetiaanmu dan dalam kesucianmu.",
  },
  {
    ref: "Ibrani 12:1-2",
    text: "Marilah kita menanggalkan semua beban dan dosa yang begitu merintangi kita, dan berlomba dengan tekun dalam perlombaan yang diwajibkan bagi kita.",
  },
  {
    ref: "Yakobus 1:22",
    text: "Hendaklah kamu menjadi pelaku firman dan bukan hanya pendengar saja; sebab jika tidak demikian kamu menipu diri sendiri.",
  },
  {
    ref: "1 Petrus 2:9",
    text: "Kamulah bangsa yang terpilih, imamat yang rajani, bangsa yang kudus, umat kepunyaan Allah sendiri.",
  },
  {
    ref: "Wahyu 21:4",
    text: "Ia akan menghapus segala air mata dari mata mereka, dan maut tidak akan ada lagi.",
  },
  {
    ref: "Mazmur 90:12",
    text: "Ajarlah kami menghitung hari-hari kami sedemikian, hingga kami beroleh hati yang bijaksana.",
  },
  {
    ref: "Kejadian 1:1",
    text: "Pada mulanya Allah menciptakan langit dan bumi.",
  },
  {
    ref: "Kejadian 28:15",
    text: "Sesungguhnya Aku menyertai engkau dan Aku akan melindungi engkau, ke mana pun engkau pergi, dan Aku akan membawa engkau kembali ke negeri ini, sebab Aku tidak akan meninggalkan engkau, melainkan melakukan apa yang Kujanjikan kepadamu.",
  },
  {
    ref: "Ulangan 31:6",
    text: "Kuatkan dan teguhkanlah hatimu, janganlah takut dan janganlah gemetar karena mereka, sebab TUHAN, Allahmu, Dialah yang berjalan menyertai engkau; Ia tidak akan membiarkan engkau dan tidak akan meninggalkan engkau.",
  },
  {
    ref: "Yosua 24:15",
    text: "Tetapi jika kamu anggap salah untuk beribadah kepada TUHAN, pilihlah pada hari ini kepada siapa kamu akan beribadah... Tetapi aku dan seisi rumahku, kami akan beribadah kepada TUHAN!",
  },
  {
    ref: "Rut 1:16",
    text: "Sebab ke mana engkau pergi, ke situ jugalah aku pergi, dan di mana engkau bermalam, di situ jugalah aku bermalam: bangsamulah bangsaku dan Allahmulah Allahku.",
  },
  {
    ref: "1 Tawarikh 16:34",
    text: "Bersyukurlah kepada TUHAN, sebab Ia baik! Bahwasanya untuk selama-lamanya kasih setia-Nya.",
  },
  {
    ref: "Nehemia 8:11",
    text: "Jangan kamu bersusah hati, sebab sukacita karena TUHAN itulah perlindunganmu!",
  },
  {
    ref: "Ayub 19:25",
    text: "Tetapi aku tahu: Penebusku hidup, dan akhirnya Ia akan bangkit di atas debu.",
  },
  {
    ref: "Mazmur 1:1-2",
    text: "Berbahagialah orang yang tidak berjalan menurut nasihat orang fasik, yang tidak berdiri di jalan orang berdosa... tetapi yang kesukaannya ialah Taurat TUHAN.",
  },
  {
    ref: "Mazmur 16:11",
    text: "Engkau memberitahukan kepadaku jalan kehidupan; di hadapan-Mu ada sukacita berlimpah-limpah, di tangan kanan-Mu ada nikmat senantiasa.",
  },
  {
    ref: "Mazmur 18:3",
    text: "Ya TUHAN, bukit batuku, kubu pertahananku dan penyelamatku, Allahku, gunung batuku, tempat aku berlindung, perisaiku, tanduk keselamatanku, kota bentengku.",
  },
  {
    ref: "Mazmur 27:4",
    text: "Satu hal telah kuminta kepada TUHAN, ini yang kuingini: diam di rumah TUHAN seumur hidupku, menyaksikan kemurahan TUHAN dan menikmati bait-Nya.",
  },
  {
    ref: "Mazmur 28:7",
    text: "TUHAN adalah kekuatanku dan perisaiku; kepada-Nya hatiku percaya. Aku tertolong sebab itu beria-ria hatiku, dan dengan nyanyianku aku bersyukur kepada-Nya.",
  },
  {
    ref: "Mazmur 34:9",
    text: "Kecaplah dan lihatlah, betapa baiknya TUHAN itu! Berbahagialah orang yang berlindung pada-Nya!",
  },
  {
    ref: "Mazmur 37:4",
    text: "Dan bergembiralah karena TUHAN; maka Ia akan memberikan kepadamu apa yang diinginkan hatimu.",
  },
  {
    ref: "Mazmur 51:12",
    text: "Jadikanlah hatiku tahir, ya Allah, dan perbaharuilah batinku dengan roh yang teguh!",
  },
  {
    ref: "Mazmur 55:23",
    text: "Serahkanlah kuatirmu kepada TUHAN, maka Ia akan memelihara engkau! Tidak untuk selama-lamanya dibiarkan-Nya orang benar itu goyah.",
  },
  {
    ref: "Mazmur 56:4",
    text: "Waktu aku takut, aku ini percaya kepada-Mu.",
  },
  {
    ref: "Mazmur 62:6",
    text: "Hanya pada Allah saja kiranya aku tenang, sebab dari pada-Nyalah harapanku.",
  },
  {
    ref: "Mazmur 84:11",
    text: "Sebab lebih baik satu hari di pelataran-Mu dari pada seribu hari di tempat lain; lebih baik berdiri di ambang pintu rumah Allahku dari pada diam di kemah-kemah orang fasik.",
  },
  {
    ref: "Mazmur 100:4",
    text: "Masuklah melalui pintu gerbang-Nya dengan nyanyian syukur, ke dalam pelataran-Nya dengan puji-pujian, bersyukurlah kepada-Nya dan pujilah nama-Nya!",
  },
  {
    ref: "Mazmur 103:2",
    text: "Pujilah TUHAN, hai jiwaku, dan janganlah lupakan segala kebaikan-Nya!",
  },
  {
    ref: "Mazmur 118:24",
    text: "Inilah hari yang dijadikan TUHAN, marilah kita bersorak-sorak dan bersukacita karenanya!",
  },
  {
    ref: "Mazmur 119:9",
    text: "Dengan apakah seorang muda mempertahankan kelakuannya bersih? Dengan menjaganya sesuai dengan firman-Mu.",
  },
  {
    ref: "Mazmur 130:5",
    text: "Aku menanti-nantikan TUHAN, jiwaku menanti-nanti, dan aku mengharapkan firman-Nya.",
  },
  {
    ref: "Mazmur 139:14",
    text: "Aku bersyukur kepada-Mu oleh karena kejadianku dahsyat dan ajaib; ajaib apa yang Kaubuat, dan jiwaku benar-benar menyadarinya.",
  },
  {
    ref: "Amsal 3:6",
    text: "Akuilah Dia dalam segala lakumu, maka Ia akan meluruskan jalanmu.",
  },
  {
    ref: "Amsal 4:23",
    text: "Jagalah hatimu dengan segala kewaspadaan, karena dari situlah terpancar kehidupan.",
  },
  {
    ref: "Amsal 17:22",
    text: "Hati yang gembira adalah obat yang manjur, tetapi semangat yang patah mengeringkan tulang.",
  },
  {
    ref: "Amsal 18:10",
    text: "Nama TUHAN adalah menara yang kuat, ke sanalah orang benar berlari dan ia menjadi aman.",
  },
  {
    ref: "Pengkhotbah 3:11",
    text: "Ia membuat segala sesuatu indah pada waktunya, bahkan Ia memberikan kekekalan dalam hati mereka. Tetapi manusia tidak dapat menyelami pekerjaan yang dilakukan Allah dari awal sampai akhir.",
  },
  {
    ref: "Yesaya 9:5",
    text: "Sebab seorang anak telah lahir untuk kita, seorang putera telah diberikan untuk kita; lambang pemerintahan ada di atas bahunya, dan namanya disebutkan orang: Penasihat Ajaib, Allah yang Perkasa, Bapa yang Kekal, Raja Damai.",
  },
  {
    ref: "Yesaya 40:29",
    text: "Dia memberi kekuatan kepada yang lelah dan menambah semangat kepada yang tiada berdaya.",
  },
  {
    ref: "Yesaya 43:2",
    text: "Apabila engkau menyeberang melalui air, Aku akan menyertai engkau, atau melalui sungai-sungai, engkau tidak akan dihanyutkan; apabila engkau berjalan melalui api, engkau tidak akan dihanguskan.",
  },
  {
    ref: "Yesaya 53:5",
    text: "Tetapi dia tertikam oleh karena pemberontakan kita, dia diremukkan oleh karena kejahatan kita; ganjaran yang mendatangkan keselamatan bagi kita ditimpakan kepadanya, dan oleh bilur-bilurnya kita menjadi sembuh.",
  },
  {
    ref: "Yesaya 55:6",
    text: "Carilah TUHAN selama Ia berkenan ditemui; berserulah kepada-Nya selama Ia dekat!",
  },
  {
    ref: "Yeremia 17:7",
    text: "Diberkatilah orang yang mengandalkan TUHAN, yang menaruh harapannya pada TUHAN!",
  },
  {
    ref: "Yeremia 33:3",
    text: "Berserulah kepada-Ku, maka Aku akan menjawab engkau dan akan memberitahukan kepadamu hal-hal yang besar dan yang tidak terpahami, yang belum kauketahui.",
  },
  {
    ref: "Ratapan 3:25",
    text: "TUHAN adalah baik bagi orang yang berharap kepada-Nya, bagi jiwa yang mencari Dia.",
  },
  {
    ref: "Habakuk 3:17-18",
    text: "Sekalipun pohon ara tidak berbunga, pohon anggur tidak berbuah... namun aku akan bersorak-sorak di dalam TUHAN, beria-ria di dalam Allah yang menyelamatkan aku.",
  },
  {
    ref: "Matius 5:3",
    text: "Berbahagialah orang yang miskin di hadapan Allah, karena merekalah yang empunya Kerajaan Sorga.",
  },
  {
    ref: "Matius 6:34",
    text: "Sebab itu janganlah kamu kuatir akan hari besok, karena hari besok mempunyai kesusahannya sendiri. Kesusahan sehari cukuplah untuk sehari.",
  },
  {
    ref: "Matius 7:7",
    text: "Mintalah, maka akan diberikan kepadamu; carilah, maka kamu akan mendapat; ketoklah, maka pintu akan dibukakan bagimu.",
  },
  {
    ref: "Matius 18:20",
    text: "Sebab di mana dua atau tiga orang berkumpul dalam Nama-Ku, di situ Aku ada di tengah-tengah mereka.",
  },
  {
    ref: "Matius 22:37",
    text: "Jawab Yesus kepadanya: Kasihilah Tuhan, Allahmu, dengan segenap hatimu dan dengan segenap jiwamu dan dengan segenap akal budimu.",
  },
  {
    ref: "Markus 10:27",
    text: "Yesus memandang mereka dan berkata: Bagi manusia hal itu tidak mungkin, tetapi bukan bagi Allah. Sebab segala sesuatu mungkin bagi Allah.",
  },
  {
    ref: "Lukas 1:37",
    text: "Sebab bagi Allah tidak ada yang mustahil.",
  },
  {
    ref: "Lukas 6:31",
    text: "Dan sebagaimana kamu kehendaki supaya orang perbuat kepadamu, perbuatlah juga demikian kepada mereka.",
  },
  {
    ref: "Yohanes 1:12",
    text: "Tetapi semua orang yang menerima-Nya diberi-Nya kuasa supaya menjadi anak-anak Allah, yaitu mereka yang percaya dalam nama-Nya.",
  },
  {
    ref: "Yohanes 8:12",
    text: "Maka Yesus berkata pula kepada orang banyak, kata-Nya: Akulah terang dunia; barangsiapa mengikut Aku, ia tidak akan berjalan dalam kegelapan, melainkan ia akan mempunyai terang hidup.",
  },
  {
    ref: "Yohanes 10:10",
    text: "Pencuri datang hanya untuk mencuri dan membunuh dan membinasakan; Aku datang, supaya mereka mempunyai hidup, dan mempunyainya dalam segala kelimpahan.",
  },
  {
    ref: "Yohanes 11:25",
    text: "Jawab Yesus: Akulah kebangkitan dan hidup; barangsiapa percaya kepada-Ku, ia akan hidup walaupun ia sudah mati.",
  },
  {
    ref: "Yohanes 13:34",
    text: "Aku memberikan perintah baru kepada kamu, yaitu supaya kamu saling mengasihi; sama seperti Aku telah mengasihi kamu demikian pula kamu harus saling mengasihi.",
  },
  {
    ref: "Yohanes 14:6",
    text: "Kata Yesus kepadanya: Akulah jalan dan kebenaran dan hidup. Tidak ada seorangpun yang datang kepada Bapa, kalau tidak melalui Aku.",
  },
  {
    ref: "Yohanes 14:15",
    text: "Jikalau kamu mengasihi Aku, kamu akan menuruti segala perintah-Ku.",
  },
  {
    ref: "Kisah Para Rasul 4:12",
    text: "Dan keselamatan tidak ada di dalam siapapun juga selain di dalam Dia, sebab di bawah kolong langit ini tidak ada nama lain yang diberikan kepada manusia yang olehnya kita dapat diselamatkan.",
  },
  {
    ref: "Kisah Para Rasul 16:31",
    text: "Jawab mereka: Percayalah kepada Tuhan Yesus Kristus dan engkau akan selamat, engkau dan seisi rumahmu.",
  },
  {
    ref: "Roma 1:16",
    text: "Sebab aku mempunyai keyakinan yang kokoh dalam Injil, karena Injil adalah kekuatan Allah yang menyelamatkan setiap orang yang percaya, pertama-tama orang Yahudi, tetapi juga orang Yunani.",
  },
  {
    ref: "Roma 3:23",
    text: "Karena semua orang telah berbuat dosa dan telah kehilangan kemuliaan Allah.",
  },
  {
    ref: "Roma 5:1",
    text: "Sebab itu, kita yang dibenarkan karena iman, kita hidup dalam damai sejahtera dengan Allah oleh karena Tuhan kita, Yesus Kristus.",
  },
  // === 60 ayat tambahan ===
  {
    ref: "Kejadian 12:2",
    text: "Aku akan membuat engkau menjadi bangsa yang besar, dan memberkati engkau serta membuat namamu masyhur; dan engkau akan menjadi berkat.",
  },
  {
    ref: "Kejadian 50:20",
    text: "Memang kamu telah mereka-rekakan yang jahat terhadap aku, tetapi Allah telah mereka-rekakannya untuk kebaikan, dengan maksud melakukan seperti yang terjadi sekarang ini, yakni memelihara hidup suatu bangsa yang besar.",
  },
  {
    ref: "Keluaran 14:14",
    text: "TUHAN akan berperang untuk kamu, dan kamu akan diam saja.",
  },
  {
    ref: "Keluaran 15:2",
    text: "TUHAN itu kekuatanku dan mazmurku, Ia telah menjadi keselamatanku. Ia Allahku, kupuji Dia, Allah bapaku, kumuliakan Dia.",
  },
  {
    ref: "Imamat 19:18",
    text: "Kasihilah sesamamu manusia seperti dirimu sendiri; Akulah TUHAN.",
  },
  {
    ref: "Bilangan 6:24-26",
    text: "TUHAN memberkati engkau dan melindungi engkau; TUHAN menyinari engkau dengan wajah-Nya dan memberi engkau kasih karunia; TUHAN menghadapkan wajah-Nya kepadamu dan memberi engkau damai sejahtera.",
  },
  {
    ref: "Ulangan 6:5",
    text: "Kasihilah TUHAN, Allahmu, dengan segenap hatimu dan dengan segenap jiwamu dan dengan segenap kekuatanmu.",
  },
  {
    ref: "Ulangan 8:18",
    text: "Haruslah engkau ingat kepada TUHAN, Allahmu, sebab Dialah yang memberikan kepadamu kekuatan untuk memperoleh kekayaan.",
  },
  {
    ref: "1 Samuel 16:7",
    text: "Janganlah pandang parasnya atau perawakan yang tinggi, sebab Aku telah menolaknya. Bukan yang dilihat manusia yang dilihat Allah; manusia melihat apa yang di depan mata, tetapi TUHAN melihat hati.",
  },
  {
    ref: "2 Samuel 22:33",
    text: "Allah, Dialah kekuatanku yang teguh dan membuat jalanku tidak bercela.",
  },
  {
    ref: "1 Raja-raja 8:56",
    text: "Terpujilah TUHAN yang telah mengaruniakan ketenangan kepada umat-Nya Israel, sesuai dengan segala yang dijanjikan-Nya.",
  },
  {
    ref: "2 Tawarikh 7:14",
    text: "Dan umat-Ku, yang atasnya nama-Ku disebut, merendahkan diri, berdoa dan mencari wajah-Ku, lalu berbalik dari jalan-jalannya yang jahat, maka Aku akan mendengar dari sorga dan mengampuni dosa mereka, serta memulihkan negeri mereka.",
  },
  {
    ref: "Ezra 8:22",
    text: "Tangan Allah kita melindungi semua orang yang mencari Dia sehingga semuanya menjadi baik bagi mereka.",
  },
  {
    ref: "Ester 4:14",
    text: "Siapa tahu, mungkin justru untuk saat yang seperti ini engkau beroleh kedudukan sebagai ratu.",
  },
  {
    ref: "Ayub 42:2",
    text: "Aku tahu bahwa Engkau sanggup melakukan segala sesuatu, dan tidak ada rencana-Mu yang gagal.",
  },
  {
    ref: "Mazmur 4:9",
    text: "Dengan tenteram aku mau membaringkan diri, lalu segera tidur, sebab hanya Engkaulah, ya TUHAN, yang membiarkan aku diam dengan aman.",
  },
  {
    ref: "Mazmur 9:10-11",
    text: "Orang-orang yang mengenal nama-Mu percaya kepada-Mu, sebab tidak Kautinggalkan orang yang mencari-Mu, ya TUHAN.",
  },
  {
    ref: "Mazmur 23:4",
    text: "Sekalipun aku berjalan dalam lembah kekelaman, aku tidak takut bahaya, sebab Engkau besertaku; gada-Mu dan tongkat-Mu, itulah yang menghibur aku.",
  },
  {
    ref: "Mazmur 32:8",
    text: "Aku hendak mengajar dan menunjukkan jalan yang harus kautempuh; Aku hendak memberi nasihat, mata-Ku tertuju kepadamu.",
  },
  {
    ref: "Mazmur 40:2-3",
    text: "Aku sangat menanti-nantikan TUHAN, dan Ia condong ke arahku serta mendengar teriakku minta tolong. Dibawa-Nya aku naik dari lobang kebinasaan, dari lumpur rawa; ditetapkan-Nya kakiku di atas bukit batu, langkahku dipastikan-Nya.",
  },
  {
    ref: "Mazmur 46:11",
    text: "Diamlah dan ketahuilah, bahwa Akulah Allah! Aku ditinggikan di antara bangsa-bangsa, ditinggikan di bumi!",
  },
  {
    ref: "Mazmur 63:2",
    text: "Ya Allah, Engkaulah Allahku, aku mencari Engkau, jiwaku haus kepada-Mu, tubuhku rindu kepada-Mu, seperti tanah yang kering dan tandus, tiada berair.",
  },
  {
    ref: "Mazmur 73:26",
    text: "Sekalipun dagingku dan hatiku habis lenyap, gunung batuku dan bagianku untuk selama-lamanya ialah Allah.",
  },
  {
    ref: "Mazmur 91:1-2",
    text: "Orang yang duduk dalam lindungan Yang Mahatinggi dan bermalam dalam naungan Yang Mahakuasa akan berkata kepada TUHAN: Tempat perlindunganku dan kubu pertahananku, Allahku, yang kupercaya!",
  },
  {
    ref: "Mazmur 145:18",
    text: "TUHAN dekat pada setiap orang yang berseru kepada-Nya, pada setiap orang yang berseru kepada-Nya dalam kesetiaan.",
  },
  {
    ref: "Amsal 1:7",
    text: "Takut akan TUHAN adalah permulaan pengetahuan, tetapi orang bodoh menghina hikmat dan didikan.",
  },
  {
    ref: "Amsal 11:25",
    text: "Orang yang murah hati menjadi gemuk, dan siapa yang memberi minum, ia sendiri juga akan diberi minum.",
  },
  {
    ref: "Amsal 22:6",
    text: "Didiklah orang muda menurut jalan yang patut baginya, maka pada masa tuanya pun ia tidak akan menyimpang dari pada jalan itu.",
  },
  {
    ref: "Kidung Agung 8:7",
    text: "Air yang banyak tak dapat memadamkan cinta, sungai-sungai tak dapat menghanyutkannya.",
  },
  {
    ref: "Yesaya 6:8",
    text: "Lalu aku mendengar suara Tuhan berkata: Siapakah yang akan Kuutus, dan siapakah yang mau pergi untuk Aku? Maka sahutku: Ini aku, utuslah aku!",
  },
  {
    ref: "Yesaya 30:15",
    text: "Sebab beginilah firman Tuhan ALLAH, Yang Mahakudus, Allah Israel: Dengan bertobat dan tinggal diam kamu akan diselamatkan, dalam ketenangan dan kepercayaan terletak kekuatanmu.",
  },
  {
    ref: "Yesaya 40:8",
    text: "Rumput menjadi kering, bunga menjadi layu, tetapi firman Allah kita tetap untuk selama-lamanya.",
  },
  {
    ref: "Yesaya 46:4",
    text: "Sampai masa tuamu Aku tetap Dia dan sampai masa putih rambutmu Aku menggendong kamu. Aku telah melakukannya dan mau menanggung kamu terus; Aku mau memikul kamu dan menyelamatkan kamu.",
  },
  {
    ref: "Yeremia 1:5",
    text: "Sebelum Aku membentuk engkau dalam rahim ibumu, Aku telah mengenal engkau, dan sebelum engkau keluar dari kandungan, Aku telah menguduskan engkau.",
  },
  {
    ref: "Yeremia 31:3",
    text: "Dari jauh TUHAN menampakkan diri kepadanya: Aku mengasihi engkau dengan kasih yang kekal, sebab itu Aku melanjutkan kasih setia-Ku kepadamu.",
  },
  {
    ref: "Yehezkiel 36:26",
    text: "Kamu akan Kuberikan hati yang baru, dan roh yang baru di dalam batinmu dan Aku akan menjauhkan dari tubuhmu hati yang keras dan Kuberikan kepadamu hati yang taat.",
  },
  {
    ref: "Daniel 3:17",
    text: "Jika Allah kami yang kami puja sanggup melepaskan kami, maka Ia akan melepaskan kami dari perapian yang menyala-nyala itu, dan dari dalam tanganmu, ya raja.",
  },
  {
    ref: "Hosea 6:3",
    text: "Marilah kita mengenal dan berusaha sungguh-sungguh mengenal TUHAN; Ia pasti tampil seperti fajar dan akan datang kepada kita seperti hujan, seperti hujan pada akhir musim yang mengairi bumi.",
  },
  {
    ref: "Yoel 2:25",
    text: "Aku akan mengganti bagimu tahun-tahun yang hasilnya dimakan oleh belalang. Aku akan mengganti semuanya kembali.",
  },
  {
    ref: "Amos 5:24",
    text: "Tetapi biarlah keadilan bergulung-gulung seperti air dan kebenaran seperti sungai yang selalu mengalir.",
  },
  {
    ref: "Nahum 1:7",
    text: "TUHAN itu baik, Ia adalah tempat perlindungan pada waktu kesusahan; Ia mengenal orang-orang yang berlindung pada-Nya.",
  },
  {
    ref: "Zefanya 3:17",
    text: "TUHAN, Allahmu, ada di antaramu sebagai pahlawan yang memberi kemenangan. Ia bergirang karena engkau dengan sukacita, Ia membaharui engkau dalam kasih-Nya.",
  },
  {
    ref: "Zakharia 4:6",
    text: "Bukan dengan keperkasaan dan bukan dengan kekuatan, melainkan dengan Roh-Ku, firman TUHAN semesta alam.",
  },
  {
    ref: "Maleakhi 3:10",
    text: "Bawalah seluruh persembahan persepuluhan itu ke dalam rumah perbendaharaan, supaya ada persediaan makanan di rumah-Ku dan ujilah Aku, apakah Aku tidak membukakan bagimu tingkap-tingkap langit dan mencurahkan berkat kepadamu sampai berkelimpahan.",
  },
  {
    ref: "Markus 9:23",
    text: "Jawab Yesus: Katamu: jika Engkau dapat? Tidak ada yang mustahil bagi orang yang percaya!",
  },
  {
    ref: "Markus 11:24",
    text: "Karena itu Aku berkata kepadamu: apa saja yang kamu minta dan doakan, percayalah bahwa kamu telah menerimanya, maka hal itu akan diberikan kepadamu.",
  },
  {
    ref: "Lukas 11:9",
    text: "Oleh karena itu Aku berkata kepadamu: Mintalah, maka akan diberikan kepadamu; carilah, maka kamu akan mendapat; ketoklah, maka pintu akan dibukakan bagimu.",
  },
  {
    ref: "Yohanes 6:35",
    text: "Kata Yesus kepada mereka: Akulah roti hidup; barangsiapa datang kepada-Ku, ia tidak akan lapar lagi, dan barangsiapa percaya kepada-Ku, ia tidak akan haus lagi.",
  },
  {
    ref: "Yohanes 16:33",
    text: "Semuanya itu Kukatakan kepadamu, supaya kamu beroleh damai sejahtera dalam Aku. Dalam dunia kamu menderita penganiayaan, tetapi kuatkanlah hatimu, Aku telah mengalahkan dunia.",
  },
  {
    ref: "Roma 6:23",
    text: "Sebab upah dosa ialah maut; tetapi karunia Allah ialah hidup yang kekal dalam Kristus Yesus, Tuhan kita.",
  },
  {
    ref: "Roma 8:1",
    text: "Demikianlah sekarang tidak ada penghukuman bagi mereka yang ada di dalam Kristus Yesus.",
  },
  {
    ref: "Roma 8:31",
    text: "Jika Allah di pihak kita, siapakah yang akan melawan kita?",
  },
  {
    ref: "Roma 8:38-39",
    text: "Sebab aku yakin, bahwa baik maut, maupun hidup, baik malaikat-malaikat, maupun pemerintah-pemerintah, baik yang ada sekarang, maupun yang akan datang, atau kuasa-kuasa, baik yang di atas, maupun yang di bawah, ataupun sesuatu makhluk lain, tidak akan dapat memisahkan kita dari kasih Allah, yang ada dalam Kristus Yesus, Tuhan kita.",
  },
  {
    ref: "1 Korintus 10:13",
    text: "Pencobaan-pencobaan yang kamu alami ialah pencobaan-pencobaan biasa, yang tidak melebihi kekuatan manusia. Sebab Allah setia dan karena itu Ia tidak akan membiarkan kamu dicobai melampaui kekuatanmu.",
  },
  {
    ref: "1 Korintus 15:58",
    text: "Karena itu, saudara-saudaraku yang kekasih, berdirilah teguh, jangan goyah, dan giatlah selalu dalam pekerjaan Tuhan! Sebab kamu tahu, bahwa dalam persekutuan dengan Tuhan jerih payahmu tidak sia-sia.",
  },
  {
    ref: "2 Korintus 1:3-4",
    text: "Terpujilah Allah, Bapa Tuhan kita Yesus Kristus, Bapa yang penuh belas kasihan dan Allah sumber segala penghiburan, yang menghibur kami dalam segala penderitaan kami.",
  },
  {
    ref: "Efesus 3:20",
    text: "Bagi Dialah, yang dapat melakukan jauh lebih banyak dari pada yang kita doakan atau pikirkan, seperti yang dikerjakan kuasa-Nya di dalam kita.",
  },
  {
    ref: "Filipi 2:3-4",
    text: "Janganlah sesuatupun kamu perbuat karena kepentingan sendiri atau karena ingin dipuji. Sebaliknya, hendaklah dengan rendah hati yang seorang menganggap yang lain lebih utama dari pada dirinya sendiri.",
  },
  {
    ref: "Kolose 3:15",
    text: "Hendaklah damai sejahtera Kristus memerintah dalam hatimu, karena untuk itulah kamu telah dipanggil menjadi satu tubuh. Dan bersyukurlah.",
  },
  {
    ref: "1 Yohanes 1:9",
    text: "Jika kita mengaku dosa kita, maka Ia adalah setia dan adil, sehingga Ia akan mengampuni segala dosa kita dan menyucikan kita dari segala kejahatan.",
  },
  {
    ref: "Yohanes 14:1",
    text: "Janganlah gelisah hatimu; percayalah kepada Allah, percayalah juga kepada-Ku.",
  },
  {
    ref: "Yohanes 15:7",
    text: "Jikalau kamu tinggal di dalam Aku dan firman-Ku tinggal di dalam kamu, mintalah apa saja yang kamu kehendaki, dan kamu akan menerimanya.",
  },
  {
    ref: "1 Korintus 16:14",
    text: "Lakukanlah segala pekerjaanmu dalam kasih!",
  },
  {
    ref: "2 Korintus 5:21",
    text: "Dia yang tidak mengenal dosa telah dibuat-Nya menjadi dosa karena kita, supaya dalam Dia kita dibenarkan oleh Allah.",
  },
  {
    ref: "Galatia 6:9",
    text: "Janganlah kita jemu-jemu berbuat baik, karena apabila sudah datang waktunya, kita akan menuai, jika kita tidak menjadi lemah.",
  },
  {
    ref: "Efesus 5:2",
    text: "Dan hiduplah di dalam kasih, sebagaimana Kristus juga telah mengasihi kamu dan telah menyerahkan diri-Nya untuk kita sebagai persembahan dan korban yang harum bagi Allah.",
  },
  {
    ref: "Filipi 1:21",
    text: "Karena bagiku hidup adalah Kristus dan mati adalah keuntungan.",
  },
  {
    ref: "Filipi 2:13",
    text: "Karena Allahlah yang mengerjakan di dalam kamu baik kemauan maupun pekerjaan menurut kerelaan-Nya.",
  },
  {
    ref: "Filipi 4:19",
    text: "Allahku akan memenuhi segala keperluanmu menurut kekayaan dan kemuliaan-Nya dalam Kristus Yesus.",
  },
  {
    ref: "Kolose 3:17",
    text: "Dan segala sesuatu yang kamu lakukan dengan perkataan atau perbuatan, lakukanlah semuanya itu dalam nama Tuhan Yesus, sambil mengucap syukur oleh Dia kepada Allah, Bapa kita.",
  },
  {
    ref: "1 Tesalonika 5:11",
    text: "Karena itu nasihatilah seorang akan yang lain dan saling membangunlah kamu sama seperti yang memang kamu lakukan.",
  },
  {
    ref: "2 Timotius 3:16",
    text: "Segala tulisan yang diilhamkan Allah memang bermanfaat untuk mengajar, untuk menyatakan kesalahan, untuk memperbaiki kelakuan dan untuk mendidik orang dalam kebenaran.",
  },
  {
    ref: "Ibrani 13:8",
    text: "Yesus Kristus tetap sama, baik kemarin maupun hari ini dan sampai selama-lamanya.",
  },
  {
    ref: "Yakobus 1:2-3",
    text: "Saudara-saudaraku, anggaplah sebagai suatu kebahagiaan, apabila kamu jatuh ke dalam berbagai-bagai pencobaan, sebab kamu tahu, bahwa ujian terhadap imanmu itu menghasilkan ketekunan.",
  },
  {
    ref: "Yakobus 1:19",
    text: "Hai saudara-saudara yang kukasihi, ingatlah hal ini: setiap orang harus cepat untuk mendengar, tetapi lambat untuk berkata-kata, dan lambat untuk marah.",
  },
  {
    ref: "1 Petrus 3:15",
    text: "Tetapi kuduskanlah Kristus di dalam hatimu sebagai Tuhan! Dan siap sedialah pada segala waktu untuk memberi pertanggungjawaban kepada tiap-tiap orang yang meminta pertanggungjawaban dari kamu tentang pengharapan yang ada padamu.",
  },
  {
    ref: "1 Petrus 4:8",
    text: "Tetapi yang terutama: kasihilah sungguh-sungguh seorang akan yang lain, sebab kasih menutupi banyak sekali dosa.",
  },
  {
    ref: "1 Yohanes 3:18",
    text: "Anak-anakku, marilah kita mengasihi bukan dengan perkataan atau dengan lidah, tetapi dengan perbuatan dan dalam kebenaran.",
  },
  {
    ref: "1 Yohanes 4:19",
    text: "Kita mengasihi, karena Allah lebih dahulu mengasihi kita.",
  },
  {
    ref: "Wahyu 3:20",
    text: "Lihat, Aku berdiri di muka pintu dan mengetok; jikalau ada orang yang mendengar suara-Ku dan membukakan pintu, Aku akan masuk menemui dia dan makan bersama-sama dengan dia, dan ia bersama-sama dengan Aku.",
  },
  {
    ref: "Keluaran 14:13",
    text: "Tetapi berkatalah Musa kepada bangsa itu: Janganlah takut, berdirilah teguh dan lihatlah keselamatan dari TUHAN, yang akan diberikan-Nya hari ini kepadamu.",
  },
  {
    ref: "Ulangan 30:19",
    text: "Aku memanggil langit dan bumi menjadi saksi terhadap kamu pada hari ini: kepadamu kuperhadapkan kehidupan dan kematian, berkat dan kutuk. Pilihlah kehidupan, supaya engkau hidup, baik engkau maupun keturunanmu.",
  },
  {
    ref: "Hakim-hakim 6:12",
    text: "Malaikat TUHAN menampakkan diri kepadanya dan berfirman kepadanya, demikian: TUHAN menyertai engkau, ya pahlawan yang gagah berani.",
  },
  {
    ref: "1 Samuel 12:24",
    text: "Hanya takutlah akan TUHAN dan beribadahlah kepada-Nya dengan setia dengan segenap hatimu, sebab perhatikanlah betapa besarnya hal-hal yang dilakukan-Nya di antara kamu.",
  },
  {
    ref: "2 Samuel 7:22",
    text: "Sebab itu Engkau besar, ya Tuhan ALLAH, sebab tidak ada yang sama seperti Engkau dan tidak ada Allah selain Engkau menurut segala yang kami dengar dengan telinga kami.",
  },
  {
    ref: "2 Tawarikh 20:15",
    text: "Janganlah kamu takut dan terkejut karena laskar yang besar ini, sebab bukan kamu yang akan berperang melainkan Allah.",
  },
  {
    ref: "Ezra 10:4",
    text: "Bangkitlah, sebab perkara ini adalah tugasmu. Kami akan mendampingi engkau. Kuatkanlah hatimu dan bertindaklah!",
  },
  {
    ref: "Mazmur 3:4",
    text: "Tetapi Engkau, TUHAN, adalah perisai yang melindungi aku, Engkaulah kemuliaanku dan yang mengangkat kepalaku.",
  },
  {
    ref: "Mazmur 9:1",
    text: "Aku mau bersyukur kepada TUHAN dengan segenap hatiku, aku mau menceritakan segala perbuatan-Mu yang ajaib.",
  },
  {
    ref: "Mazmur 19:1",
    text: "Langit menceritakan kemuliaan Allah, dan cakrawala memberitakan pekerjaan tangan-Nya.",
  },
];

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

export function jakartaDateId(date = new Date()) {
  // Add 10 minutes buffer so that if the cron runs slightly early (e.g. 14:59:58 WIB), it resolves to the correct slot
  const bufferedDate = new Date(date.getTime() + 10 * 60 * 1000);
  const current = jakartaTimeParts(bufferedDate);

  if (current.hour < 5) {
    const previousDay = jakartaTimeParts(new Date(bufferedDate.getTime() - 86_400_000));
    return `golden-${previousDay.day}-05`;
  }

  return `golden-${current.day}-05`;
}

function getDynamicVerseText(ref: string, defaultText: string): string {
  if (!USE_WEB_BIBLE) return defaultText;

  try {
    const match = ref.trim().match(/^((?:\d\s*)?[a-zA-Z\u00C0-\u024F]+(?:\s+[a-zA-Z\u00C0-\u024F]+)*)\s+(\d+):(\d+)$/i);
    if (!match) return defaultText;

    const bookName = match[1].trim().toLowerCase();
    const chapterNum = parseInt(match[2], 10);
    const verseNum = parseInt(match[3], 10);

    const book = BIBLE_BOOKS.find(b => b.name.toLowerCase() === bookName || b.id.toLowerCase() === bookName);
    if (!book) return defaultText;

    const filePath = path.join(process.cwd(), "public", "bible", "ind_web", book.id, `${chapterNum}.json`);
    if (existsSync(filePath)) {
      const content = JSON.parse(readFileSync(filePath, "utf8"));
      const verseObj = content.chapter.content.find((v: any) => v.type === "verse" && Number(v.number) === verseNum);
      if (verseObj && verseObj.content && verseObj.content[0]) {
        return verseObj.content[0].trim();
      }
    }
  } catch (err) {
    console.warn(`[daily-devotion] Failed to fetch dynamic verse text for ${ref}:`, err);
  }
  return defaultText;
}

function verseForDate(dateId: string) {
  const match = dateId.match(/^golden-(\d{4})-(\d{2})-(\d{2})-(\d{2})$/);
  let selected = { ref: "", text: "" };
  if (!match) {
    const seed = dateId
      .split("")
      .reduce((total, char) => total + char.charCodeAt(0), 0);
    selected = scheduledVerses[seed % scheduledVerses.length];
  } else {
    const [_, y, m, d, h] = match;
    const year = parseInt(y, 10);
    const month = parseInt(m, 10) - 1;
    const day = parseInt(d, 10);

    const dateObj = new Date(Date.UTC(year, month, day));
    const daysSinceEpoch = Math.floor(dateObj.getTime() / 86400000);

    selected = scheduledVerses[daysSinceEpoch % scheduledVerses.length];
  }

  return {
    ref: selected.ref,
    text: getDynamicVerseText(selected.ref, selected.text),
  };
}

function fallbackDevotion(id: string): DailyDevotion {
  const verse = verseForDate(id);
  return {
    id,
    title: "Renungan Hari Ini",
    verseRef: verse.ref,
    verseText: verse.text,
    body:
      "Ambil waktu singkat hari ini untuk membaca ayat, mengucap syukur, dan menyerahkan satu kekhawatiran kepada Tuhan.",
    prayer:
      "Tuhan, tuntun aku menjalani hari ini dengan hati yang percaya, rendah hati, dan siap mengasihi sesama.",
    status: "published",
    provider: "fallback",
    imageUrl: selectDailyHeroImage(id),
  };
}

const memoryCache: { [dateId: string]: DailyDevotion } = {};

async function getFallbackDevotionWithAi(dateId: string): Promise<DailyDevotion> {
  if (memoryCache[dateId]) {
    return memoryCache[dateId];
  }

  try {
    const verse = verseForDate(dateId);
    const prompt = [
      `Buat renungan harian Kristen singkat untuk tanggal ${dateId}.`,
      `Ayat: ${verse.ref}`,
      `Teks: ${verse.text}`,
      "Format: Judul, Ayat, Renungan 2 paragraf pendek, Aplikasi praktis, Doa.",
      "Bahasa Indonesia, hangat, alkitabiah, and pastoral.",
    ].join("\n");

    const result = await askDeepSeek("devotional", prompt);
    if (result && result.answer && result.provider !== "demo") {
      const devotion = parseAiDevotion(
        dateId,
        verse.ref,
        verse.text,
        result.answer,
        result.provider,
      );
      memoryCache[dateId] = devotion;
      return devotion;
    }
  } catch (error) {
    console.error("Gagal membuat fallback dengan AI, menggunakan fallback statis:", error);
  }

  return fallbackDevotion(dateId);
}

function cleanMarkdownAndLabels(text: string): string {
  if (!text) return "";
  return text
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .split("\n")
    .map(line => line.replace(/^(judul|ayat|teks|isi|renungan|doa|aplikasi praktis|aplikasi)\s*:\s*/i, "").trim())
    .filter(Boolean)
    .join("\n");
}

function normalizeTitle(value: string) {
  return cleanMarkdownAndLabels(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function isGenericDevotionTitle(value: string) {
  const normalized = normalizeTitle(value);
  return !normalized || ["renungan hari ini", "renungan harian", "renungan"].includes(normalized);
}

function uniqueDevotionTitle(title: string, verseRef: string, dateId: string, existingTitles: Set<string>) {
  const cleanedTitle = cleanMarkdownAndLabels(title);
  const baseTitle = isGenericDevotionTitle(cleanedTitle)
    ? `Firman Hari Ini dari ${verseRef}`
    : cleanedTitle;

  if (!existingTitles.has(normalizeTitle(baseTitle))) {
    return baseTitle;
  }

  const slot = dateId.endsWith("-15") ? "Sore" : "Pagi";
  const datePart = dateId.replace(/^golden-/, "").replace(/-(05|15)$/, "");
  return `${baseTitle} (${slot} ${datePart})`;
}

async function downloadRenunganFromR2(): Promise<any[] | null> {
  if (!s3Client || !r2BucketName) return null;
  try {
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const zlib = await import("zlib");
    
    const command = new GetObjectCommand({
      Bucket: r2BucketName,
      Key: "backup/renungan.json",
    });
    const response = await s3Client.send(command);
    const body = response.Body;
    if (!body) return null;

    const buffer = Buffer.from(await body.transformToByteArray());
    let content: string;
    if (response.ContentEncoding === "gzip") {
      content = zlib.gunzipSync(buffer).toString("utf8");
    } else {
      content = buffer.toString("utf8");
    }
    return JSON.parse(content);
  } catch (err) {
    console.warn("[downloadRenunganFromR2] Failed to fetch renungan.json from R2:", err);
    return null;
  }
}

async function loadRecentDevotionTitles(db: Firestore, currentId: string) {
  const titles = new Set<string>();
  const recentTitles: string[] = [];

  try {
    const r2Data = await downloadRenunganFromR2();
    if (Array.isArray(r2Data)) {
      r2Data.forEach((devotion: any) => {
        const devId = devotion.id || devotion.dateId || "";
        if (devId === currentId) return;
        const rawTitle = devotion.title ?? "";
        const normalized = devotion.normalizedTitle || normalizeTitle(rawTitle);
        if (normalized) {
          titles.add(normalized);
          if (rawTitle) recentTitles.push(rawTitle);
        }
      });
      console.log(`[loadRecentDevotionTitles] Loaded ${titles.size} titles from R2`);
      return { titles, recentTitles };
    }
  } catch (e) {
    console.warn("Gagal mengambil data judul renungan dari R2:", e);
  }

  // Fallback to Firestore
  try {
    const snapshot = await db
      .collection("daily_devotions")
      .limit(50)
      .get();

    snapshot.forEach((doc) => {
      if (doc.id === currentId) return;
      const data = doc.data();
      const rawTitle = data.title ?? "";
      const normalized = data.normalizedTitle || normalizeTitle(rawTitle);
      if (normalized) {
        titles.add(normalized);
        if (rawTitle) recentTitles.push(rawTitle);
      }
    });
  } catch (error) {
    console.warn("Gagal mengecek judul renungan terdahulu:", error);
  }

  return { titles, recentTitles };
}

async function loadRecentVerseRefs(db: Firestore, currentId: string, dayLimit = 30): Promise<Set<string>> {
  const verseRefs = new Set<string>();

  try {
    const now = new Date();
    const cutoff = new Date(now.getTime() - dayLimit * 86_400_000);
    const cutoffId = `golden-${cutoff.toISOString().split("T")[0]}`;

    const r2Data = await downloadRenunganFromR2();
    if (Array.isArray(r2Data)) {
      r2Data.forEach((devotion: any) => {
        const devId = devotion.id || devotion.dateId || "";
        if (devId === currentId) return;
        if (devId >= cutoffId) {
          if (devotion.verseRef) {
            verseRefs.add(devotion.verseRef.trim());
          }
        }
      });
      console.log(`[loadRecentVerseRefs] Loaded ${verseRefs.size} verseRefs from R2`);
      return verseRefs;
    }
  } catch (e) {
    console.warn("Gagal mengambil data verseRef renungan dari R2:", e);
  }

  // Fallback to Firestore
  try {
    // Get devotions from past dayLimit days (based on ID naming: golden-YYYY-MM-DD-HH)
    const now = new Date();
    const cutoff = new Date(now.getTime() - dayLimit * 86_400_000);
    const cutoffId = `golden-${cutoff.toISOString().split("T")[0]}`;

    const snapshot = await db
      .collection("daily_devotions")
      .limit(50)
      .get();

    snapshot.forEach((doc) => {
      if (doc.id === currentId) return;
      // Only include if doc.id >= cutoffId (lexicographic comparison works for YYYY-MM-DD format)
      if (doc.id >= cutoffId) {
        const data = doc.data();
        if (data.verseRef) {
          verseRefs.add(data.verseRef.trim());
        }
      }
    });
  } catch (error) {
    console.warn("Gagal mengecek verseRef renungan terdahulu:", error);
  }

  return verseRefs;
}

async function ensureDevotionImages(db: Firestore, dateId: string, devotion: Partial<DailyDevotion>, options: { force?: boolean } = {}) {
  const updateData: Record<string, unknown> = {};

  if ((!devotion.imageUrl && !devotion.illustrationUrl) || (options.force && !devotion.imageUrl)) {
    console.log(`[ensureDevotionImages] Selecting static R2 hero image for ${dateId}`);
    const imageUrl = await generateDailyImage(dateId);
    if (imageUrl) updateData.imageUrl = imageUrl;
  }

  // Generate text banner — force=true will bypass R2 cache and create fresh banner
  if ((!devotion.bannerUrl || options.force) && devotion.title && devotion.verseRef && devotion.verseText) {
    console.log(`[ensureDevotionImages] Generating banner for ${dateId} (force=${options.force})`);
    const bannerUrl = await generateDailyBanner(dateId, devotion.title, devotion.verseRef, devotion.verseText, options);
    if (bannerUrl) updateData.bannerUrl = bannerUrl;
  }

  if (Object.keys(updateData).length > 0) {
    await db.collection("daily_devotions").doc(dateId).update({
      ...updateData,
      updatedAt: FieldValue.serverTimestamp(),
    });
    console.log(`[ensureDevotionImages] Saved ${Object.keys(updateData).join(", ")} to Firestore for ${dateId}`);
  }

  return updateData;
}

function timestampMillis(value: unknown) {
  if (!value) return 0;

  if (
    typeof value === "object" &&
    "toMillis" in value &&
    typeof value.toMillis === "function"
  ) {
    return value.toMillis();
  }

  const parsed = new Date(String(value)).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function devotionSortTime(data: Record<string, unknown>) {
  return timestampMillis(data.generatedAt) || timestampMillis(data.updatedAt);
}

function parseAiDevotion(id: string, verseRef: string, verseText: string, answer: string, provider: string): DailyDevotion {
  // Split the answer into lines but KEEP empty lines as paragraph boundaries!
  const lines = answer.split("\n").map((line) => line.trim());

  let title = "";
  let extractedVerseRef = "";
  let extractedVerseText = "";
  let bodyParagraphs: string[] = [];
  let prayerParagraphs: string[] = [];

  let currentSection: "none" | "title" | "verse" | "verse_text" | "body" | "prayer" = "none";
  let currentParagraph = "";

  for (const line of lines) {
    // Strip markdown formatting for prefix/label checking
    const cleanLine = line.replace(/\*\*/g, "").replace(/^#+\s*/, "").trim();
    const cleanLower = cleanLine.toLowerCase();

    // Check for section markers
    if (cleanLower.startsWith("judul:") || cleanLower === "judul" || cleanLower.startsWith("title:") || cleanLower === "title") {
      currentSection = "title";
      title = cleanLine.replace(/^(judul|title)\s*:\s*/i, "").trim();
      continue;
    }

    if (cleanLower.startsWith("ayat:") || cleanLower === "ayat" || cleanLower.startsWith("verse:") || cleanLower === "verse") {
      currentSection = "verse";
      const content = cleanLine.replace(/^(ayat|verse)\s*:\s*/i, "").trim();
      if (content) {
        extractedVerseRef = content;
      }
      continue;
    }

    if (cleanLower.startsWith("teks:") || cleanLower === "teks" || cleanLower.startsWith("isi:") || cleanLower === "isi" || cleanLower.startsWith("ayat teks:") || cleanLower.startsWith("teks ayat:")) {
      currentSection = "verse_text";
      const content = cleanLine.replace(/^(teks|isi|ayat teks|teks ayat)\s*:\s*/i, "").trim();
      if (content) {
        extractedVerseText = content;
      }
      continue;
    }

    if (cleanLower.startsWith("renungan:") || cleanLower === "renungan" || cleanLower.startsWith("refleksi:") || cleanLower === "refleksi" || cleanLower.startsWith("aplikasi:") || cleanLower.startsWith("aplikasi praktis:")) {
      currentSection = "body";
      if (currentParagraph) {
        bodyParagraphs.push(currentParagraph);
        currentParagraph = "";
      }
      const content = cleanLine.replace(/^(renungan|refleksi|aplikasi praktis|aplikasi)\s*:\s*/i, "").trim();
      if (content) {
        currentParagraph = content;
      }
      continue;
    }

    if (cleanLower.startsWith("doa:") || cleanLower === "doa" || cleanLower.startsWith("prayer:") || cleanLower === "prayer") {
      currentSection = "prayer";
      if (currentParagraph) {
        bodyParagraphs.push(currentParagraph);
        currentParagraph = "";
      }
      const content = cleanLine.replace(/^(doa|prayer)\s*:\s*/i, "").trim();
      if (content) {
        currentParagraph = content;
      }
      continue;
    }

    // If it's an empty line, flush current paragraph to appropriate section
    if (cleanLine === "") {
      if (currentParagraph) {
        if (currentSection === "body") {
          bodyParagraphs.push(currentParagraph);
        } else if (currentSection === "prayer") {
          prayerParagraphs.push(currentParagraph);
        }
        currentParagraph = "";
      }
      continue;
    }

    // Append text to current active section or handle transitions if unlabeled
    if (currentSection === "title") {
      // Title is usually one line, so any subsequent line transitions to the Verse!
      currentSection = "verse";
      extractedVerseRef = cleanLine;
    } else if (currentSection === "verse") {
      // Verse reference is usually one line, so any subsequent line transitions to the Body!
      currentSection = "body";
      currentParagraph = cleanLine;
    } else if (currentSection === "verse_text") {
      // Verse text is usually one line or a block, any subsequent line starts the Body!
      currentSection = "body";
      currentParagraph = cleanLine;
    } else if (currentSection === "body") {
      currentParagraph = currentParagraph ? `${currentParagraph} ${cleanLine}` : cleanLine;
    } else if (currentSection === "prayer") {
      currentParagraph = currentParagraph ? `${currentParagraph} ${cleanLine}` : cleanLine;
    } else {
      // Fallback: if we haven't matched a section yet, assume it's the title
      currentSection = "title";
      title = cleanLine;
    }
  }

  // Flush any remaining active paragraphs
  if (currentParagraph) {
    if (currentSection === "body") {
      bodyParagraphs.push(currentParagraph);
    } else if (currentSection === "prayer") {
      prayerParagraphs.push(currentParagraph);
    }
  }

  // Split combined verse ref & text if needed (e.g. "Filipi 4:6 - Janganlah khawatir...")
  let finalVerseRef = extractedVerseRef || verseRef;
  let finalVerseText = extractedVerseText || verseText;

  if (finalVerseRef && !finalVerseText && finalVerseRef.includes(" - ")) {
    const parts = finalVerseRef.split(" - ");
    finalVerseRef = parts[0].trim();
    finalVerseText = parts.slice(1).join(" - ").replace(/^["'“”]/, "").replace(/["'“”]$/, "").trim();
  }

  // Format paragraphs nicely back into a single string with \n separation
  const cleanTitle = cleanMarkdownAndLabels(title);
  const cleanBody = bodyParagraphs.map(p => cleanMarkdownAndLabels(p)).filter(Boolean).join("\n\n");
  const cleanPrayer = prayerParagraphs.map(p => cleanMarkdownAndLabels(p)).filter(Boolean).join("\n\n");

  return {
    id,
    title: cleanTitle || "Renungan Hari Ini",
    verseRef: cleanMarkdownAndLabels(finalVerseRef),
    verseText: cleanMarkdownAndLabels(finalVerseText),
    body: cleanBody || "Renungan belum tersedia.",
    prayer: cleanPrayer || "Tuhan, ajar aku menerima firman-Mu dan melakukannya hari ini.",
    status: "published",
    provider,
  };
}

// Helper: deteksi apakah konten renungan adalah placeholder demo/gagal
function isDemoContent(data: Partial<DailyDevotion>): boolean {
  const DEMO_MARKERS = ["Mode demo aktif", "DEEPSEEK_API_KEY", "GEMINI_API_KEY", "OPENAI_API_KEY"];
  const checkStr = (s?: string): boolean => !!s && DEMO_MARKERS.some((m) => s.includes(m));
  return Boolean(
    data.provider === "demo" ||
    data.status === "demo" ||
    !data.title ||
    checkStr(data.title) ||
    checkStr(data.body) ||
    checkStr(data.prayer)
  );
}

export async function getLatestDevotion(): Promise<DailyDevotion> {
  const db = getAdminDb();
  const dateId = jakartaDateId();

  const getR2Fallback = async (): Promise<DailyDevotion | null> => {
    try {
      const { downloadFromR2 } = await import("@/lib/server/backup-r2-service");
      const r2DataStr = await downloadFromR2("renungan.json");
      if (r2DataStr) {
        const parsed = JSON.parse(r2DataStr);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Sort descending by dateId/id and skip demo content
          const validList = [...parsed]
            .sort((a: any, b: any) => {
              const dateA = a.dateId || a.id || "";
              const dateB = b.dateId || b.id || "";
              return dateB.localeCompare(dateA);
            })
            .filter((d: any) => !isDemoContent(d));

          const matched = validList.find((d: any) => d.id === dateId) ?? validList[0];

          if (matched) {
            console.log(`[getLatestDevotion] Loaded from R2 backup fallback (ID: ${matched.id})`);
            return {
              id: matched.id,
              title: cleanMarkdownAndLabels(matched.title ?? "Renungan Hari Ini"),
              verseRef: cleanMarkdownAndLabels(matched.verseRef ?? `${dailyVerse.book} ${dailyVerse.chapter}:${dailyVerse.verse}`),
              verseText: cleanMarkdownAndLabels(matched.verseText ?? dailyVerse.text),
              body: cleanMarkdownAndLabels(matched.body ?? "Renungan belum tersedia."),
              prayer: cleanMarkdownAndLabels(matched.prayer ?? "Tuhan, tuntun aku hari ini."),
              status: matched.status ?? "published",
              provider: matched.provider,
              imageUrl: resolveDailyHeroImage(matched.imageUrl, matched.illustrationUrl),
              illustrationUrl: matched.illustrationUrl,
              bannerUrl: matched.bannerUrl,
            };
          }
        }
      }
    } catch (r2Err) {
      console.error("[getLatestDevotion] Failed to fetch devotion from R2 backup:", r2Err);
    }
    return null;
  };

  // Check storage-config first (applies isBot redirect automatically)
  try {
    const { getActiveStorageConfig, getStorageSource } = await import("@/lib/server/storage-config");
    const storageConfig = await getActiveStorageConfig();
    const storageSource = getStorageSource("daily_devotions", "renungan.json", storageConfig);

    if (storageSource === "r2") {
      const r2Devotion = await getR2Fallback();
      if (r2Devotion) return r2Devotion;
    }
  } catch (err) {
    console.warn("[getLatestDevotion] Failed to verify storage source, checking Firestore next:", err);
  }

  if (!db) {
    const r2Fallback = await getR2Fallback();
    if (r2Fallback) return r2Fallback;
    return await getFallbackDevotionWithAi(dateId);
  }

  try {
    let doc = null;

    const currentDoc = await withDbTimeout(db.collection("daily_devotions").doc(dateId).get(), 2000);
    if (currentDoc.exists && currentDoc.data()?.status === "published" && !isDemoContent(currentDoc.data() as Partial<DailyDevotion>)) {
      doc = currentDoc;
    }

    try {
      if (!doc) {
        const snapshot = await withDbTimeout(
          db.collection("daily_devotions")
            .where("status", "==", "published")
            .limit(50)
            .get(),
          2000
        );

        if (!snapshot.empty) {
          const docs = [...snapshot.docs]
            .sort((a, b) => devotionSortTime(b.data()) - devotionSortTime(a.data()))
            .filter((d) => !isDemoContent(d.data()));
          if (docs.length > 0) doc = docs[0];
        }
      }
    } catch (indexError) {
      console.warn("Kueri dengan indeks gagal atau belum diindeks. Mencoba fallback memori:", indexError);
    }

    if (!doc) {
      // Fallback: get published devotions and sort them in-memory without relying on legacy dateId formats.
      const fallbackSnapshot = await withDbTimeout(
        db.collection("daily_devotions")
          .where("status", "==", "published")
          .limit(50)
          .get(),
        2000
      );

      if (!fallbackSnapshot.empty) {
        const docs = [...fallbackSnapshot.docs]
          .sort((a, b) => devotionSortTime(b.data()) - devotionSortTime(a.data()))
          .filter((d) => !isDemoContent(d.data()));
        if (docs.length > 0) doc = docs[0];
      }
    }

    if (!doc) {
      const r2Fallback = await getR2Fallback();
      if (r2Fallback) return r2Fallback;
      return await getFallbackDevotionWithAi(dateId);
    }

    const data = doc.data() as Partial<DailyDevotion>;

    return {
      id: doc.id,
      title: cleanMarkdownAndLabels(data.title ?? "Renungan Hari Ini"),
      verseRef: cleanMarkdownAndLabels(data.verseRef ?? `${dailyVerse.book} ${dailyVerse.chapter}:${dailyVerse.verse}`),
      verseText: cleanMarkdownAndLabels(data.verseText ?? dailyVerse.text),
      body: cleanMarkdownAndLabels(data.body ?? "Renungan belum tersedia."),
      prayer: cleanMarkdownAndLabels(data.prayer ?? "Tuhan, tuntun aku hari ini."),
      status: data.status ?? "published",
      provider: data.provider,
      imageUrl: resolveDailyHeroImage(data.imageUrl, data.illustrationUrl),
      illustrationUrl: data.illustrationUrl,
      bannerUrl: data.bannerUrl,
    };
  } catch (error) {
    console.error("Gagal mengambil renungan terbaru, menggunakan fallback:", error);
    reportDbFailure();
    const r2Fallback = await getR2Fallback();
    if (r2Fallback) return r2Fallback;
    return await getFallbackDevotionWithAi(dateId);
  }
}

export async function generateDailyDevotion(date = new Date(), options: { force?: boolean } = {}) {
  const db = getAdminDb();

  if (!db) {
    throw new Error("Firebase Admin belum dikonfigurasi.");
  }

  const dateId = jakartaDateId(date);
  const existing = await db.collection("daily_devotions").doc(dateId).get();

  if (existing.exists && !options.force) {
    const existingData = existing.data() as Partial<DailyDevotion>;
    const isDemo = existingData.provider === "demo" || 
                   existingData.status === "demo" || 
                   !existingData.title || 
                   existingData.title.includes("Mode demo aktif") ||
                   (existingData.body && existingData.body.includes("Mode demo aktif"));

    if (!isDemo) {
      const imageUpdates = await ensureDevotionImages(db, dateId, existingData);
      return {
        id: dateId,
        created: false,
        imageGenerated: Object.keys(imageUpdates).length > 0,
        existingTitle: existingData.title,
      };
    } else {
      console.log(`[generateDailyDevotion] Existing devotion for ${dateId} is a demo/failed placeholder. Force regenerating...`);
    }
  }

  // Load existing titles & recent verseRefs to avoid duplicates
  const { titles: existingTitles, recentTitles } = await loadRecentDevotionTitles(db, dateId);
  const recentVerseRefs = await loadRecentVerseRefs(db, dateId, 14);

  // Pick a verse that hasn't been used in the last 14 days, fallback to the default if all used
  let verse = verseForDate(dateId);
  if (recentVerseRefs.has(verse.ref)) {
    const match = dateId.match(/^golden-(\d{4})-(\d{2})-(\d{2})-(\d{2})$/);
    let baseIndex = 0;
    if (match) {
      const [_, y, m, d, h] = match;
      const year = parseInt(y, 10);
      const month = parseInt(m, 10) - 1;
      const day = parseInt(d, 10);
      const dateObj = new Date(Date.UTC(year, month, day));
      const daysSinceEpoch = Math.floor(dateObj.getTime() / 86400000);
      baseIndex = daysSinceEpoch;
    } else {
      baseIndex = dateId.split("").reduce((total, char) => total + char.charCodeAt(0), 0);
    }

    // Try up to 20 offset candidates to find an unused verse
    for (let offset = 1; offset <= 20; offset++) {
      const candidate = scheduledVerses[(baseIndex + offset) % scheduledVerses.length];
      if (!recentVerseRefs.has(candidate.ref)) {
        verse = candidate;
        break;
      }
    }
  }

  const titleAvoidance = recentTitles.length > 0
    ? `\n\nJangan gunakan atau menyerupai judul-judul berikut (sudah dipakai sebelumnya):\n${recentTitles.slice(0, 30).map(t => `- ${t}`).join("\n")}`
    : "";

  const prompt = [
    `Buat renungan harian Kristen untuk tanggal ${dateId}.`,
    `Ayat: ${verse.ref}`,
    `Teks: ${verse.text}`,
    "Format: Judul, Ayat, Renungan 3 paragraf pendek, Aplikasi praktis, Doa.",
    "Judul WAJIB spesifik dan unik. DILARANG memakai judul generik seperti: 'Renungan Hari Ini', 'Renungan Harian', 'Firman Hari Ini'.",
    "Buat judul yang mencerminkan inti pesan ayat dengan kata-kata yang menarik dan berbeda.",
    `${titleAvoidance}`,
    "Bahasa Indonesia, hangat, alkitabiah, dan pastoral.",
  ].join("\n");

  const result = await askDeepSeek("devotional", prompt);

  if (result.provider === "demo") {
    throw new Error("Gagal membuat renungan: AI gateway berjalan dalam mode demo (tidak ada API key yang valid).");
  }
  if (result.provider === "error") {
    throw new Error(`Gagal membuat renungan: Semua provider AI gagal. Detail: ${result.answer}`);
  }

  const devotion = parseAiDevotion(
    dateId,
    verse.ref,
    verse.text,
    result.answer,
    result.provider,
  );
  devotion.title = uniqueDevotionTitle(devotion.title, devotion.verseRef, dateId, existingTitles);
  devotion.imageUrl = selectDailyHeroImage(dateId);
  const normalizedTitle = normalizeTitle(devotion.title);

  const seoDescription = devotion.verseRef.length > 40
    ? devotion.verseRef
    : `${devotion.verseRef} - "${devotion.verseText.substring(0, 100)}${devotion.verseText.length > 100 ? "..." : ""}"`;

  // PERBAIKAN: Bungkus dengan try-catch agar kegagalan pembuatan SEO tidak membatalkan penyimpanan renungan utama ke Firestore
  let seo = null;
  try {
    seo = buildSeoFields({
      title: `${devotion.title} - Renungan Harian Grace Daily`,
      description: seoDescription,
      keywords: [devotion.title, devotion.verseRef, "renungan harian", "daily devotion", "Grace Daily"],
      slug: dateId,
      canonicalPath: `/renungan/${dateId}`,
      // Memberikan fallback string kosong agar properti 'image' aman dari nilai undefined saat runtime
      image: devotion.bannerUrl || devotion.imageUrl || devotion.illustrationUrl || "",
      publishedAt: new Date(),
      schemaType: "Article",
    });
  } catch (seoErr) {
    console.error("[generateDailyDevotion] Warning: Gagal memproses metadata SEO, dilewati agar dokumen tetap terbit:", seoErr);
  }

  // 1. Save devotion content to Firestore first to prevent data loss on serverless execution timeouts.
  // Force mode overwrites the same dateId document, so manual generation never creates duplicates.
  await db.collection("daily_devotions").doc(dateId).set({
    ...devotion,
    dateId,
    normalizedTitle,
    ...(seo ? { seo } : {}), // Memasukkan SEO secara opsional jika berhasil dibuat
    providerErrors: result.providerErrors ?? [],
    generatedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    socialsShareStatus: "pending",
    scheduledShareAt: new Date(Date.now() + 30 * 60 * 1000),
  });

  // 1b. Save generated devotion to Cloudflare R2 immediately (on-the-fly sync)
  try {
    const { uploadToR2Path } = await import("@/lib/server/backup-r2-service");
    const devotionPayload = {
      ...devotion,
      dateId,
      normalizedTitle,
      ...(seo ? { seo } : {}),
      providerErrors: result.providerErrors ?? [],
      generatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const devotionJson = JSON.stringify(devotionPayload);
    await uploadToR2Path(`devotions/${dateId}.json`, devotionJson);
    await uploadToR2Path("devotions/latest.json", devotionJson);
    console.log(`[generateDailyDevotion] Successfully synced devotion ${dateId} and latest.json to R2`);
  } catch (r2Err) {
    console.error("[generateDailyDevotion] Failed to sync devotion to R2:", r2Err);
  }

  // 2. Ensure static hero image URL and generated text banner are stored.
  try {
    await ensureDevotionImages(db, dateId, devotion, { force: options.force });
  } catch (e) {
    console.error("Failed to generate illustration image/banner during devotion creation:", e);
  }

  return {
    id: dateId,
    created: !existing.exists,
    regenerated: existing.exists && options.force,
    provider: result.provider,
    title: devotion.title,
  };
}

export async function getDevotionById(id: string): Promise<DailyDevotion | null> {
  const db = getAdminDb();
  let data: any = null;

  // Check storage-config first (handles isBot automatically)
  try {
    const { getActiveStorageConfig, getStorageSource } = await import("@/lib/server/storage-config");
    const storageConfig = await getActiveStorageConfig();
    const storageSource = getStorageSource("daily_devotions", "renungan.json", storageConfig);

    if (storageSource === "r2") {
      try {
        const { downloadFromR2 } = await import("@/lib/server/backup-r2-service");
        // Try to fetch individual file from R2 first
        try {
          const docStr = await downloadFromR2(`devotions/${id}.json`);
          if (docStr) {
            data = JSON.parse(docStr);
            console.log(`[getDevotionById] Loaded devotion ${id} from Cloudflare R2 individual file`);
          }
        } catch {
          // Ignore and fallback to bulk index download
        }

        if (!data) {
          const r2DataStr = await downloadFromR2("renungan.json");
          if (r2DataStr) {
            const parsed = JSON.parse(r2DataStr);
            if (Array.isArray(parsed)) {
              const matched = parsed.find((d: any) => d.id === id || d.dateId === id);
              if (matched) {
                data = matched;
                console.log(`[getDevotionById] Loaded devotion ${id} from Cloudflare R2 backup bulk file`);
              }
            }
          }
        }
      } catch (r2Err) {
        console.error(`[getDevotionById] Failed to load devotion ${id} from R2 first:`, r2Err);
      }
    }
  } catch (err) {
    console.warn("[getDevotionById] Failed to verify storage source:", err);
  }

  if (!data && db) {
    try {
      const docSnap = await withDbTimeout(db.collection("daily_devotions").doc(id).get(), 2000);
      if (docSnap.exists) {
        data = docSnap.data();
      }
    } catch (error) {
      console.error(`Gagal mengambil renungan dengan ID ${id} via Admin SDK:`, error);
    }
  }

  if (!data) {
    try {
      const restDoc = await fetchDocFromRest("daily_devotions", id);
      if (restDoc) {
        data = restDoc;
      }
    } catch (error) {
      console.error(`Gagal mengambil renungan dengan ID ${id} via REST:`, error);
    }
  }

  // Fallback to Cloudflare R2 backup
  if (!data) {
    try {
      const { downloadFromR2 } = await import("@/lib/server/backup-r2-service");
      const r2DataStr = await downloadFromR2("renungan.json");
      if (r2DataStr) {
        const parsed = JSON.parse(r2DataStr);
        if (Array.isArray(parsed)) {
          const matched = parsed.find((d: any) => d.id === id || d.dateId === id);
          if (matched) {
            data = matched;
            console.log(`[getDevotionById] Loaded devotion ${id} from Cloudflare R2 backup fallback`);
          }
        }
      }
    } catch (r2Err) {
      console.error(`[getDevotionById] Failed to load devotion ${id} from R2 fallback:`, r2Err);
    }
  }

  if (data) {
    return {
      id,
      title: cleanMarkdownAndLabels(data.title ?? "Renungan Hari Ini"),
      verseRef: cleanMarkdownAndLabels(data.verseRef ?? `${dailyVerse.book} ${dailyVerse.chapter}:${dailyVerse.verse}`),
      verseText: cleanMarkdownAndLabels(data.verseText ?? dailyVerse.text),
      body: cleanMarkdownAndLabels(data.body ?? "Renungan belum tersedia."),
      prayer: cleanMarkdownAndLabels(data.prayer ?? "Tuhan, tuntun aku hari ini."),
      status: data.status ?? "published",
      provider: data.provider,
      imageUrl: resolveDailyHeroImage(data.imageUrl, data.illustrationUrl),
      illustrationUrl: data.illustrationUrl,
      bannerUrl: data.bannerUrl,
    };
  }

  if (id.startsWith("golden-")) {
    return await getFallbackDevotionWithAi(id);
  }

  return null;
}