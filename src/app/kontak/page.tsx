"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useLanguage } from "@/lib/i18n";

export default function KontakPage() {
  const { language } = useLanguage();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  const tLocal = (key: string) => {
    const dict: Record<string, Record<string, string>> = {
      contactUs: { id: "Kontak Kami", en: "Contact Us", zh: "联系我们" },
      hearYou: { id: "Kami selalu sedia mendengar Anda.", en: "We are always ready to hear from you.", zh: "我们随时倾听您的声音。" },
      backToHome: { id: "Kembali ke Beranda", en: "Back to Home", zh: "返回首页" },
      contactDesc: {
        id: "Jika Anda memiliki pertanyaan tentang aplikasi, ingin berbagi kesaksian, atau membutuhkan bantuan terkait paket berlangganan, jangan ragu untuk menghubungi kami.",
        en: "If you have questions about the application, want to share testimonies, or need help regarding subscription plans, do not hesitate to contact us.",
        zh: "如果您对应用有任何疑问、想要分享见证，或者需要关于订阅计划的帮助，请随时与我们联系。"
      },
      officialEmail: { id: "Email Resmi", en: "Official Email", zh: "官方电子邮箱" },
      sendMessageDirect: { id: "Kirim Pesan Secara Langsung", en: "Send Message Directly", zh: "直接发送信息" },
      successMsg: {
        id: "Pesan Anda berhasil dikirim! Kami akan merespons melalui email secepatnya.",
        en: "Your message has been sent successfully! We will respond via email as soon as possible.",
        zh: "您的信息已成功发送！我们将尽快通过电子邮件进行回复。"
      },
      errorMsg: {
        id: "Maaf, terjadi kesalahan saat mengirim pesan. Silakan coba beberapa saat lagi.",
        en: "Sorry, an error occurred while sending the message. Please try again later.",
        zh: "抱歉，发送信息时发生错误。请稍后重试。"
      },
      fullName: { id: "Nama Lengkap", en: "Full Name", zh: "姓名" },
      fullNamePlaceholder: { id: "Nama Anda", en: "Your Name", zh: "您的姓名" },
      emailAddress: { id: "Alamat Email", en: "Email Address", zh: "电子邮箱" },
      emailPlaceholder: { id: "email@anda.com", en: "email@your.com", zh: "email@your.com" },
      subject: { id: "Subjek / Judul Pesan (Opsional)", en: "Subject / Message Title (Optional)", zh: "主题 / 信息标题 (可选)" },
      subjectPlaceholder: { id: "Topik pesan", en: "Message topic", zh: "信息主题" },
      messageContent: { id: "Isi Pesan", en: "Message Content", zh: "信息内容" },
      messagePlaceholder: {
        id: "Tuliskan pertanyaan, saran, atau bantuan yang Anda butuhkan...",
        en: "Write down the questions, suggestions, or help you need...",
        zh: "写下您需要咨询的问题、建议或帮助内容..."
      },
      sending: { id: "Mengirim Pesan...", en: "Sending Message...", zh: "正在发送信息..." },
      sendMessage: { id: "Kirim Pesan", en: "Send Message", zh: "发送信息" },
      agreement: {
        id: "Dengan mengirimkan pesan, Anda setuju untuk dihubungi kembali melalui email yang tertera.",
        en: "By sending the message, you agree to be contacted back via the provided email address.",
        zh: "发送此信息即表示您同意我们通过所填写的电子邮箱与您联系。"
      }
    };
    return dict[key]?.[language] || dict[key]?.id || key;
  };

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name || !email || !message) return;
    
    setStatus("loading");
    
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          email,
          subject: subject || `Pesan Baru dari ${name}`,
          message,
        })
      });

      if (response.ok) {
        setStatus("success");
        setName("");
        setEmail("");
        setSubject("");
        setMessage("");
      } else {
        setStatus("error");
      }
    } catch (err) {
      console.error(err);
      setStatus("error");
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f4ee] px-5 py-6 text-[#1f2933] sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col justify-between gap-4 border-b border-[#dfd8ca] pb-6 md:flex-row md:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#2a6f6f]">
              {tLocal("contactUs")}
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-[#14213d]">
              {tLocal("hearYou")}
            </h1>
          </div>
          <Link
            href="/"
            className="rounded-md bg-[#14213d] px-4 py-2 text-center font-semibold text-white transition hover:bg-[#1a2d52]"
          >
            {tLocal("backToHome")}
          </Link>
        </header>

        <section className="grid gap-8 py-10 lg:grid-cols-[0.8fr_1.2fr] items-start">
          <div className="rounded-lg border border-[#dfd8ca] bg-white p-8">
            <h2 className="text-2xl font-semibold text-[#14213d]">Grace Daily</h2>
            <p className="mt-4 leading-7 text-[#52606d]">
              {tLocal("contactDesc")}
            </p>
            <div className="mt-8 grid gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#e9f5db] text-[#284b3a]">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#14213d]">{tLocal("officialEmail")}</p>
                  <p className="text-sm text-[#52606d]">info@gracedaily.my.id</p>
                </div>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="grid gap-5 rounded-lg border border-[#dfd8ca] bg-white p-8 shadow-sm">
            <h2 className="text-xl font-semibold text-[#14213d] mb-2">{tLocal("sendMessageDirect")}</h2>
            
            {status === "success" && (
              <div className="rounded-md bg-[#e9f5db] p-4 text-[#284b3a] font-semibold">
                {tLocal("successMsg")}
              </div>
            )}
            
            {status === "error" && (
              <div className="rounded-md bg-red-100 p-4 text-red-800 font-semibold">
                {tLocal("errorMsg")}
              </div>
            )}

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="grid gap-2">
                <label className="text-sm font-semibold text-[#14213d]">{tLocal("fullName")}</label>
                <input 
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="rounded-md border border-[#dfd8ca] px-4 py-3 outline-none focus:border-[#2a6f6f]"
                  placeholder={tLocal("fullNamePlaceholder")}
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-semibold text-[#14213d]">{tLocal("emailAddress")}</label>
                <input 
                  required
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="rounded-md border border-[#dfd8ca] px-4 py-3 outline-none focus:border-[#2a6f6f]"
                  placeholder={tLocal("emailPlaceholder")}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-semibold text-[#14213d]">{tLocal("subject")}</label>
              <input 
                value={subject}
                onChange={e => setSubject(e.target.value)}
                className="rounded-md border border-[#dfd8ca] px-4 py-3 outline-none focus:border-[#2a6f6f]"
                placeholder={tLocal("subjectPlaceholder")}
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-semibold text-[#14213d]">{tLocal("messageContent")}</label>
              <textarea 
                required
                value={message}
                onChange={e => setMessage(e.target.value)}
                className="min-h-40 rounded-md border border-[#dfd8ca] px-4 py-3 outline-none focus:border-[#2a6f6f]"
                placeholder={tLocal("messagePlaceholder")}
              />
            </div>
            
            <button 
              type="submit"
              disabled={status === "loading"}
              className="mt-2 w-full rounded-md bg-[#2a6f6f] px-5 py-4 text-center font-semibold text-white transition hover:bg-[#1a4a4a] disabled:opacity-50"
            >
              {status === "loading" ? tLocal("sending") : tLocal("sendMessage")}
            </button>
            
            <p className="text-center text-xs text-[#52606d] mt-2">
              {tLocal("agreement")}
            </p>
          </form>
        </section>
      </div>
    </main>
  );
}
