#!/usr/bin/env python3
"""
Grace Daily — Script Terjemahan Konten (Artikel Blog, Ensiklopedia, Renungan)
============================================================================
Menggunakan deep-translator dengan hierarki provider:
  1. GoogleTranslator (kualitas terbaik, 500k chars/bulan gratis)
  2. MyMemoryTranslator (fallback gratis, tanpa API key)

Cara penggunaan:
  pip install deep-translator requests tqdm
  python scripts/translate_content.py --mode blog --lang en
  python scripts/translate_content.py --mode blog --lang zh
  python scripts/translate_content.py --mode ensiklopedia --lang en,zh
  python scripts/translate_content.py --mode all --lang en,zh --limit 50
"""

import json
import os
import sys
import time
import argparse
import hashlib
from pathlib import Path
from datetime import datetime

try:
    from deep_translator import GoogleTranslator, MyMemoryTranslator
    from tqdm import tqdm
except ImportError:
    print("❌ Install dependencies dulu:")
    print("   pip install deep-translator tqdm requests")
    sys.exit(1)

# ============================================================
# KONFIGURASI
# ============================================================
PROJECT_ROOT = Path(__file__).parent.parent
CACHE_DIR = PROJECT_ROOT / "scripts" / ".translate_cache"
CACHE_DIR.mkdir(exist_ok=True)

# Rate limiting (delay antar request untuk hemat kuota)
DELAY_BETWEEN_REQUESTS = 1.0   # detik
MAX_CHARS_PER_CHUNK = 4500     # Google Translate max ~5000 chars per request
BATCH_SIZE = 10                # artikel per batch sebelum pause

SUPPORTED_LANGS = {
    "en": {"google": "en", "mymemory": "en-US"},
    "zh": {"google": "zh-CN", "mymemory": "zh-CN"},
}

# ============================================================
# FUNGSI TERJEMAHAN
# ============================================================

def translate_text(text: str, target_lang: str, source_lang: str = "id") -> tuple[str, str]:
    """
    Terjemahkan teks dengan hierarki provider.
    Returns: (translated_text, provider_name)
    """
    if not text or not text.strip():
        return text, "skip"

    lang_codes = SUPPORTED_LANGS.get(target_lang, {})
    if not lang_codes:
        raise ValueError(f"Bahasa tidak didukung: {target_lang}")

    # Split teks panjang menjadi chunks
    if len(text) > MAX_CHARS_PER_CHUNK:
        return translate_long_text(text, target_lang, source_lang)

    # Cek cache dulu
    cache_key = hashlib.md5(f"{text[:100]}{target_lang}".encode()).hexdigest()
    cache_file = CACHE_DIR / f"{cache_key}.json"
    if cache_file.exists():
        cached = json.loads(cache_file.read_text())
        return cached["text"], f"cache:{cached['provider']}"

    # Provider 1: Google Translate
    try:
        translated = GoogleTranslator(
            source=source_lang,
            target=lang_codes["google"]
        ).translate(text)
        if translated and translated.strip():
            # Simpan ke cache
            cache_file.write_text(json.dumps({"text": translated, "provider": "google"}))
            time.sleep(DELAY_BETWEEN_REQUESTS)
            return translated, "google"
    except Exception as e:
        print(f"  ⚠️  Google Translate error: {e}, mencoba MyMemory...")

    # Provider 2: MyMemory (fallback gratis)
    try:
        mymemory_target = lang_codes["mymemory"]
        mymemory_source = f"{source_lang}-ID" if source_lang == "id" else f"{source_lang}-{source_lang.upper()}"
        translated = MyMemoryTranslator(
            source=mymemory_source,
            target=mymemory_target
        ).translate(text[:499])  # MyMemory limit 500 chars per request
        if translated and translated.strip():
            cache_file.write_text(json.dumps({"text": translated, "provider": "mymemory"}))
            time.sleep(DELAY_BETWEEN_REQUESTS)
            return translated, "mymemory"
    except Exception as e:
        print(f"  ⚠️  MyMemory error: {e}")

    # Gagal semua provider
    return text, "failed"


def translate_long_text(text: str, target_lang: str, source_lang: str = "id") -> tuple[str, str]:
    """Split teks panjang dan terjemahkan per bagian."""
    # Split berdasarkan paragraf
    paragraphs = text.split("\n\n")
    translated_parts = []
    provider_used = "google"

    for para in paragraphs:
        if len(para) > MAX_CHARS_PER_CHUNK:
            # Split lebih lanjut berdasarkan kalimat
            sentences = para.split(". ")
            current_chunk = ""
            for sentence in sentences:
                if len(current_chunk) + len(sentence) < MAX_CHARS_PER_CHUNK:
                    current_chunk += sentence + ". "
                else:
                    if current_chunk:
                        result, prov = translate_text(current_chunk.strip(), target_lang, source_lang)
                        translated_parts.append(result)
                        provider_used = prov
                    current_chunk = sentence + ". "
            if current_chunk:
                result, prov = translate_text(current_chunk.strip(), target_lang, source_lang)
                translated_parts.append(result)
        else:
            result, prov = translate_text(para, target_lang, source_lang)
            translated_parts.append(result)
            provider_used = prov

    return "\n\n".join(translated_parts), provider_used


