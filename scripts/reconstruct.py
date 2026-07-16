import json
import os
import glob

base_file = "/Users/tius/Documents/Data Tius/renungan-life/grace-daily/src/app/telegram-miniapp/page.tsx"
output_file = "/Users/tius/Documents/Data Tius/renungan-life/grace-daily/src/app/telegram-miniapp/page.tsx"

# 1. Read base content
with open(base_file, "r", encoding="utf-8") as f:
    content = f.read()

print("Base file length:", len(content), "chars")

def clean_str(val):
    if not isinstance(val, str):
        return val
    # If it is double-encoded JSON (starts with quote and ends with quote)
    if val.startswith('"') and val.endswith('"') and len(val) >= 2:
        try:
            return json.loads(val)
        except Exception:
            pass
    # Try decoding escaped sequences if it has backslash escapes
    if '\\' in val:
        try:
            return json.loads(f'"{val}"')
        except Exception:
            pass
    return val

# 2. Gather replacements chronologically from logs
replacements = []

convo_ids = [
    "da80ed75-7a08-449c-894b-6ae1e0c83a71",
    "04fdbf60-a750-47e7-8deb-e9095ac14bef",
    "c8c76e62-6ee6-4540-ae94-1aff74069bd0",
    "e9100f7c-c946-49b3-a476-354524bdfc63",
    "d8c12db5-27eb-4856-861a-7c2a61915d30"
]

for convo in convo_ids:
    path = f"/Users/tius/.gemini/antigravity-ide/brain/{convo}/.system_generated/logs/transcript.jsonl"
    if not os.path.exists(path):
        print(f"Transcript not found for {convo}")
        continue
    
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            obj = json.loads(line)
            step = obj.get("step_index")
            for tc in obj.get("tool_calls", []):
                args = tc.get("args", {})
                target_file = args.get("TargetFile", "")
                
                # Check if it was serialized as a string
                if isinstance(target_file, str) and "telegram-miniapp/page.tsx" in target_file:
                    name = tc.get("name")
                    if name == "replace_file_content":
                        replacements.append({
                            "convo": convo,
                            "step": step,
                            "name": name,
                            "chunks": [{
                                "target": clean_str(args.get("TargetContent")),
                                "replacement": clean_str(args.get("ReplacementContent"))
                            }]
                        })
                    elif name == "multi_replace_file_content":
                        chunks_val = args.get("ReplacementChunks", [])
                        if isinstance(chunks_val, str):
                            try:
                                chunks_val = json.loads(chunks_val)
                            except Exception as e:
                                print(f"Error parsing chunks string: {e}")
                                chunks_val = []
                        
                        chunks = []
                        for chunk in chunks_val:
                            if isinstance(chunk, str):
                                try:
                                    chunk = json.loads(chunk)
                                except Exception:
                                    pass
                            if isinstance(chunk, dict):
                                chunks.append({
                                    "target": clean_str(chunk.get("TargetContent")),
                                    "replacement": clean_str(chunk.get("ReplacementContent"))
                                })
                        replacements.append({
                            "convo": convo,
                            "step": step,
                            "name": name,
                            "chunks": chunks
                        })

print(f"Found {len(replacements)} replacement steps in total.")

# 3. Apply replacements
failed_steps = []
success_count = 0

for i, rep in enumerate(replacements):
    convo = rep["convo"]
    step = rep["step"]
    name = rep["name"]
    chunks = rep["chunks"]
    
    print(f"\n--- Applying Step {i+1}: Convo {convo} | Step {step} ({name}) ---")
    
    step_ok = True
    temp_content = content
    
    for idx, chunk in enumerate(chunks):
        target = chunk["target"]
        replacement = chunk["replacement"]
        
        if not target:
            print(f"  [Chunk {idx+1}] Error: Empty target content")
            step_ok = False
            continue
            
        count = temp_content.count(target)
        if count == 0:
            # Try normalized spacing / line endings if exact match fails
            normalized_target = target.replace("\r\n", "\n")
            temp_normalized = temp_content.replace("\r\n", "\n")
            count = temp_normalized.count(normalized_target)
            if count == 1:
                temp_content = temp_normalized.replace(normalized_target, replacement)
                print(f"  [Chunk {idx+1}] Success (via line-ending normalization)")
            else:
                print(f"  [Chunk {idx+1}] Error: Target content not found in file! (Count: {count})")
                print("  Target start snippet:", repr(target[:120]))
                step_ok = False
        elif count > 1:
            print(f"  [Chunk {idx+1}] Error: Target content matches multiple times ({count})!")
            step_ok = False
        else:
            temp_content = temp_content.replace(target, replacement)
            print(f"  [Chunk {idx+1}] Success")
            
    if step_ok:
        content = temp_content
        success_count += 1
        print("  Step applied successfully. Current length:", len(content))
    else:
        print("  FAILED to apply step.")
        failed_steps.append((convo, step))

print(f"\nApplied {success_count}/{len(replacements)} steps successfully.")
if failed_steps:
    print("Failed steps:", failed_steps)

# 4. Write back reconstructed file
with open(output_file, "w", encoding="utf-8") as f:
    f.write(content)

print(f"\nReconstructed file written to {output_file}. New size: {len(content)} chars.")
