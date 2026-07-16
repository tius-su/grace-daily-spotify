"use client";

import Link from "next/link";
import { useLanguage } from "@/lib/i18n";

export default function TermsAndConditions() {
  const { language } = useLanguage();

  const tLocal = (key: string) => {
    const dict: Record<string, Record<string, string>> = {
      backToHome: { id: "Kembali ke Beranda", en: "Back to Home", zh: "返回首页" },
      title: { id: "Syarat dan Ketentuan", en: "Terms and Conditions", zh: "服务条款与条件" },
      
      sec1Title: { id: "1. Penerimaan Syarat", en: "1. Acceptance of Terms", zh: "1. 条款接受" },
      sec1Content: {
        id: "Dengan mengakses dan menggunakan aplikasi Grace Daily, Anda menyetujui untuk terikat oleh Syarat dan Ketentuan ini. Jika Anda tidak setuju dengan bagian mana pun dari syarat ini, Anda tidak diperkenankan menggunakan layanan kami.",
        en: "By accessing and using the Grace Daily application, you agree to be bound by these Terms and Conditions. If you do not agree with any part of these terms, you are not permitted to use our services.",
        zh: "访问和使用 Grace Daily 应用程序即表示您同意受这些条款和条件的约束。如果您不同意这些条款的任何部分，则不允许使用我们的服务。"
      },
      
      sec2Title: { id: "2. Konten yang Dihasilkan oleh AI", en: "2. AI-Generated Content", zh: "2. AI 生成的内容" },
      sec2Content1: {
        id: "Semua konten di Grace Daily, termasuk renungan harian, artikel blog, ensiklopedia Alkitab, judul, ringkasan, dan ilustrasi gambar, dihasilkan secara otomatis menggunakan teknologi Kecerdasan Buatan (AI) berbasis model bahasa besar open-source dengan lisensi MIT.",
        en: "All content on Grace Daily, including daily devotions, blog articles, Bible encyclopedia, titles, summaries, and image illustrations, is automatically generated using Artificial Intelligence (AI) technology based on open-source large language models with MIT license.",
        zh: "Grace Daily 上的所有内容，包括每日灵修、博客文章、圣经百科全书、标题、摘要和图片插图，均使用基于 MIT 许可的开源大语言模型的自动人工智能（AI）技术生成。"
      },
      sec2Content2: {
        id: "Konten AI ini tidak diawasi atau diedit oleh manusia secara real-time, meskipun kami berusaha memastikan kualitas dan akurasi teologis melalui validasi otomatis. Anda bebas menggunakan, berbagi, dan memodifikasi konten ini sesuai dengan ketentuan lisensi MIT, dengan syarat mencantumkan atribusi yang sesuai.",
        en: "This AI content is not monitored or edited by humans in real-time, although we strive to ensure quality and theological accuracy through automated validation. You are free to use, share, and modify this content in accordance with the MIT license terms, provided appropriate attribution is given.",
        zh: "此 AI 内容没有人类实时监控或编辑，尽管我们努力通过自动验证确保质量和神学准确性。您可以根据 MIT 许可条款自由使用、分享和修改此内容，前提是必须注明适当的归属。"
      },
      
      sec3Title: { id: "3. Layanan Premium", en: "3. Premium Services", zh: "3. 尊享特权服务" },
      sec3Content: {
        id: "Grace Daily menawarkan layanan premium berbayar yang memberikan akses ke fitur-fitur eksklusif seperti kuota tanya jawab AI (Pendeta) dan fitur lanjutan lainnya. Pembayaran bersifat tidak dapat dikembalikan (non-refundable) kecuali ditentukan lain oleh hukum yang berlaku.",
        en: "Grace Daily offers paid premium services that provide access to exclusive features such as AI Q&A quota (Pastor) and other advanced features. Payments are non-refundable unless otherwise determined by applicable law.",
        zh: "Grace Daily 提供付费尊享特权服务，可访问专属功能，例如 AI 问答额度（牧师）及其他高级功能。除非适用法律另有规定，否则付款不可退还。"
      },
      
      sec4Title: { id: "4. Penggunaan Layanan", en: "4. Use of Services", zh: "4. 服务的使用" },
      sec4Content: {
        id: "Anda setuju untuk menggunakan layanan Grace Daily hanya untuk tujuan yang sah dan sesuai dengan ajaran moral kekristenan. Anda tidak diperkenankan menyalahgunakan fitur AI, menyebarkan konten yang tidak pantas, atau mengganggu kenyamanan pengguna lain di komunitas doa.",
        en: "You agree to use Grace Daily services only for lawful purposes and in accordance with Christian moral teachings. You are not allowed to abuse AI features, spread inappropriate content, or disturb other users in the prayer community.",
        zh: "您同意仅出于合法目的并按照基督徒道德规范使用 Grace Daily 服务。您不得滥用 AI 功能、传播不当内容或干扰祷告社区中的其他用户。"
      },
      
      sec5Title: { id: "5. Privasi dan Data", en: "5. Privacy and Data", zh: "5. 隐私与数据" },
      sec5Content: {
        id: "Kami sangat menghargai privasi Anda. Data pribadi Anda, termasuk catatan jurnal dan doa, disimpan dengan aman dan tidak akan dibagikan ke pihak ketiga tanpa persetujuan Anda, kecuali diwajibkan oleh hukum.",
        en: "We highly value your privacy. Your personal data, including journal notes and prayers, is securely stored and will not be shared with third parties without your consent, unless required by law.",
        zh: "我们高度重视您的隐私。您的个人数据，包括日志笔记和祷告，都将安全存储，未经您的同意不会与第三方分享，除非法律另有要求。"
      },
      
      sec6Title: { id: "6. Perubahan Ketentuan", en: "6. Changes to Terms", zh: "6. 条款变更" },
      sec6Content: {
        id: "Kami berhak memodifikasi atau mengganti Syarat dan Ketentuan ini kapan saja. Perubahan akan berlaku segera setelah dipublikasikan di halaman ini. Kami menyarankan Anda untuk meninjau halaman ini secara berkala.",
        en: "We reserve the right to modify or replace these Terms and Conditions at any time. Changes will take effect immediately upon being published on this page. We suggest you review this page periodically.",
        zh: "我们保留随时修改或更换这些服务条款与条件的权利。变更自在此页面发布 di 页面上发布之日起立即生效。我们建议您定期查看此页面。"
      }
    };
    return dict[key]?.[language] || dict[key]?.id || key;
  };

  return (
    <main className="min-h-screen bg-[#f7f4ee] text-[#1f2933] py-16 px-5 sm:px-8">
      <div className="mx-auto max-w-4xl bg-white p-8 sm:p-12 rounded-lg shadow-sm border border-[#dfd8ca]">
        <Link
          href="/"
          className="inline-flex items-center text-sm font-semibold text-[#2a6f6f] hover:underline mb-8"
        >
          &larr; {tLocal("backToHome")}
        </Link>
        <h1 className="text-3xl font-semibold text-[#14213d] mb-6">
          {tLocal("title")}
        </h1>
        
        <div className="space-y-6 text-[#52606d] leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-[#14213d] mb-3">{tLocal("sec1Title")}</h2>
            <p>
              {tLocal("sec1Content")}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#14213d] mb-3">{tLocal("sec2Title")}</h2>
            <p>
              {tLocal("sec2Content1")}
            </p>
            <p className="mt-3">
              {tLocal("sec2Content2")}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#14213d] mb-3">{tLocal("sec3Title")}</h2>
            <p>
              {tLocal("sec3Content")}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#14213d] mb-3">{tLocal("sec4Title")}</h2>
            <p>
              {tLocal("sec4Content")}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#14213d] mb-3">{tLocal("sec5Title")}</h2>
            <p>
              {tLocal("sec5Content")}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#14213d] mb-3">{tLocal("sec6Title")}</h2>
            <p>
              {tLocal("sec6Content")}
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
