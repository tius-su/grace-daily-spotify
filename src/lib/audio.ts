export function toggleAudio(
  text: string,
  isPlaying: boolean,
  setIsPlaying: (val: boolean) => void,
  lang: string = "id-ID"
) {
  if (!("speechSynthesis" in window)) {
    alert("Maaf, browser Anda tidak mendukung fitur pembacaan suara.");
    return;
  }

  if (isPlaying) {
    window.speechSynthesis.cancel();
    setIsPlaying(false);
  } else {
    window.speechSynthesis.cancel();
    
    // Hilangkan karakter markdown agar pembacaan lebih natural
    let cleanText = text.replace(/[#*_`\[\]>]/g, "");

    // Sesuaikan pengucapan Kristen untuk kata "Allah" -> "Al-lah"
    if (lang === "id-ID") {
      cleanText = cleanText
        .replace(/Allah/g, "Al-lah")
        .replace(/allah/g, "al-lah");
    }

    // Ganti format range ayat (misal 1:2-5 atau 1 : 2-5) menjadi "pasal 1 ayat 2 sampai 5"
    cleanText = cleanText.replace(/\b(\d+)\s*:\s*(\d+)\s*[-–—]\s*(\d+)\b/g, "pasal $1 ayat $2 sampai $3");

    // Ganti format single ayat (misal 1:2 atau 1 : 2) menjadi "pasal 1 ayat 2"
    cleanText = cleanText.replace(/\b(\d+)\s*:\s*(\d+)\b/g, "pasal $1 ayat $2");
    
    // Pecah teks menjadi potongan-potongan pendek berdasarkan tanda baca / baris baru
    // agar kompatibel dengan limitasi panjang karakter SpeechSynthesis di perangkat mobile (iOS & Android).
    const chunks = cleanText
      .split(/[.\n?!]+/)
      .map(chunk => chunk.trim())
      .filter(chunk => chunk.length > 0);

    if (chunks.length === 0) {
      setIsPlaying(false);
      return;
    }

    // Untuk menghindari bug iOS Webkit di mana objek SpeechSynthesisUtterance 
    // dihapus oleh Garbage Collector secara prematur setelah 10-15 detik.
    (window as any)._activeUtterances = [];

    chunks.forEach((chunk, index) => {
      const utterance = new SpeechSynthesisUtterance(chunk);
      utterance.lang = lang;
      utterance.rate = lang === "id-ID" ? 0.85 : 0.95; // Sedikit dilambatkan agar menenangkan
      utterance.pitch = 1.0;

      if (index === chunks.length - 1) {
        // Objek terakhir yang selesai akan men-reset state tombol play
        utterance.onend = () => {
          setIsPlaying(false);
          (window as any)._activeUtterances = [];
        };
        utterance.onerror = () => {
          setIsPlaying(false);
          (window as any)._activeUtterances = [];
        };
      }

      (window as any)._activeUtterances.push(utterance);
      window.speechSynthesis.speak(utterance);
    });

    setIsPlaying(true);
  }
}

export function stopAudio() {
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}
