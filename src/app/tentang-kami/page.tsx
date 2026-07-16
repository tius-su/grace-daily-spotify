"use client";

import Link from "next/link";
import { useLanguage } from "@/lib/i18n";

export default function TentangKamiPage() {
  const { language } = useLanguage();

  const tLocal = (key: string) => {
    const dict: Record<string, Record<string, string>> = {
      title: { id: "Tentang Kami", en: "About Us", zh: "关于我们" },
      subtitle: { id: "Mengenal Lebih Dekat", en: "Getting Closer", zh: "深入了解" },
      welcome: { id: "Selamat Datang di Grace Daily", en: "Welcome to Grace Daily", zh: "欢迎来到 Grace Daily" },
      quietSpace: { id: "Ruang Teduh Digital Anda", en: "Your Digital Quiet Time Space", zh: "您的数字化灵修空间" },
      welcomeDesc: {
        id: "Di tengah dunia yang bergerak begitu cepat, menemukan waktu dan ruang yang tenang untuk bersekutu dengan Tuhan sering kali menjadi tantangan. Grace Daily lahir sebagai solusi praktis yang dirancang khusus untuk membantu Anda membangun, menjaga, dan memperdalam disiplin rohani harian Anda dengan fokus penuh pada kebenaran Firman Tuhan.",
        en: "In a fast-moving world, finding quiet time and space to fellowship with God is often a challenge. Grace Daily was born as a practical solution designed specifically to help you build, maintain, and deepen your daily spiritual discipline with a full focus on the truth of God's Word.",
        zh: "在这个快节奏的世界中，寻找安静的时间和空间与神相交往往是一个挑战。Grace Daily 应运而生，作为专门设计的实用解决方案，帮助您建立、保持和深化每日的属灵纪律，并完全专注于神话语的真理。"
      },
      missionTitle: { id: "Misi Kami", en: "Our Mission", zh: "我们的使命" },
      missionDesc: {
        id: "Kami percaya bahwa pertumbuhan iman yang sehat dimulai dari konsistensi membaca Firman, berdoa, dan berkomunitas. Oleh karena itu, Grace Daily hadir bukan hanya sekadar platform informasi, melainkan sebuah ekosistem spiritual yang siap menemani setiap langkah perjalanan iman Anda.",
        en: "We believe that healthy growth in faith begins with consistency in reading the Word, praying, and being in community. Therefore, Grace Daily exists not just as an information platform, but as a spiritual ecosystem ready to accompany every step of your faith journey.",
        zh: "我们相信，健康的信仰成长始于坚持读经、祷告和过社区生活。因此，Grace Daily 的存在不仅仅是一个信息平台，而是一个准备好陪伴您信仰旅程每一步的属灵生态系统。"
      },
      visionTitle: { id: "Visi Kami", en: "Our Vision", zh: "我们的愿景" },
      visionDesc: {
        id: "Menjadi wadah digital terpercaya yang menginspirasi, menguatkan, dan mendukung pertumbuhan rohani setiap orang percaya dalam membangun hubungan yang intim dengan Tuhan setiap hari.",
        en: "To be a trusted digital platform that inspires, strengthens, and supports the spiritual growth of every believer in building an intimate relationship with God daily.",
        zh: "成为值得信赖的数字化平台，启发、强化并支持每位信徒在每天建立与神亲密关系中的属灵成长。"
      },
      whatWeBring: { id: "Apa yang Kami Hadirkan untuk Anda?", en: "What Do We Offer You?", zh: "我们为您提供什么？" },
      whatWeBringDesc: {
        id: "Untuk mendukung perjalanan rohani Anda, kami menyediakan berbagai fitur utama yang saling terintegrasi dalam satu platform yang ramah pengguna.",
        en: "To support your spiritual journey, we provide key integrated features in a single user-friendly platform.",
        zh: "为了支持您的属灵旅程，我们在一款用户友好的平台中提供了多项核心整合功能。"
      },
      growTogether: { id: "Mari Bertumbuh Bersama", en: "Let's Grow Together", zh: "让我们共同成长" },
      growTogetherDesc: {
        id: "Baik Anda seorang jemaat awam, mahasiswa, ibu rumah tangga, maupun pemimpin komunitas sel (komsel), Grace Daily dirancang agar relevan, praktis, dan mudah digunakan oleh siapa saja.",
        en: "Whether you are a lay member, student, homemaker, or small group leader, Grace Daily is designed to be relevant, practical, and easy to use for everyone.",
        zh: "无论您是普通信徒、学生、家庭主妇还是小组领袖，Grace Daily 的设计都旨在让每个人都觉得相关、实用且易于使用。"
      },
      growTogetherSub: {
        id: "Mari jadikan setiap hari sebagai kesempatan untuk mengalami kasih karunia Tuhan yang baru. Mulailah saat teduh Anda hari ini bersama Grace Daily.",
        en: "Let's make every day an opportunity to experience God's new grace. Start your quiet time today with Grace Daily.",
        zh: "让我们把每一天都当作经历神新恩典的机会。今天就与 Grace Daily 一起开始您的灵修吧。"
      },
      continueJourney: { id: "Lanjutkan Perjalanan Spiritual Anda", en: "Continue Your Spiritual Journey", zh: "继续您的属灵旅程" },
      continueJourneyDesc: {
        id: "Temukan lebih banyak materi saat teduh dan pendalaman Alkitab di Grace Daily.",
        en: "Discover more quiet time materials and Bible studies on Grace Daily.",
        zh: "在 Grace Daily 上探索更多灵修材料和圣经研读。"
      },
      archiveTitle: { id: "Arsip Renungan Harian", en: "Daily Devotions Archive", zh: "每日灵修存档" },
      archiveDesc: {
        id: "Baca kembali renungan harian Kristen dari hari-hari sebelumnya. Temukan inspirasi firman Tuhan kapan saja untuk menuntun langkah Anda.",
        en: "Read Christian daily devotions from previous days. Find inspiration from God's word anytime to guide your steps.",
        zh: "阅读过往日期的基督徒每日灵修。随时从神的话语中获得灵感，指引您的脚步。"
      },
      archiveBtn: { id: "Buka Arsip Renungan", en: "Open Devotions Archive", zh: "打开灵修存档" },
      encyclopediaTitle: { id: "Ensiklopedia Alkitab", en: "Bible Encyclopedia", zh: "圣经百科全书" },
      encyclopediaDesc: {
        id: "Pelajari biografi tokoh-tokoh Alkitab, sejarah geografi tempat-tempat kudus, serta konsep teologi mendalam secara terpercaya.",
        en: "Learn the biography of Bible characters, history of holy places, and deep theological concepts reliably.",
        zh: "可靠地学习圣经人物传记、圣地历史地理以及深度神学概念。"
      },
      encyclopediaBtn: { id: "Jelajahi Ensiklopedia", en: "Explore Encyclopedia", zh: "探索百科全书" },
      backToHome: { id: "Kembali ke Beranda", en: "Back to Home", zh: "返回首页" }
    };
    return dict[key]?.[language] || dict[key]?.id || key;
  };

  const features = [
    {
      title: language === "zh" ? "灵修与每日金句" : language === "en" ? "Devotions & Daily Verses" : "Renungan & Ayat Harian",
      description: language === "zh" ? "从每日金句中提取的新鲜灵感、祷告和反思问题，以与神的美好相交开启您的一天。" : language === "en" ? "Find fresh inspiration, prayers, and reflection questions extracted from daily verses to start your day in sweet fellowship with God." : "Temukan inspirasi segar, doa, dan pertanyaan refleksi yang disarikan otomatis dari ayat harian untuk mengawali hari Anda dengan persekutuan yang manis bersama Tuhan.",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 text-[#2a6f6f]">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
        </svg>
      ),
    },
    {
      title: language === "zh" ? "在线圣经与百科" : language === "en" ? "Online Bible & Encyclopedia" : "Alkitab Online & Ensiklopedia",
      description: language === "zh" ? "无干扰的圣经阅读空间，与深度百科相整合，帮您准确学习圣经人物传记、圣地历史和神学概念。" : language === "en" ? "A distraction-free Bible reading space, integrated with a deep encyclopedia to accurately study biographies of Bible characters, geography of holy places, and theological terms." : "Ruang baca Alkitab yang minim distraksi, terintegrasi dengan ensiklopedia mendalam untuk mempelajari biografi tokoh, geografi tempat, dan istilah teologi Alkitab secara akurat.",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 text-[#2a6f6f]">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
        </svg>
      ),
    },
    {
      title: language === "zh" ? "问牧师与讲道助手" : language === "en" ? "Ask Pastor & Sermon Assistant" : "Tanya Pendeta & Asisten Khotbah",
      description: language === "zh" ? "基于实用神学的互动属灵辅导服务，以及为您量身定制的讲道准备或小组材料助手，尽在掌握。" : language === "en" ? "Interactive spiritual guidance based on practical theology and pastoral sermon prep or small group material assistant right in your hand." : "Layanan bimbingan rohani interaktif berbasis teologi praktis serta asisten persiapan khotbah atau bahan komsel yang dirancang secara pastoral langsung di genggaman Anda.",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 text-[#2a6f6f]">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.625.625 0 1 1-1.25 0 .625.625 0 0 1 1.25 0Zm4.5 0a.625.625 0 1 1-1.25 0 .625.625 0 0 1 1.25 0Zm4.5 0a.625.625 0 1 1-1.25 0 .625.625 0 0 1 1.25 0Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.084.29.125.597.125.904 0 2.203-1.651 4.19-3.951 4.893a7.485 7.485 0 0 1-5.762-.033C8.304 13.57 6.75 11.579 6.75 9.415c0-.307.041-.613.125-.904m13.375 0c-.102-.353-.26-.68-.468-.974a3.75 3.75 0 0 0-3.305-2.037 3.75 3.75 0 0 0-3.305 2.037c-.209.294-.366.621-.468.974m13.375 0h-13.375M1.5 9.75A8.25 8.25 0 0 1 9.75 1.5h.75A8.25 8.25 0 0 1 18.75 9.75v.75a8.25 8.25 0 0 1-8.25 8.25h-.75A8.25 8.25 0 0 1 1.5 10.5v-.75Z" />
        </svg>
      ),
    },
    {
      title: language === "zh" ? "属灵日志与祷告社区" : language === "en" ? "Spiritual Journal & Prayer Community" : "Jurnal Spiritual & Komunitas Doa",
      description: language === "zh" ? "隐私加密的安全空间，记录属灵成长日志、祷告蒙应允经历，同时可在社区祷告墙上提交祷告请求相互支持。" : language === "en" ? "A secure, privacy-encrypted space to journal your spiritual growth and answered prayers, while supporting each other by posting prayer requests on the community prayer wall." : "Ruang aman terenkripsi privasi untuk mencatat jurnal pertumbuhan rohani, jawaban doa, sekaligus saling mendukung dengan menaruh pokok doa di dinding doa komunitas.",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 text-[#2a6f6f]">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
        </svg>
      ),
    },
    {
      title: language === "zh" ? "PDF 灵修材料与音乐" : language === "en" ? "PDF Devotionals & Worship Music" : "PDF Devotional & Musik Rohani",
      description: language === "zh" ? "方便地将灵修或小组材料导出为随时可打印的 PDF 格式，以及推荐建立您信仰的赞美诗歌。" : language === "en" ? "Easily export quiet time or small group materials into print-ready PDF documents, alongside recommendation of praise and worship songs that build your faith." : "Kemudahan ekspor bahan saat teduh atau komsel ke dalam format dokumen PDF siap cetak, serta rekomendasi lagu pujian dan penyembahan yang membangun iman Anda.",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 text-[#2a6f6f]">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 0v11.25m0-11.25L9 9m0 0v11.25m10.5-11.25h-10.5" />
        </svg>
      ),
    },
  ];

  return (
    <main className="min-h-screen bg-[#f7f4ee] text-[#1f2933]">
      {/* Header navigasi */}
      <header className="border-b border-[#dfd8ca] bg-white px-5 py-5 sm:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <span className="text-xl font-bold tracking-wide text-[#14213d]">
              Grace Daily
            </span>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#2a6f6f] hover:underline"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            {tLocal("backToHome")}
          </Link>
        </div>
      </header>

      {/* Hero section tentang kami */}
      <section className="bg-[#14213d] py-16 text-white text-center px-5 relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_120%,rgba(244,162,97,0.18),transparent_70%)]" />
        <div className="mx-auto max-w-4xl">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#ffd166] mb-3">
            {tLocal("subtitle")}
          </p>
          <h1 className="text-4xl font-bold sm:text-5xl lg:text-6xl text-white tracking-tight leading-tight">
            {tLocal("welcome")}
          </h1>
          <p className="mt-4 text-[#ffd166] text-lg font-medium">
            {tLocal("quietSpace")}
          </p>
          <p className="mt-6 text-lg leading-8 text-white/80 max-w-3xl mx-auto">
            {tLocal("welcomeDesc")}
          </p>
        </div>
      </section>

      {/* Konten detail Visi & Misi */}
      <section className="py-16 px-5 sm:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-10 md:grid-cols-2">
            {/* Misi */}
            <div className="rounded-2xl border border-[#dfd8ca] bg-white p-8 shadow-sm">
              <h2 className="text-2xl font-bold text-[#14213d] flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e9f5db] text-[#2a6f6f] text-lg font-bold">1</span>
                {tLocal("missionTitle")}
              </h2>
              <p className="mt-4 text-[#52606d] leading-relaxed">
                {tLocal("missionDesc")}
              </p>
            </div>

            {/* Visi */}
            <div className="rounded-2xl border border-[#dfd8ca] bg-white p-8 shadow-sm">
              <h2 className="text-2xl font-bold text-[#14213d] flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e9f5db] text-[#2a6f6f] text-lg font-bold">2</span>
                {tLocal("visionTitle")}
              </h2>
              <p className="mt-4 text-[#52606d] leading-relaxed">
                {tLocal("visionDesc")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Fitur yang kami hadirkan */}
      <section className="py-16 bg-[#e9f5db]/30 border-y border-[#dfd8ca]/60 px-5 sm:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-[#14213d]">{tLocal("whatWeBring")}</h2>
            <p className="mt-3 text-[#52606d] max-w-2xl mx-auto">
              {tLocal("whatWeBringDesc")}
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, i) => (
              <div key={i} className="rounded-xl border border-[#dfd8ca] bg-white p-6 shadow-sm flex flex-col gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#e9f5db] shrink-0">
                  {feature.icon}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#14213d] mb-2">{feature.title}</h3>
                  <p className="text-sm text-[#52606d] leading-relaxed">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center max-w-3xl mx-auto">
            <h3 className="text-xl font-bold text-[#14213d]">{tLocal("growTogether")}</h3>
            <p className="mt-3 text-[#52606d] leading-relaxed">
              {tLocal("growTogetherDesc")}
            </p>
            <p className="mt-4 text-[#2a6f6f] font-semibold">
              {tLocal("growTogetherSub")}
            </p>
          </div>
        </div>
      </section>

      {/* Seksi Call-to-Action (CTA) di bagian akhir */}
      <section className="py-20 px-5 sm:px-8 bg-white">
        <div className="mx-auto max-w-4xl">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-[#14213d] tracking-tight">{tLocal("continueJourney")}</h2>
            <p className="mt-2 text-[#52606d]">{tLocal("continueJourneyDesc")}</p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* CTA ke Arsip Renungan */}
            <div className="rounded-2xl border border-[#dfd8ca] bg-[#f7f4ee]/40 p-8 flex flex-col justify-between hover:shadow-md transition group">
              <div>
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#2a6f6f]/10 text-[#2a6f6f] mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-[#14213d] group-hover:text-[#2a6f6f] transition-colors">{tLocal("archiveTitle")}</h3>
                <p className="mt-2 text-sm text-[#52606d] leading-relaxed">
                  {tLocal("archiveDesc")}
                </p>
              </div>
              <div className="mt-6">
                <Link
                  href="/renungan"
                  className="inline-flex w-full items-center justify-center rounded-lg bg-[#2a6f6f] px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-[#205555]"
                >
                  {tLocal("archiveBtn")}
                </Link>
              </div>
            </div>

            {/* CTA ke Ensiklopedia */}
            <div className="rounded-2xl border border-[#dfd8ca] bg-[#f7f4ee]/40 p-8 flex flex-col justify-between hover:shadow-md transition group">
              <div>
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#2a6f6f]/10 text-[#2a6f6f] mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.905 0-5.54-1.037-7.614-2.766m15.37 0A9 9 0 0 0 12 5.385a9 9 0 0 0-7.756 4.35" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-[#14213d] group-hover:text-[#2a6f6f] transition-colors">{tLocal("encyclopediaTitle")}</h3>
                <p className="mt-2 text-sm text-[#52606d] leading-relaxed">
                  {tLocal("encyclopediaDesc")}
                </p>
              </div>
              <div className="mt-6">
                <Link
                  href="/ensiklopedia"
                  className="inline-flex w-full items-center justify-center rounded-lg bg-[#14213d] px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-[#1a2e56]"
                >
                  {tLocal("encyclopediaBtn")}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
