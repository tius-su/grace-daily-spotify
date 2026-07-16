import sys
import json
import os
import argparse

# Auto-install deep-translator if missing
try:
    from deep_translator import GoogleTranslator
except ImportError:
    try:
        import subprocess
        print("Installing deep-translator...", file=sys.stderr)
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install", "deep-translator"])
        except Exception:
            subprocess.check_call([sys.executable, "-m", "pip", "install", "--break-system-packages", "deep-translator"])
        from deep_translator import GoogleTranslator
    except Exception as install_err:
        print(f"Failed to auto-install deep-translator: {install_err}", file=sys.stderr)

def chunk_text(text, max_len=3000):
    if len(text) <= max_len:
        return [text]
    
    chunks = []
    lines = text.split("\n")
    current_chunk = []
    current_len = 0
    
    for line in lines:
        if current_len + len(line) + 1 > max_len:
            if current_chunk:
                chunks.append("\n".join(current_chunk))
                current_chunk = []
                current_len = 0
            if len(line) > max_len:
                sentences = line.split(". ")
                for sent in sentences:
                    if current_len + len(sent) + 2 > max_len:
                        if current_chunk:
                            chunks.append(". ".join(current_chunk) + ".")
                            current_chunk = []
                            current_len = 0
                        chunks.append(sent)
                    else:
                        current_chunk.append(sent)
                        current_len += len(sent) + 2
            else:
                current_chunk.append(line)
                current_len += len(line) + 1
        else:
            current_chunk.append(line)
            current_len += len(line) + 1
            
    if current_chunk:
        chunks.append("\n".join(current_chunk))
        
    return chunks

def translate_texts(texts, src, tgt):
    if not texts:
        return []
        
    # Map 'zh' to 'zh-CN' (Google Translate simplified Chinese code)
    src_code = 'zh-CN' if src == 'zh' else src
    tgt_code = 'zh-CN' if tgt == 'zh' else tgt
    
    # 1. Chunk texts and prepare a flat list of chunks
    flat_chunks = []
    text_mapping = [] # List of text indices corresponding to each chunk
    
    for i, t in enumerate(texts):
        chunks = chunk_text(t)
        for chunk in chunks:
            flat_chunks.append(chunk)
            text_mapping.append(i)
            
    if not flat_chunks:
        return []
        
    flat_translated = []
    
    # 1. Google Translate
    try:
        translator = GoogleTranslator(source=src_code, target=tgt_code)
        # GoogleTranslator.translate_batch is faster and handles lists
        flat_translated = translator.translate_batch(flat_chunks)
    except Exception as e:
        print(f"Google Translate failed: {e}", file=sys.stderr)
        
    # 2. DeepL (Fallback)
    deepl_key = os.getenv("DEEPL_API_KEY")
    if not flat_translated and deepl_key:
        try:
            from deep_translator import DeepL
            translator = DeepL(api_key=deepl_key, source=src_code, target=tgt_code)
            flat_translated = translator.translate_batch(flat_chunks)
        except Exception as e:
            print(f"DeepL failed: {e}", file=sys.stderr)
            
    # 3. Argos Translate (Fallback)
    if not flat_translated:
        try:
            import argostranslate.package
            import argostranslate.translate
            results = []
            for chunk in flat_chunks:
                results.append(argostranslate.translate.translate(chunk, src_code, tgt_code))
            flat_translated = results
        except Exception as e:
            print(f"Argos Translate failed: {e}", file=sys.stderr)
            
    # 4. LibreTranslate (Fallback)
    if not flat_translated:
        try:
            from deep_translator import LibreTranslator
            translator = LibreTranslator(source=src_code, target=tgt_code, base_url='https://libretranslate.de')
            flat_translated = translator.translate_batch(flat_chunks)
        except Exception as e:
            print(f"LibreTranslate failed: {e}", file=sys.stderr)
            
    # If all failed, return original chunks
    if not flat_translated or len(flat_translated) != len(flat_chunks):
        print("Warning: All translators failed. Returning original texts.", file=sys.stderr)
        flat_translated = flat_chunks
        
    # Reassemble translated chunks back into original texts structure
    assembled = [[] for _ in range(len(texts))]
    for idx, translated_chunk in zip(text_mapping, flat_translated):
        assembled[idx].append(translated_chunk)
        
    final_results = []
    for chunks in assembled:
        full_text = "\n".join(chunks)
        if tgt_code in ['zh-CN', 'zh', 'zh-cn']:
            try:
                from pypinyin import lazy_pinyin, Style
                # lazy_pinyin extracts characters and converts them to tone-marked pinyin
                pinyin_list = lazy_pinyin(full_text, style=Style.TONE)
                pinyin_text = " ".join(pinyin_list)
                # Format to Hanzi + Pinyin as requested
                formatted = f"Hanzi: {full_text}\nPinyin: {pinyin_text}"
                final_results.append(formatted)
            except Exception as pe:
                print(f"Pypinyin conversion error: {pe}", file=sys.stderr)
                final_results.append(full_text)
        else:
            final_results.append(full_text)
            
    return final_results

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", default="en")
    parser.add_argument("--target", default="id")
    args = parser.parse_args()
    
    try:
        # Read from stdin
        input_data = sys.stdin.read()
        if not input_data.strip():
            print(json.dumps([]))
            return
            
        texts = json.loads(input_data)
        if not isinstance(texts, list):
            print("Error: Input must be a JSON array of strings", file=sys.stderr)
            sys.exit(1)
            
        translated = translate_texts(texts, args.source, args.target)
        print(json.dumps(translated, ensure_ascii=False))
    except Exception as e:
        print(f"Error in translate script: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