# ============================================================
# BACA DATA DARI FIRESTORE (via export JSON) ATAU FILE LOKAL
# ============================================================

def load_blog_posts_from_json():
    """Load blog posts dari file JSON lokal (hasil export Firestore)."""
    json_path = PROJECT_ROOT / "public" / "blog_posts.json"
    if not json_path.exists():
        print(f"❌ File tidak ditemukan: {json_path}")
        print("   Export Firestore collection 'blog_posts' ke file tersebut dulu.")
        return []

    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    if isinstance(data, list):
        return data
    elif isinstance(data, dict) and "documents" in data:
        return data["documents"]
    return []


def load_ensiklopedia_from_json():
    """Load ensiklopedia dari file JSON lokal."""
    json_files = [
        PROJECT_ROOT / "public" / "ensiklopedia_cache.json",
        PROJECT_ROOT / "public" / "tokoh.json",
    ]
    for jf in json_files:
        if jf.exists():
            with open(jf, "r", encoding="utf-8") as f:
                data = json.load(f)
            return data if isinstance(data, list) else []
    print("❌ File ensiklopedia tidak ditemukan.")
    return []


def load_devotions_from_json():
    """Load renungan harian dari file JSON lokal."""
    json_path = PROJECT_ROOT / "public" / "devotions.json"
    if not json_path.exists():
        print(f"❌ File tidak ditemukan: {json_path}")
        return []

    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data if isinstance(data, list) else []


# ============================================================
# PROSES TERJEMAHAN PER TIPE KONTEN
# ============================================================

def format_chinese_pinyin(text: str, target_lang: str) -> str:
    """Format teks terjemahan Mandarin dengan menyertakan Pinyin."""
    if not text or not text.strip():
        return text
    if target_lang not in ["zh", "zh-CN", "zh-cn"]:
        return text
    if text.startswith("Hanzi:"):
        return text
    try:
        from pypinyin import lazy_pinyin, Style
        # Convert Chinese characters to tone-marked pinyin
        pinyin_list = lazy_pinyin(text, style=Style.TONE)
        pinyin_text = " ".join(pinyin_list)
        return f"Hanzi: {text}\nPinyin: {pinyin_text}"
    except Exception:
        return text


def translate_article(article: dict, target_lang: str) -> dict:
    """Terjemahkan satu artikel blog."""
    title_key = f"title_{target_lang}"
    excerpt_key = f"excerpt_{target_lang}"
    content_key = f"content_{target_lang}"

    # Skip jika sudah ada terjemahan
    if article.get(title_key) and article.get(content_key):
        return article

    result = dict(article)

    # Terjemahkan judul
    if not result.get(title_key) and result.get("title"):
        translated_title, provider = translate_text(result["title"], target_lang)
        result[title_key] = format_chinese_pinyin(translated_title, target_lang)
        result[f"translation_source_{target_lang}"] = provider
        print(f"    ✅ title_{target_lang}: {translated_title[:60]}...")

    # Terjemahkan excerpt
    if not result.get(excerpt_key) and result.get("excerpt"):
        translated_excerpt, _ = translate_text(result["excerpt"], target_lang)
        result[excerpt_key] = format_chinese_pinyin(translated_excerpt, target_lang)

    # Terjemahkan konten penuh
    if not result.get(content_key) and result.get("content"):
        translated_content, _ = translate_long_text(result["content"], target_lang)
        result[content_key] = format_chinese_pinyin(translated_content, target_lang)

    result[f"translated_at_{target_lang}"] = datetime.now().isoformat()
    return result


def translate_encyclopedia_entry(entry: dict, target_lang: str) -> dict:
    """Terjemahkan satu entri ensiklopedia."""
    title_key = f"title_{target_lang}"
    summary_key = f"summary_{target_lang}"
    content_key = f"isi_artikel_{target_lang}"

    if entry.get(title_key) and entry.get(content_key):
        return entry

    result = dict(entry)

    # Keyword/title
    source_title = result.get("title") or result.get("keyword") or ""
    if not result.get(title_key) and source_title:
        translated, provider = translate_text(source_title, target_lang)
        result[title_key] = format_chinese_pinyin(translated, target_lang)
        result[f"translation_source_{target_lang}"] = provider
        print(f"    ✅ title_{target_lang}: {translated[:60]}")

    # Summary
    source_summary = result.get("summary") or ""
    if not result.get(summary_key) and source_summary:
        translated, _ = translate_text(source_summary[:500], target_lang)
        result[summary_key] = format_chinese_pinyin(translated, target_lang)

    # Full article
    source_content = result.get("isi_artikel") or ""
    if not result.get(content_key) and source_content:
        translated, _ = translate_long_text(source_content, target_lang)
        result[content_key] = format_chinese_pinyin(translated, target_lang)

    result[f"translated_at_{target_lang}"] = datetime.now().isoformat()
    return result


