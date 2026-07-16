Halo Agent, saya sedang mengembangkan Telegram Mini App yang di-deploy di Vercel. 

Saat ini, struktur proyek saya digabung dengan domain utama, di mana kode Mini App berada di sub-folder `/telegram-miniapp`. Namun, saya baru saja menambahkan subdomain khusus di Vercel dan Rumahweb yaitu: https://app.gracedaily.my.id

Saya juga sudah mengatur `vercel.json` menggunakan fitur `rewrites` agar ketika seseorang mengakses `https://app.gracedaily.my.id`, Vercel secara otomatis menyajikan konten dari folder `/telegram-miniapp` sebagai halaman root (`/`).

Tugas Anda sekarang adalah membantu saya mengonfigurasi proyek di folder `/telegram-miniapp` agar menjadi Progressive Web App (PWA) mandiri yang siap di-instal via browser dan nantinya siap dibungkus menjadi APK.

Tolong buatkan atau pandu saya untuk menambahkan file-file berikut:

1. File `manifest.json`: 
   - Set short_name: "GraceDailyApp"
   - Set name: "Grace Daily Mini App"
   - Pastikan "start_url" dan "scope" diarahkan ke "/" (karena subdomain sudah di-rewrite oleh Vercel).
   - Set display: "standalone" dan orientation: "portrait".
   - Berikan placeholder atau kode untuk icon ukuran 192x192 dan 512x512.

2. File Service Worker (`sw.js`):
   - Buatkan service worker minimal/standar agar aplikasi memenuhi syarat instalasi PWA di browser Chrome/Android.


 Logika Fallback Telegram WebApp (PENTING):
   - Karena PWA ini bisa dibuka di browser biasa di luar Telegram, tolong buatkan atau sesuaikan fungsi inisialisasi user di aplikasi saya. 
   - Jika `window.Telegram.WebApp.initData` tersedia, gunakan data login dari Telegram.
   - Jika TIDAK tersedia (akses via PWA browser/APK), berikan fallback/kondisi cadangan (misalnya memunculkan komponen login manual atau pesan interaktif) agar aplikasi tidak crash/blank.

ketika user akana install pwa munculkan popup untuk bergabung ke channel whatsapp dan channel telegram
https://www.whatsapp.com/channel/0029VbCUBJfG8l5A2qoOPN0w
CHANNEL_ID=-1004458367648


Tolong beritahu saya di folder mana persisnya saya harus meletakkan file-json dan sw.js tersebut berdasarkan tech stack yang saya gunakan sekarang. Terima kasih!
