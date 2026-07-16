export interface BibleMasterEntry {
  name: string;
  category: string; // 'tokoh' | 'tempat' | 'kamus' | 'teologi' | 'perumpamaan' | 'mukjizat' | 'kitab' | 'kronologi'
  priority: number; // 1 to 100
  reason: string;
  slug: string;
}

export const BIBLE_MASTER_DATA: BibleMasterEntry[] = [
  // 1. Tokoh Utama Alkitab
  { name: "Abraham", category: "tokoh", priority: 100, reason: "Bapa segala orang beriman dan bapa bangsa Israel.", slug: "abraham" },
  { name: "Musa", category: "tokoh", priority: 100, reason: "Pemimpin pembebasan Israel dari Mesir dan penerima Hukum Taurat.", slug: "musa" },
  { name: "Daud", category: "tokoh", priority: 98, reason: "Raja Israel terbesar dan nenek moyang garis keturunan Mesias.", slug: "daud" },
  { name: "Petrus", category: "tokoh", priority: 95, reason: "Pemimpin para rasul mula-mula dan soko guru jemaat PB.", slug: "petrus" },
  { name: "Paulus", category: "tokoh", priority: 96, reason: "Rasul bagi bangsa non-Yahudi dan penulis surat-surat doktrinal jemaat.", slug: "paulus" },
  { name: "Yusuf", category: "tokoh", priority: 90, reason: "Anak Yakub yang dijual ke Mesir dan menyelamatkan keluarganya dari kelaparan.", slug: "yusuf" },
  { name: "Yosua", category: "tokoh", priority: 88, reason: "Penerus Musa yang memimpin bangsa Israel menduduki Tanah Kanaan.", slug: "yosua" },
  { name: "Samuel", category: "tokoh", priority: 87, reason: "Hakim terakhir, nabi besar, yang mengurapi Raja Saul dan Raja Daud.", slug: "samuel" },
  { name: "Elia", category: "tokoh", priority: 89, reason: "Nabi pembela iman yang mengalahkan nabi Baal di Gunung Karmel.", slug: "elia" },
  { name: "Salomo", category: "tokoh", priority: 92, reason: "Raja paling bijaksana pembangun Bait Allah pertama di Yerusalem.", slug: "salomo" },
  { name: "Ester", category: "tokoh", priority: 85, reason: "Ratu Persia yang menyelamatkan bangsa Yahudi dari pembantaian.", slug: "ester" },
  { name: "Rut", category: "tokoh", priority: 80, reason: "Perempuan Moab setia yang masuk dalam silsilah keluarga Daud dan Yesus.", slug: "rut" },
  { name: "Yohanes Pembaptis", category: "tokoh", priority: 94, reason: "Nabi pembuka jalan bagi kedatangan dan pelayanan publik Yesus.", slug: "yohanes-pembaptis" },
  { name: "Maria", category: "tokoh", priority: 95, reason: "Ibu jasmani Yesus Kristus yang dipilih Allah dengan anugerah khusus.", slug: "maria" },
  { name: "Abner", category: "tokoh", priority: 40, reason: "Panglima tentara Saul yang mendukung dinasti Saul melawan Daud.", slug: "abner" },
  { name: "Gideon", category: "tokoh", priority: 82, reason: "Hakim pemberani yang mengalahkan Midian dengan 300 orang terpilih.", slug: "gideon" },
  { name: "Simson", category: "tokoh", priority: 80, reason: "Hakim bernazar nazir Allah berkuasa fisik besar yang mengalahkan Filistin.", slug: "simson" },
  { name: "Ayub", category: "tokoh", priority: 85, reason: "Teladan ketabahan dan kesetiaan mutlak di tengah penderitaan hidup.", slug: "ayub" },
  { name: "Yesaya", category: "tokoh", priority: 90, reason: "Nabi besar yang menulis nubuatan keselamatan mesianik terlengkap.", slug: "yesaya" },
  { name: "Daniel", category: "tokoh", priority: 91, reason: "Nabi dan negarawan saleh yang selamat dari gua singa di Babel.", slug: "daniel" },

  // 2. Tempat Penting dalam Alkitab
  { name: "Yerusalem", category: "tempat", priority: 100, reason: "Kota suci, pusat Bait Allah, saksi kematian dan kebangkitan Yesus.", slug: "yerusalem" },
  { name: "Betlehem", category: "tempat", priority: 95, reason: "Tempat kelahiran Daud serta tempat penggenapan nubuat lahirnya Yesus.", slug: "betlehem" },
  { name: "Nazaret", category: "tempat", priority: 90, reason: "Kota asal Yusuf dan Maria, tempat Yesus tumbuh dewasa.", slug: "nazaret" },
  { name: "Gunung Sinai", category: "tempat", priority: 92, reason: "Tempat Allah menyatakan diri dan menyerahkan Sepuluh Hukum kepada Musa.", slug: "gunung-sinai" },
  { name: "Babel", category: "tempat", priority: 88, reason: "Kota pembuangan bangsa Yahudi dan simbol keangkuhan menara Babel.", slug: "babel" },
  { name: "Mesir", category: "tempat", priority: 85, reason: "Tempat penindasan Israel, eksodus agung, dan perlindungan bayi Yesus.", slug: "mesir" },
  { name: "Sungai Yordan", category: "tempat", priority: 87, reason: "Tempat penyeberangan Yosua dan lokasi pembaptisan Yesus oleh Yohanes.", slug: "sungai-yordan" },
  { name: "Yerikho", category: "tempat", priority: 80, reason: "Kota berbenteng kuat pertama yang runtuh oleh iman Yosua.", slug: "yerikho" },
  { name: "Galilea", category: "tempat", priority: 93, reason: "Danau dan wilayah tempat sebagian besar pelayanan Yesus berlangsung.", slug: "galilea" },
  { name: "Kapernaum", category: "tempat", priority: 89, reason: "Kota pelabuhan pusat pelayanan, mukjizat, dan khotbah Yesus.", slug: "kapernaum" },
  { name: "Gunung Karmel", category: "tempat", priority: 78, reason: "Lokasi konfrontasi api supernatural antara Elia dengan nabi Baal.", slug: "gunung-karmel" },
  { name: "Antiokhia", category: "tempat", priority: 84, reason: "Kota pusat misi Paulus, di mana pengikut Kristus pertama kali disebut Kristen.", slug: "antiokhia" },
  { name: "Damsyik", category: "tempat", priority: 80, reason: "Jalan raya pertobatan Paulus setelah melihat cahaya ilahi Kristus.", slug: "damsyik" },
  { name: "Efesus", category: "tempat", priority: 82, reason: "Kota pelabuhan besar pusat penginjilan Paulus di Asia Kecil.", slug: "efesus" },
  { name: "Roma", category: "tempat", priority: 90, reason: "Ibu kota Kekaisaran tujuan akhir misi Paulus dan tempat martirnya rasul.", slug: "roma" },

  // 3. Kamus Alkitab
  { name: "Farisi", category: "kamus", priority: 90, reason: "Kelompok keagamaan Yahudi legalistik pemegang adat-istiadat nenek moyang.", slug: "farisi" },
  { name: "Saduki", category: "kamus", priority: 88, reason: "Golongan elit imam Yahudi rasional yang menolak kebangkitan tubuh.", slug: "saduki" },
  { name: "Mesias", category: "kamus", priority: 100, reason: "Gelar Ibrani bagi 'Yang Diurapi' penggenap janji keselamatan Allah.", slug: "mesias" },
  { name: "Tabernakel", category: "kamus", priority: 85, reason: "Kemah Suci simbol kehadiran Allah di padang gurun.", slug: "tabernakel" },
  { name: "Kovenan", category: "kamus", priority: 92, reason: "Perjanjian kudus yang diikat oleh Allah dengan umat-Nya.", slug: "kovenan" },
  { name: "Taurat", category: "kamus", priority: 95, reason: "Hukum dasar tertulis berisi instruksi moral-spiritual Musa.", slug: "taurat" },
  { name: "Paskah", category: "kamus", priority: 93, reason: "Peringatan keselamatan dari malaikat maut Mesir / Kebangkitan Kristus.", slug: "paskah" },
  { name: "Pentakosta", category: "kamus", priority: 91, reason: "Hari raya panen Yahudi / pencurahan perdana Roh Kudus.", slug: "pentakosta" },
  { name: "Sanhedrin", category: "kamus", priority: 80, reason: "Mahkamah Agama dan dewan tertinggi bangsa Yahudi di Yerusalem.", slug: "sanhedrin" },
  { name: "Manna", category: "kamus", priority: 75, reason: "Roti supranatural dari surga makanan Israel selama 40 tahun di padang gurun.", slug: "manna" },

  // 4. Istilah Teologi (sering dicari)
  { name: "Anugerah", category: "teologi", priority: 100, reason: "Kasih karunia keselamatan cuma-cuma tanpa jasa kelayakan manusia.", slug: "anugerah" },
  { name: "Pembenaran", category: "teologi", priority: 95, reason: "Deklarasi hukum Allah menyatakan orang berdosa benar karena iman pada Yesus.", slug: "pembenaran" },
  { name: "Pengudusan", category: "teologi", priority: 92, reason: "Karya progresif Roh Kudus membentuk hidup orang percaya serupa Kristus.", slug: "pengudusan" },
  { name: "Eskatologi", category: "teologi", priority: 85, reason: "Doktrin teologi mengenai akhir zaman dan kedatangan akhir Kristus.", slug: "eskatologi" },
  { name: "Inkarnasi", category: "teologi", priority: 98, reason: "Pernyataan Firman ilahi menjadi daging manusia sejati dalam Yesus.", slug: "inkarnasi" },
  { name: "Penebusan", category: "teologi", priority: 96, reason: "Kematian Kristus sebagai pembayaran lunas harga pembebasan dosa.", slug: "penebusan" },
  { name: "Soteriologi", category: "teologi", priority: 88, reason: "Studi dan doktrin teologis mengenai proses keselamatan umat manusia.", slug: "soteriologi" },
  { name: "Tritunggal", category: "teologi", priority: 97, reason: "Doktrin keesaan Allah dalam persekutuan tiga Pribadi ilahi sehakikat.", slug: "tritunggal" },
  { name: "Rekonsiliasi", category: "teologi", priority: 90, reason: "Pemulihan persahabatan antara Allah dan manusia yang sebelumnya terpisah.", slug: "rekonsiliasi" },
  { name: "Wahyu Umum", category: "teologi", priority: 80, reason: "Penyataan Allah melalui ciptaan semesta dan hati nurani manusia.", slug: "wahyu-umum" },

  // 5. Perumpamaan Yesus
  { name: "Anak yang Hilang", category: "perumpamaan", priority: 100, reason: "Menggambarkan besarnya kasih sayang dan pengampunan Bapa surgawi.", slug: "anak-yang-hilang" },
  { name: "Orang Samaria yang Murah Hati", category: "perumpamaan", priority: 98, reason: "Mendefinisikan arti mengasihi sesama manusia tanpa sekat golongan.", slug: "orang-samaria-yang-murah-hati" },
  { name: "Penabur Benih", category: "perumpamaan", priority: 95, reason: "Menjelaskan macam-macam kondisi hati saat menerima kebenaran firman.", slug: "penabur-benih" },
  { name: "Domba yang Hilang", category: "perumpamaan", priority: 90, reason: "Menunjukkan kesungguhan Yesus mencari satu orang berdosa yang tersesat.", slug: "domba-yang-hilang" },
  { name: "Lalang di Antara Gandum", category: "perumpamaan", priority: 88, reason: "Menjelaskan keberadaan orang kudus dan orang fasik di bumi hingga akhir zaman.", slug: "lalang-di-antara-gandum" },
  { name: "Mutiara yang Berharga", category: "perumpamaan", priority: 85, reason: "Mengajarkan nilai tak terhingga dari memiliki Kerajaan Surga.", slug: "mutiara-yang-berharga" },
  { name: "Hamba yang Tidak Mengampuni", category: "perumpamaan", priority: 92, reason: "Menegaskan keharusan mengampuni sesama karena kita telah diampuni Bapa.", slug: "hamba-yang-tidak-mengampuni" },
  { name: "Sepuluh Gadis", category: "perumpamaan", priority: 90, reason: "Mengingatkan kesiapan spiritual menyambut kedatangan kembali Kristus.", slug: "sepuluh-gadis" },
  { name: "Talenta", category: "perumpamaan", priority: 89, reason: "Mengajarkan pertanggungjawaban dalam mengelola karunia titipan Allah.", slug: "talenta" },
  { name: "Orang Kaya dan Lazarus", category: "perumpamaan", priority: 93, reason: "Mengungkap realitas keadilan kekal setelah kematian fisik terjadi.", slug: "orang-kaya-dan-lazarus" },

  // 6. Mukjizat Yesus
  { name: "Kebangkitan Lazarus", category: "mukjizat", priority: 100, reason: "Klimaks mukjizat Yesus yang menyatakan kuasa-Nya atas maut.", slug: "kebangkitan-lazarus" },
  { name: "Air Menjadi Anggur", category: "mukjizat", priority: 95, reason: "Mukjizat perdana di Kana yang menyingkapkan kemuliaan awal Yesus.", slug: "air-menjadi-anggur" },
  { name: "Memberi Makan 5000 Orang", category: "mukjizat", priority: 97, reason: "Mukjizat kelimpahan pangan kreatif yang dicatat oleh seluruh penulis Injil.", slug: "memberi-makan-5000-orang" },
  { name: "Berjalan di Atas Air", category: "mukjizat", priority: 96, reason: "Demonstrasi kedaulatan Yesus atas hukum fisika dan alam semesta.", slug: "berjalan-di-atas-air" },
  { name: "Meredakan Angin Ribut", category: "mukjizat", priority: 93, reason: "Tindakan otoritatif membungkam badai yang membuktikan jati diri ilahi-Nya.", slug: "meredakan-angin-ribut" },
  { name: "Menyembuhkan Orang Buta Sejak Lahir", category: "mukjizat", priority: 90, reason: "Mukjizat medis mesianik pembuktian status Yesus sebagai Terang Dunia.", slug: "menyembuhkan-orang-buta-sejak-lahir" },
  { name: "Kebangkitan Anak Yairus", category: "mukjizat", priority: 92, reason: "Mukjizat menghidupkan kembali anak perempuan kecil dari cengkeraman kematian.", slug: "kebangkitan-anak-yairus" },
  { name: "Menyembuhkan Lumpuh Betesda", category: "mukjizat", priority: 88, reason: "Penyembuhan hari Sabat yang memicu kemarahan teologis pemimpin Yahudi.", slug: "menyembuhkan-lumpuh-betesda" },
  { name: "Menyembuhkan Sepuluh Kusta", category: "mukjizat", priority: 85, reason: "Pemulihan kusta massal yang menguji rasa syukur dan iman para penerima.", slug: "menyembuhkan-sepuluh-kusta" },
  { name: "Mengusir Setan Legion", category: "mukjizat", priority: 89, reason: "Pelepasan kuasa kegelapan dahsyat di Gadara membuktikan kedaulatan Roh Kristus.", slug: "mengusir-setan-legion" },

  // 7. Kitab
  { name: "Kejadian", category: "kitab", priority: 100, reason: "Kitab pembuka alkitab dasar teologis asal mula semesta dan perjanjian.", slug: "kejadian" },
  { name: "Keluaran", category: "kitab", priority: 98, reason: "Kisah sentral sejarah penebusan, Paskah, pembagian Taurat, Kemah Suci.", slug: "keluaran" },
  { name: "Mazmur", category: "kitab", priority: 96, reason: "Kumpulan kidung doa, nubuat mesianik, ekspresi iman terdalam orang suci.", slug: "mazmur" },
  { name: "Yesaya", category: "kitab", priority: 94, reason: "Kitab nubuat mesianik utama yang dipanggil 'Injil Perjanjian Lama'.", slug: "yesaya" },
  { name: "Matius", category: "kitab", priority: 98, reason: "Injil pembuka Perjanjian Baru menyatakan Yesus sebagai Raja pemenuh nubuat.", slug: "matius" },
  { name: "Yohanes", category: "kitab", priority: 100, reason: "Injil teologis mendalam penegas identitas Yesus sebagai Anak Tunggal Allah.", slug: "yohanes" },
  { name: "Roma", category: "kitab", priority: 99, reason: "Risalah doktrin keselamatan lengkap oleh anugerah melalui iman.", slug: "roma" },
  { name: "Wahyu", category: "kitab", priority: 95, reason: "Kitab apokaliptik pamungkas penyingkap kemenangan akhir jemaat Tuhan.", slug: "wahyu" },
  { name: "Imamat", category: "kitab", priority: 80, reason: "Kitab peraturan kekudusan hidup dan tata cara korban penebusan dosa.", slug: "imamat" },
  { name: "Daniel", category: "kitab", priority: 88, reason: "Kitab nubuatan sejarah dunia kuno dan kedatangan Anak Manusia.", slug: "daniel" },
  { name: "Efesus", category: "kitab", priority: 90, reason: "Surat tentang kekayaan posisi gereja sebagai Tubuh Kristus yang mulia.", slug: "efesus" },

  // 8. Kronologi
  { name: "Penciptaan", category: "kronologi", priority: 100, reason: "Awal mula ruang waktu dan kehidupan manusia yang segambar Pencipta.", slug: "penciptaan" },
  { name: "Air Bah Nuh", category: "kronologi", priority: 90, reason: "Peristiwa penghakiman global atas dosa moral manusia dan pakta pelangi.", slug: "air-bah-nuh" },
  { name: "Keluaran dari Mesir", category: "kronologi", priority: 98, reason: "Titik tolak pembebasan teologis politik umat pilihan dari penindasan.", slug: "keluaran-dari-mesir" },
  { name: "Pembuangan ke Babel", category: "kronologi", priority: 92, reason: "Zaman kedisiplinan keras Allah atas Israel akibat penyembahan berhala.", slug: "pembuangan-ke-babel" },
  { name: "Kelahiran Yesus Kristus", category: "kronologi", priority: 100, reason: "Peristiwa agung kedatangan Allah menjadi manusia (Inkarnasi).", slug: "kelahiran-yesus-kristus" },
  { name: "Penyaliban dan Kebangkitan", category: "kronologi", priority: 100, reason: "Fokus sentral sejarah penyelamatan dunia lunasnya murka dosa.", slug: "penyaliban-dan-kebangkitan" },
  { name: "Hari Pentakosta PB", category: "kronologi", priority: 95, reason: "Peristiwa pencurahan Roh Kudus pendiri resmi eksistensi Gereja.", slug: "hari-pentakosta-pb" },
  { name: "Perjalanan Misi Paulus", category: "kronologi", priority: 88, reason: "Gerakan ekspansi Injil keluar dari Yerusalem ke jantung Eropa.", slug: "perjalanan-misi-paulus" },
  { name: "Kehancuran Bait Yerusalem 70 M", category: "kronologi", priority: 85, reason: "Titik akhir kultus Bait Suci Yahudi penggenap nubuat Kristus.", slug: "kehancuran-bait-yerusalem-70-m" },
  { name: "Perumusan Kanon Alkitab", category: "kronologi", priority: 87, reason: "Pengumpulan dan pengesahan tulisan apostolik menjadi kitab suci utuh.", slug: "perumusan-kanon-alkitab" }
];