def translate_devotion(devotion: dict, target_lang: str) -> dict:
    """Terjemahkan satu renungan harian."""
    fields_to_translate = ["title", "verse", "reflection", "prayer", "action"]

    result = dict(devotion)
    for field in fields_to_translate:
        target_key = f"{field}_{target_lang}"
        if not result.get(target_key) and result.get(field):
            translated, provider = translate_text(str(result[field]), target_lang)
            result[target_key] = format_chinese_pinyin(translated, target_lang)
            if field == "title":
                result[f"translation_source_{target_lang}"] = provider
                print(f"    ✅ {field}_{target_lang}: {translated[:60]}")

    result[f"translated_at_{target_lang}"] = datetime.now().isoformat()
    return result


# ============================================================
# SIMPAN HASIL
# ============================================================

def save_results(data: list, output_path: Path):
    """Simpan hasil terjemahan ke file JSON."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"\n💾 Tersimpan: {output_path} ({len(data)} entri)")


def print_stats(total: int, translated: int, skipped: int, failed: int, lang: str):
    """Tampilkan statistik hasil terjemahan."""
    print("\n" + "="*60)
    print(f"📊 STATISTIK TERJEMAHAN → {lang.upper()}")
    print("="*60)
    print(f"  Total data     : {total}")
    print(f"  Diterjemahkan  : {translated}")
    print(f"  Di-skip (ada)  : {skipped}")
    print(f"  Gagal          : {failed}")
    print(f"  Selesai        : {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*60)


# ============================================================
# MAIN CLI
# ============================================================

def main():
    parser = argparse.ArgumentParser(
        description="Terjemahkan konten Grace Daily ke EN/ZH"
    )
    parser.add_argument(
        "--mode",
        choices=["blog", "ensiklopedia", "devotion", "all"],
        default="blog",
        help="Tipe konten yang akan diterjemahkan"
    )
    parser.add_argument(
        "--lang",
        default="en",
        help="Target bahasa: 'en', 'zh', atau 'en,zh'"
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="Batas jumlah artikel (0 = semua)"
    )
    parser.add_argument(
        "--skip-existing",
        action="store_true",
        default=True,
        help="Skip artikel yang sudah punya terjemahan (default: True)"
    )

    args = parser.parse_args()
    target_langs = [l.strip() for l in args.lang.split(",")]

    for lang in target_langs:
        if lang not in SUPPORTED_LANGS:
            print(f"❌ Bahasa tidak didukung: {lang}. Pilih: en, zh")
            sys.exit(1)

    modes = ["blog", "ensiklopedia", "devotion"] if args.mode == "all" else [args.mode]

    for mode in modes:
        print(f"\n{'='*60}")
        print(f"🚀 MODE: {mode.upper()} | TARGET: {', '.join(target_langs)}")
        print(f"{'='*60}")

        # Load data
        if mode == "blog":
            data = load_blog_posts_from_json()
            translate_fn = translate_article
            output_prefix = "blog_posts"
        elif mode == "ensiklopedia":
            data = load_ensiklopedia_from_json()
            translate_fn = translate_encyclopedia_entry
            output_prefix = "ensiklopedia_cache"
        else:  # devotion
            data = load_devotions_from_json()
            translate_fn = translate_devotion
            output_prefix = "devotions"

        if not data:
            print(f"⚠️  Tidak ada data untuk mode '{mode}'")
            continue

        if args.limit > 0:
            data = data[:args.limit]
            print(f"ℹ️  Terbatas {args.limit} artikel")

        print(f"📖 Total data: {len(data)}")

        for lang in target_langs:
            print(f"\n🌐 Menerjemahkan ke: {lang.upper()}")
            results = []
            translated_count = 0
            skipped_count = 0
            failed_count = 0

            for i, item in enumerate(tqdm(data, desc=f"→ {lang}")):
                try:
                    # Cek apakah sudah diterjemahkan
                    has_translation = bool(
                        item.get(f"title_{lang}") or
                        item.get(f"isi_artikel_{lang}") or
                        item.get(f"content_{lang}")
                    )

                    if args.skip_existing and has_translation:
                        results.append(item)
                        skipped_count += 1
                        continue

                    translated_item = translate_fn(item, lang)
                    results.append(translated_item)
                    translated_count += 1

                    # Pause setiap BATCH_SIZE artikel
                    if (i + 1) % BATCH_SIZE == 0:
                        print(f"\n  ⏸️  Pause 3 detik setelah {i+1} artikel...")
                        time.sleep(3)

                except Exception as e:
                    print(f"\n  ❌ Error pada item {i}: {e}")
                    results.append(item)  # Simpan asli jika error
                    failed_count += 1

            # Simpan hasil
            output_path = PROJECT_ROOT / "public" / f"{output_prefix}_translated_{lang}.json"
            save_results(results, output_path)
            print_stats(len(data), translated_count, skipped_count, failed_count, lang)

    print("\n✅ Selesai! Upload hasil JSON ke R2/Firestore untuk digunakan di app.")
    print("   Gunakan Admin Console untuk import JSON ke Firestore.")


if __name__ == "__main__":
    main()
