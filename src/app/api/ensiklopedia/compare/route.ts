import { NextResponse } from "next/server";
import { askDeepSeek } from "@/lib/ai";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name1 = searchParams.get("name1") || "";
  const name2 = searchParams.get("name2") || "";

  if (!name1 || !name2) {
    return NextResponse.json({ error: "Kedua nama tokoh wajib diisi." }, { status: 400 });
  }

  // Predefined offline results for quick loading and reliability
  const presets: Record<string, any> = {
    "musa-yosua": {
      tokoh1: {
        nama: "Musa",
        panggilan: "Dipanggil Allah dari semak duri berapi untuk membebaskan bangsa Israel dari Mesir.",
        peristiwaKunci: "Menerima Hukum Taurat di Gunung Sinai, membelah Laut Merah, dan memimpin Israel 40 tahun di padang gurun.",
        kelemahanUjian: "Tidak diizinkan masuk Tanah Perjanjian karena ketidaktaatan memukul bukit batu di Meriba.",
        pelajaran: "Kepatuhan mutlak dan kelembutan hati adalah kunci kepemimpinan rohani."
      },
      tokoh2: {
        nama: "Yosua",
        panggilan: "Abdi Musa yang kemudian dipilih menggantikan Musa untuk memimpin penaklukan Kanaan.",
        peristiwaKunci: "Meruntuhkan tembok Yerikho, membelah Sungai Yordan, dan memimpin pertempuran merebut Kanaan.",
        kelemahanUjian: "Sempat tertipu oleh penduduk Gibeon karena tidak meminta petunjuk dari Tuhan.",
        pelajaran: "Keberanian iman dan ketaatan pada Firman membawa kemenangan sejati."
      },
      kesamaan: [
        "Sama-sama dipanggil Allah secara langsung dan disertai dengan mukjizat air terbelah.",
        "Sama-sama memimpin umat Israel dalam masa transisi yang sangat krusial.",
        "Sama-sama mendedikasikan hidupnya untuk menuntun bangsa Israel tetap setia pada Taurat."
      ],
      perbedaan: [
        "Musa adalah pemberi Hukum (Lawgiver) dan nabi, sedangkan Yosua adalah jenderal/penakluk militer.",
        "Musa memimpin generasi padang gurun yang tegar tengkuk, sedangkan Yosua memimpin generasi baru yang lebih taat.",
        "Musa melayani di luar Tanah Kanaan, sedangkan Yosua berhasil masuk dan membagi-bagikan Tanah Perjanjian."
      ]
    },
    "daud-saul": {
      tokoh1: {
        nama: "Saul",
        panggilan: "Diurapi oleh nabi Samuel sebagai raja pertama Israel atas desakan bangsa yang menginginkan raja fisik.",
        peristiwaKunci: "Memimpin pertempuran hebat melawan bangsa Filistin dan mengalahkan orang Amon.",
        kelemahanUjian: "Ketidaktaatan menawarkan korban tanpa Samuel dan takut pada opini rakyat lebih daripada Tuhan.",
        pelajaran: "Ketaatan lebih baik daripada korban sembelihan; kehilangan perkenanan Allah adalah kehancuran."
      },
      tokoh2: {
        nama: "Daud",
        panggilan: "Diurapi sebagai raja pengganti Saul ketika masih menjadi gembala domba muda karena hatinya berkenan bagi Allah.",
        peristiwaKunci: "Mengalahkan raksasa Goliat, mendirikan Yerusalem sebagai ibu kota kerajaan, dan menerima Perjanjian Daud.",
        kelemahanUjian: "Jatuh ke dalam dosa perzinaan dengan Batsyeba dan pembunuhan Uria.",
        pelajaran: "Pertobatan yang sungguh-sungguh dan hati yang hancur di hadapan Tuhan mendatangkan pemulihan."
      },
      kesamaan: [
        "Sama-sama diurapi oleh nabi Samuel sebagai raja atas seluruh Israel.",
        "Sama-sama diuji dengan kekuasaan besar dan peperangan melawan musuh-musuh Israel.",
        "Sama-sama mengalami masa-masa awal pemerintahan yang sukses dengan pertolongan Tuhan."
      ],
      perbedaan: [
        "Saul menanggapi teguran dosanya dengan pembelaan diri, sedangkan Daud segera bertobat dengan hati yang hancur.",
        "Saul didorong oleh rasa takut akan manusia, sedangkan Daud didorong oleh rasa takut akan Tuhan.",
        "Saul mendirikan monumen untuk dirinya sendiri, sedangkan Daud rindu mendirikan bait bagi nama Tuhan."
      ]
    },
    "petrus-paulus": {
      tokoh1: {
        nama: "Petrus",
        panggilan: "Nelayan Galilea sederhana yang dipanggil Yesus menjadi penjala manusia dan pemimpin rasul awal.",
        peristiwaKunci: "Menjadi pilar gereja Yerusalem, berkhotbah di hari Pentakosta (3.000 orang bertobat), membuka Injil kepada Kornelius.",
        kelemahanUjian: "Pernah menyangkal Yesus tiga kali dan sempat bersikap munafik/menarik diri dari orang non-Yahudi di Antiokhia.",
        pelajaran: "Kegagalan masa lalu tidak membatasi kasih karunia Allah untuk memakai kita sebagai saksi-Nya."
      },
      tokoh2: {
        nama: "Paulus",
        panggilan: "Farisi terpelajar (Saulus) yang menganiaya jemaat sebelum bertemu Yesus dalam penglihatan di jalan ke Damsyik.",
        peristiwaKunci: "Melakukan 3 perjalanan misionaris besar, menulis 13 surat Perjanjian Baru, dan merintis gereja di Asia Kecil dan Eropa.",
        kelemahanUjian: "Diberi 'duri dalam daging' untuk mencegahnya menjadi sombong karena penyataan yang luar biasa.",
        pelajaran: "Kasih karunia Allah cukup bagi kita; di dalam kelemahanlah kuasa Kristus menjadi sempurna."
      },
      kesamaan: [
        "Sama-sama rasul besar abad pertama yang dipanggil langsung oleh Yesus Kristus.",
        "Sama-sama mati martir di Roma demi mempertahankan iman Kristen.",
        "Sama-sama menekankan pentingnya keselamatan murni karena kasih karunia melalui iman."
      ],
      perbedaan: [
        "Petrus diutus terutama untuk memberitakan Injil kepada orang Yahudi, sedangkan Paulus kepada bangsa non-Yahudi.",
        "Petrus adalah murid langsung Yesus selama pelayanan bumi, sedangkan Paulus bertemu Yesus yang telah bangkit.",
        "Petrus berlatar belakang nelayan praktis, sedangkan Paulus berlatar belakang akademisi/teolog Farisi."
      ]
    }
  };

  const key = `${name1.toLowerCase().trim()}-${name2.toLowerCase().trim()}`;
  const reverseKey = `${name2.toLowerCase().trim()}-${name1.toLowerCase().trim()}`;

  if (presets[key]) {
    return NextResponse.json(presets[key]);
  }
  if (presets[reverseKey]) {
    const data = presets[reverseKey];
    return NextResponse.json({
      tokoh1: data.tokoh2,
      tokoh2: data.tokoh1,
      kesamaan: data.kesamaan,
      perbedaan: data.perbedaan
    });
  }

  // If not preset, request from AI with strict theological context
  try {
    const prompt = `
Kamu adalah seorang teolog Alkitab netral dan ahli sejarah Alkitab.
Bandingkan secara objektif dan mendalam dua tokoh Alkitab ini: "${name1}" dan "${name2}".
Aturan ketat: Bandingkan hanya berdasarkan data Alkitab (Perjanjian Lama dan Baru), hindari tradisi eksternal sekuler atau spekulasi fiktif.

Tolong kembalikan respons hanya berupa JSON murni dengan format persis seperti ini (tanpa markdown backtick \`\`\`, tanpa penjelasan pembuka/penutup):
{
  "tokoh1": {
    "nama": "${name1}",
    "panggilan": "ringkasan panggilan teologis tokoh ini",
    "peristiwaKunci": "peristiwa penting dalam Alkitab",
    "kelemahanUjian": "kelemahan karakter atau ujian iman tokoh ini",
    "pelajaran": "pelajaran rohani yang bisa diambil"
  },
  "tokoh2": {
    "nama": "${name2}",
    "panggilan": "ringkasan panggilan teologis tokoh ini",
    "peristiwaKunci": "peristiwa penting dalam Alkitab",
    "kelemahanUjian": "kelemahan karakter atau ujian iman tokoh ini",
    "pelajaran": "pelajaran rohani yang bisa diambil"
  },
  "kesamaan": [
    "poin kesamaan 1 berdasarkan Alkitab",
    "poin kesamaan 2 berdasarkan Alkitab",
    "poin kesamaan 3 berdasarkan Alkitab"
  ],
  "perbedaan": [
    "poin perbedaan 1 berdasarkan Alkitab",
    "poin perbedaan 2 berdasarkan Alkitab",
    "poin perbedaan 3 berdasarkan Alkitab"
  ]
}
    `.trim();

    const aiRes = await askDeepSeek("bible-study", prompt);
    let answerText = aiRes.answer || "";

    // Strip out markdown code block if returned
    if (answerText.includes("```")) {
      const match = answerText.match(/```(?:json)?([\s\S]+?)```/);
      if (match && match[1]) {
        answerText = match[1].trim();
      }
    }

    // Clean any trailing or leading invalid tokens
    const jsonStart = answerText.indexOf("{");
    const jsonEnd = answerText.lastIndexOf("}");
    if (jsonStart !== -1 && jsonEnd !== -1) {
      answerText = answerText.slice(jsonStart, jsonEnd + 1);
    }

    const parsedData = JSON.parse(answerText);
    return NextResponse.json(parsedData);
  } catch (error: any) {
    console.error("Gagal men-generate perbandingan:", error);
    return NextResponse.json({
      error: "Gagal membuat perbandingan secara real-time. Silakan coba pasangan tokoh lainnya."
    }, { status: 500 });
  }
}
